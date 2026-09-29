import type { Client } from "@temporalio/client";
import type { InboundDispatcher } from "@pronex/messaging";
import { INBOUND_SIGNAL, TASK_QUEUE, WORKFLOW_NAME, workflowIdFor, type ConversationWorkflowInput } from "./names.js";

/**
 * Entrega un mensaje entrante al workflow de su conversación: lo crea si no
 * existe y le envía la señal en una sola operación atómica (signalWithStart).
 */
export function temporalDispatcher(
  client: Client, options: Omit<ConversationWorkflowInput, "tenantId" | "conversationId"> = {},
): InboundDispatcher {
  return {
    async dispatch(event) {
      await client.workflow.signalWithStart(WORKFLOW_NAME, {
        taskQueue: TASK_QUEUE,
        workflowId: workflowIdFor(event.conversationId),
        args: [{ tenantId: event.tenantId, conversationId: event.conversationId, ...options }],
        signal: INBOUND_SIGNAL,
        signalArgs: [],
      });
    },
  };
}
