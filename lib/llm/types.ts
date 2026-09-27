/**
 * Capa común entre proveedores de IA. El motor del agente habla solo con estos
 * tipos, así cambiar de proveedor —o agregar uno nuevo— no obliga a tocar la
 * lógica de herramientas, agenda ni pedidos.
 */

export interface LlmTool {
  name: string
  description: string
  /** JSON Schema de los parámetros. */
  parameters: Record<string, unknown>
}

export interface LlmToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface LlmToolResult {
  id: string
  content: string
}

export type LlmMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | {
      role: 'assistant_tools'
      text: string
      calls: LlmToolCall[]
      /**
       * Respuesta cruda del proveedor, para devolvérsela tal cual en la
       * siguiente vuelta del loop de herramientas. Anthropic la necesita: si el
       * modelo pensó antes de llamar una herramienta, ese bloque de thinking
       * tiene que volver sin cambios o la API rechaza el pedido.
       */
      raw?: unknown
    }
  | { role: 'tool_results'; results: LlmToolResult[] }

export interface LlmCompletion {
  text: string
  toolCalls: LlmToolCall[]
  /** Ver `raw` en LlmMessage. */
  raw?: unknown
  /** La respuesta se cortó por límite de tokens o el modelo se negó a contestar. */
  incomplete?: boolean
}

export interface LlmRequest {
  /** Parte estable del prompt: se cachea entre pedidos. */
  system: string
  /**
   * Parte que cambia en cada conversación (fecha, ficha del contacto). Va
   * después de `system` para no invalidar la caché de la parte estable.
   */
  context?: string
  messages: LlmMessage[]
  tools?: LlmTool[]
  maxTokens: number
  /**
   * Cuánto razona el modelo antes de contestar. Baja para tareas simples (la
   * ficha del contacto), media para chatear con clientes.
   */
  effort?: 'low' | 'medium' | 'high'
}

export interface LlmProvider {
  /** Identificador del proveedor, para mostrarlo en el panel. */
  id: 'anthropic' | 'openai'
  model: string
  complete(request: LlmRequest): Promise<LlmCompletion>
  /** Traduce los errores del proveedor a algo accionable para el panel. */
  describeError(error: unknown): string
}
