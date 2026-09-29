/**
 * Mensaje canónico (ARCHITECTURE D2). Cada adaptador de canal traduce a/desde
 * estos tipos; el runtime del agente nunca ve el formato del proveedor.
 */
export type Channel = "whatsapp" | "voice" | "email" | "sms" | "instagram" | "web";

export type InboundContentType =
  | "text" | "image" | "audio" | "video" | "document" | "location" | "interactive" | "unsupported";

export interface InboundMessage {
  channel: Channel;
  /** Cuenta del negocio que recibe (en WhatsApp: phone_number_id). */
  accountExternalId: string;
  /** Id del proveedor, base de la idempotencia (en WhatsApp: wamid). */
  providerMessageId: string;
  /** Remitente normalizado (E.164 con +). */
  from: string;
  contactName: string | null;
  timestamp: Date;
  type: InboundContentType;
  /** Texto legible: cuerpo, caption o título de botón. */
  text: string | null;
  raw: unknown;
}

export type DeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";

export interface StatusUpdate {
  channel: Channel;
  accountExternalId: string;
  providerMessageId: string;
  status: DeliveryStatus;
  timestamp: Date;
  error: { code: number; title: string } | null;
}

/** Orden de avance: un estado nunca retrocede (read no vuelve a delivered). */
export const STATUS_RANK: Record<DeliveryStatus, number> = {
  queued: 0, sent: 1, delivered: 2, read: 3, failed: 4,
};
