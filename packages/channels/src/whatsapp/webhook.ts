import { createHmac, timingSafeEqual } from "node:crypto";
import type { DeliveryStatus, InboundContentType, InboundMessage, StatusUpdate } from "../canonical.js";

/**
 * Meta firma el cuerpo crudo con HMAC-SHA256(app_secret) en X-Hub-Signature-256.
 * Hay que verificar sobre los bytes exactos recibidos, nunca sobre JSON re-serializado.
 */
export function verifyWhatsAppSignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const received = Buffer.from(header.slice(7), "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export interface ParsedWebhook {
  messages: InboundMessage[];
  statuses: StatusUpdate[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

const toE164 = (waId: string) => (waId.startsWith("+") ? waId : `+${waId}`);
const toDate = (unixSeconds: unknown) => {
  const n = Number(unixSeconds);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : new Date();
};

const KNOWN_TYPES = new Set<InboundContentType>(["text", "image", "audio", "video", "document", "location", "interactive"]);
const STATUSES = new Set<DeliveryStatus>(["sent", "delivered", "read", "failed"]);

function extractText(m: Obj): string | null {
  const t = m.type;
  if (t === "text" && isObj(m.text)) return str(m.text.body);
  if (t === "button" && isObj(m.button)) return str(m.button.text);
  if (t === "interactive" && isObj(m.interactive)) {
    const i = m.interactive;
    const reply = isObj(i.button_reply) ? i.button_reply : isObj(i.list_reply) ? i.list_reply : null;
    return reply ? str(reply.title) : null;
  }
  if (typeof t === "string" && isObj(m[t])) return str((m[t] as Obj).caption);
  return null;
}

/**
 * Traduce el payload de Meta a mensajes canónicos. Es tolerante: ignora lo que
 * no entiende en vez de fallar, porque un 500 hace que Meta reintente sin fin.
 */
export function parseWhatsAppWebhook(body: unknown): ParsedWebhook {
  const out: ParsedWebhook = { messages: [], statuses: [] };
  if (!isObj(body) || body.object !== "whatsapp_business_account") return out;

  for (const entry of arr(body.entry)) {
    if (!isObj(entry)) continue;
    for (const change of arr(entry.changes)) {
      if (!isObj(change) || change.field !== "messages" || !isObj(change.value)) continue;
      const value = change.value;
      const accountExternalId = isObj(value.metadata) ? str(value.metadata.phone_number_id) : null;
      if (!accountExternalId) continue;

      const names = new Map<string, string>();
      for (const c of arr(value.contacts)) {
        if (isObj(c) && str(c.wa_id) && isObj(c.profile) && str(c.profile.name)) {
          names.set(c.wa_id as string, c.profile.name as string);
        }
      }

      for (const m of arr(value.messages)) {
        if (!isObj(m)) continue;
        const id = str(m.id);
        const from = str(m.from);
        if (!id || !from) continue;
        const rawType = m.type === "button" ? "interactive" : (m.type as InboundContentType);
        out.messages.push({
          channel: "whatsapp",
          accountExternalId,
          providerMessageId: id,
          from: toE164(from),
          contactName: names.get(from) ?? null,
          timestamp: toDate(m.timestamp),
          type: KNOWN_TYPES.has(rawType) ? rawType : "unsupported",
          text: extractText(m),
          raw: m,
        });
      }

      for (const s of arr(value.statuses)) {
        if (!isObj(s)) continue;
        const id = str(s.id);
        const status = s.status as DeliveryStatus;
        if (!id || !STATUSES.has(status)) continue;
        const err = arr(s.errors)[0];
        out.statuses.push({
          channel: "whatsapp",
          accountExternalId,
          providerMessageId: id,
          status,
          timestamp: toDate(s.timestamp),
          error: isObj(err) ? { code: Number(err.code) || 0, title: str(err.title) ?? "unknown" } : null,
        });
      }
    }
  }
  return out;
}
