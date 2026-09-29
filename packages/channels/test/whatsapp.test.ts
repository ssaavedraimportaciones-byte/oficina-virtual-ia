import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isWithinServiceWindow,
  parseWhatsAppWebhook,
  verifyWhatsAppSignature,
  WhatsAppApiError,
  WhatsAppClient,
} from "../src/index.js";

const SECRET = "app-secret";
const sign = (body: string, secret = SECRET) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

/** Payload con la forma real de un webhook de la Cloud API. */
export function metaPayload(value: object) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "WABA_ID", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "56912345678", phone_number_id: "PNID_1" },
      ...value,
    } }] }],
  };
}

describe("firma X-Hub-Signature-256", () => {
  const body = JSON.stringify({ hola: "mundo" });

  it("acepta la firma correcta", () => {
    expect(verifyWhatsAppSignature(Buffer.from(body), sign(body), SECRET)).toBe(true);
  });

  it("rechaza firma ausente, mal formada, de otro secreto o de otro cuerpo", () => {
    const buf = Buffer.from(body);
    expect(verifyWhatsAppSignature(buf, undefined, SECRET)).toBe(false);
    expect(verifyWhatsAppSignature(buf, "sha1=abc", SECRET)).toBe(false);
    expect(verifyWhatsAppSignature(buf, "sha256=zz", SECRET)).toBe(false);
    expect(verifyWhatsAppSignature(buf, sign(body, "otro"), SECRET)).toBe(false);
    expect(verifyWhatsAppSignature(Buffer.from(body + " "), sign(body), SECRET)).toBe(false);
  });
});

describe("parseo del webhook", () => {
  it("mensaje de texto con nombre de contacto", () => {
    const p = parseWhatsAppWebhook(metaPayload({
      contacts: [{ wa_id: "56987654321", profile: { name: "Camila" } }],
      messages: [{ from: "56987654321", id: "wamid.A", timestamp: "1727600000", type: "text", text: { body: "Hola, precio?" } }],
    }));
    expect(p.messages).toHaveLength(1);
    expect(p.messages[0]).toMatchObject({
      channel: "whatsapp", accountExternalId: "PNID_1", providerMessageId: "wamid.A",
      from: "+56987654321", contactName: "Camila", type: "text", text: "Hola, precio?",
    });
    expect(p.messages[0]!.timestamp.toISOString()).toBe("2024-09-29T08:53:20.000Z");
  });

  it("botones, listas, imágenes con caption y tipos desconocidos", () => {
    const p = parseWhatsAppWebhook(metaPayload({
      messages: [
        { from: "1", id: "w1", timestamp: "1", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "b", title: "Agendar" } } },
        { from: "1", id: "w2", timestamp: "1", type: "interactive", interactive: { type: "list_reply", list_reply: { id: "l", title: "Plan Pro" } } },
        { from: "1", id: "w3", timestamp: "1", type: "button", button: { text: "Sí", payload: "yes" } },
        { from: "1", id: "w4", timestamp: "1", type: "image", image: { id: "media", caption: "mi carnet" } },
        { from: "1", id: "w5", timestamp: "1", type: "sticker", sticker: { id: "s" } },
      ],
    }));
    expect(p.messages.map((m) => [m.type, m.text])).toEqual([
      ["interactive", "Agendar"], ["interactive", "Plan Pro"], ["interactive", "Sí"], ["image", "mi carnet"], ["unsupported", null],
    ]);
  });

  it("estados de entrega, incluidos errores", () => {
    const p = parseWhatsAppWebhook(metaPayload({
      statuses: [
        { id: "wamid.OUT", status: "delivered", timestamp: "1727600000", recipient_id: "569" },
        { id: "wamid.OUT2", status: "failed", timestamp: "1727600000", errors: [{ code: 131047, title: "Re-engagement message" }] },
        { id: "wamid.OUT3", status: "algo-raro", timestamp: "1" },
      ],
    }));
    expect(p.statuses.map((s) => [s.providerMessageId, s.status, s.error?.code ?? null])).toEqual([
      ["wamid.OUT", "delivered", null], ["wamid.OUT2", "failed", 131047],
    ]);
  });

  it("ignora basura sin lanzar (un 500 haría que Meta reintente sin fin)", () => {
    for (const junk of [null, 42, "x", {}, { object: "page" }, { object: "whatsapp_business_account", entry: "no" },
      metaPayload({ messages: [null, { id: "sin-from" }, { from: "1" }] })]) {
      expect(parseWhatsAppWebhook(junk)).toEqual({ messages: [], statuses: [] });
    }
  });
});

describe("ventana de servicio de 24 h", () => {
  const now = new Date("2026-01-02T12:00:00Z");
  it("dentro, fuera y sin mensajes previos", () => {
    expect(isWithinServiceWindow(new Date("2026-01-01T13:00:00Z"), now)).toBe(true);
    expect(isWithinServiceWindow(new Date("2026-01-01T11:59:00Z"), now)).toBe(false);
    expect(isWithinServiceWindow(null, now)).toBe(false);
  });
});

describe("cliente de la Cloud API", () => {
  const fakeFetch = (status: number, body: object, capture?: (url: string, init: RequestInit) => void) =>
    (async (url: string, init: RequestInit) => {
      capture?.(url, init);
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

  it("envía texto y devuelve el wamid", async () => {
    let sent: { url: string; init: RequestInit } | undefined;
    const client = new WhatsAppClient({ fetch: fakeFetch(200, { messages: [{ id: "wamid.NEW" }] }, (url, init) => { sent = { url, init }; }) });
    const id = await client.send({ phoneNumberId: "PNID_1", accessToken: "tok", to: "+56987654321", content: { text: "Hola" } });
    expect(id).toBe("wamid.NEW");
    expect(sent!.url).toBe("https://graph.facebook.com/v21.0/PNID_1/messages");
    expect((sent!.init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(JSON.parse(sent!.init.body as string)).toMatchObject({ to: "56987654321", type: "text", text: { body: "Hola" } });
  });

  it("envía plantillas", async () => {
    let body: Record<string, unknown> = {};
    const client = new WhatsAppClient({ fetch: fakeFetch(200, { messages: [{ id: "w" }] }, (_u, i) => { body = JSON.parse(i.body as string); }) });
    await client.send({ phoneNumberId: "P", accessToken: "t", to: "1", content: { template: { name: "recontacto", language: "es" } } });
    expect(body).toMatchObject({ type: "template", template: { name: "recontacto", language: { code: "es" } } });
  });

  it("traduce errores de Meta y clasifica reintentables", async () => {
    const outside = new WhatsAppClient({ fetch: fakeFetch(400, { error: { code: 131047, message: "Re-engagement" } }) });
    const err = await outside.send({ phoneNumberId: "P", accessToken: "t", to: "1", content: { text: "x" } }).catch((e) => e);
    expect(err).toBeInstanceOf(WhatsAppApiError);
    expect(err.isOutsideWindow).toBe(true);
    expect(err.isRetryable).toBe(false);

    const down = new WhatsAppClient({ fetch: fakeFetch(503, {}) });
    const err2 = await down.send({ phoneNumberId: "P", accessToken: "t", to: "1", content: { text: "x" } }).catch((e) => e);
    expect(err2.isRetryable).toBe(true);
  });
});
