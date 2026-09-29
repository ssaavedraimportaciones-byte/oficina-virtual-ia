/** Cliente mínimo de la WhatsApp Cloud API (Graph API). */

export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * WhatsApp solo permite mensajes libres dentro de las 24 h posteriores al último
 * mensaje del cliente. Fuera de esa ventana hay que usar una plantilla aprobada.
 */
export function isWithinServiceWindow(lastInboundAt: Date | null, now = new Date()): boolean {
  return lastInboundAt !== null && now.getTime() - lastInboundAt.getTime() < SERVICE_WINDOW_MS;
}

export class WhatsAppApiError extends Error {
  constructor(public status: number, public code: number, message: string) {
    super(message);
  }
  /** 131047: fuera de la ventana de 24 h (Meta lo detectó aunque nosotros no). */
  get isOutsideWindow() {
    return this.code === 131047;
  }
  /** Errores 5xx o de throttling: reintentar tiene sentido. */
  get isRetryable() {
    return this.status >= 500 || this.status === 429 || this.code === 130429 || this.code === 80007;
  }
}

export interface TemplateMessage {
  name: string;
  language: string;
  components?: unknown[];
}

export interface SendParams {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  content: { text: string } | { template: TemplateMessage };
}

export interface WhatsAppClientOptions {
  fetch?: typeof fetch;
  graphVersion?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class WhatsAppClient {
  private fetch: typeof fetch;
  private base: string;
  private timeoutMs: number;

  constructor(opts: WhatsAppClientOptions = {}) {
    this.fetch = opts.fetch ?? globalThis.fetch;
    this.base = `${opts.baseUrl ?? "https://graph.facebook.com"}/${opts.graphVersion ?? "v21.0"}`;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  /** Envía y devuelve el wamid asignado por Meta. */
  async send({ phoneNumberId, accessToken, to, content }: SendParams): Promise<string> {
    const payload =
      "text" in content
        ? { type: "text", text: { body: content.text, preview_url: false } }
        : { type: "template", template: { name: content.template.name, language: { code: content.template.language }, components: content.template.components ?? [] } };

    const res = await this.fetch(`${this.base}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: to.replace(/^\+/, ""), ...payload }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const json = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { code?: number; message?: string };
    };
    if (!res.ok || !json.messages?.[0]?.id) {
      throw new WhatsAppApiError(res.status, json.error?.code ?? 0, json.error?.message ?? `HTTP ${res.status}`);
    }
    return json.messages[0].id;
  }
}
