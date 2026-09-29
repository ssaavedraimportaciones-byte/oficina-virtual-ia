// Código de workflow: debe ser determinista. Nada de I/O, Date.now() real ni imports de Node.
import {
  ActivityFailure, condition, continueAsNew, defineSignal, proxyActivities, setHandler, workflowInfo,
} from "@temporalio/workflow";
import type * as activities from "./activities.js";
import { INBOUND_SIGNAL, type ConversationWorkflowInput } from "./names.js";

export const inboundSignal = defineSignal(INBOUND_SIGNAL);

const MAX_TURNS_PER_RUN = 200;

/**
 * Un workflow por conversación. Recibe una señal por cada mensaje entrante,
 * agrupa ráfagas (debounce) y ejecuta los turnos del agente de a uno: nunca hay
 * dos respuestas en paralelo para la misma conversación.
 */
export async function conversationWorkflow(input: ConversationWorkflowInput): Promise<void> {
  const debounceMs = input.debounceMs ?? 3_000;
  const maxDebounceMs = input.maxDebounceMs ?? 15_000;
  const idleTimeoutMs = input.idleTimeoutMs ?? 24 * 60 * 60 * 1000;

  const { runAgentTurn } = proxyActivities<typeof activities>({
    startToCloseTimeout: "3 minutes",
    retry: {
      maximumAttempts: input.maxAttempts ?? 5,
      initialInterval: "2 seconds",
      backoffCoefficient: 2,
      maximumInterval: "1 minute",
    },
  });
  const { failAgentTurn } = proxyActivities<typeof activities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 10, initialInterval: "5 seconds", maximumInterval: "2 minutes" },
  });

  let signals = 0;
  let handled = 0;
  setHandler(inboundSignal, () => {
    signals++;
  });

  // Al (re)iniciar se revisa una vez por si quedaron mensajes sin procesar.
  let checkOnStart = true;
  let turns = 0;

  for (;;) {
    if (!checkOnStart) {
      const woke = await condition(() => signals > handled, idleTimeoutMs);
      if (!woke) return; // conversación inactiva: el próximo mensaje crea un workflow nuevo
    }
    checkOnStart = false;

    // Debounce: espera a que el cliente deje de escribir (con tope).
    let waited = 0;
    let seen = signals;
    while (waited < maxDebounceMs) {
      const more = await condition(() => signals !== seen, debounceMs);
      if (!more) break;
      seen = signals;
      waited += debounceMs;
    }
    handled = signals;

    const turnInput = { tenantId: input.tenantId, conversationId: input.conversationId };
    try {
      await runAgentTurn(turnInput);
    } catch (err) {
      if (!(err instanceof ActivityFailure)) throw err;
      // Reintentos agotados: avisar al cliente y pasar a un humano.
      await failAgentTurn(turnInput, err.cause?.message ?? err.message);
    }

    turns++;
    if (turns >= MAX_TURNS_PER_RUN || workflowInfo().continueAsNewSuggested) {
      // Historial acotado. El nuevo run revisa pendientes al iniciar, así no se pierde nada.
      await continueAsNew<typeof conversationWorkflow>(input);
    }
  }
}
