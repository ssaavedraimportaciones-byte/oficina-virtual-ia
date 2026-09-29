import Anthropic from "@anthropic-ai/sdk";

export type CreateParams = Anthropic.Beta.MessageCreateParamsNonStreaming;

/**
 * Frontera con el proveedor del LLM. El runtime solo depende de esto, así los
 * tests usan un modelo guionado y otro proveedor puede adaptarse detrás.
 */
export interface ModelClient {
  create(params: CreateParams): Promise<Anthropic.Beta.BetaMessage>;
}

export function anthropicModelClient(client = new Anthropic({ maxRetries: 3 })): ModelClient {
  return { create: (params) => client.beta.messages.create(params) };
}

/** Modelos que aceptan `fallbacks: "default"` (reintento server-side tras una negativa). */
const FALLBACK_CAPABLE = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function fallbackParams(model: string): Pick<CreateParams, "betas" | "fallbacks"> {
  return FALLBACK_CAPABLE.has(model) ? { betas: [FALLBACK_BETA], fallbacks: "default" } : {};
}

/**
 * Clasifica errores del proveedor. Los transitorios (429, 5xx, red) ya los
 * reintenta el SDK; si igual llegan aquí, Temporal reintenta la actividad.
 * Los permanentes (400, 401, 403, 404) no mejoran reintentando.
 */
export function isRetryableModelError(err: unknown): boolean {
  if (err instanceof Anthropic.RateLimitError) return true;
  if (err instanceof Anthropic.InternalServerError) return true;
  if (err instanceof Anthropic.APIConnectionError) return true; // incluye timeouts
  if (err instanceof Anthropic.APIError) return false;
  return true; // errores desconocidos (red, bugs transitorios): mejor reintentar
}
