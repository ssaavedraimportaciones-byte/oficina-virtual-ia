/** Nombres compartidos entre la API (que señaliza) y el worker (que ejecuta). */
export const TASK_QUEUE = "pronex-agent";
export const WORKFLOW_NAME = "conversationWorkflow";
export const INBOUND_SIGNAL = "inbound";

/** Un workflow por conversación: el id fijo es lo que serializa los turnos. */
export const workflowIdFor = (conversationId: string) => `conversation-${conversationId}`;

export interface ConversationWorkflowInput {
  tenantId: string;
  conversationId: string;
  /** Espera tras el último mensaje antes de responder (agrupa ráfagas). Por defecto 3 s. */
  debounceMs?: number;
  /** Tope de espera total agrupando, para no demorar indefinidamente. Por defecto 15 s. */
  maxDebounceMs?: number;
  /** Intentos de la actividad del turno antes de rendirse. Por defecto 5. */
  maxAttempts?: number;
  /** Tras cuánto tiempo sin mensajes termina el workflow (se recrea con el próximo). Por defecto 24 h. */
  idleTimeoutMs?: number;
}
