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
  | { role: 'assistant_tools'; text: string; calls: LlmToolCall[] }
  | { role: 'tool_results'; results: LlmToolResult[] }

export interface LlmCompletion {
  text: string
  toolCalls: LlmToolCall[]
}

export interface LlmRequest {
  system: string
  messages: LlmMessage[]
  tools?: LlmTool[]
  maxTokens: number
}

export interface LlmProvider {
  /** Identificador del proveedor, para mostrarlo en el panel. */
  id: 'anthropic' | 'openai'
  model: string
  complete(request: LlmRequest): Promise<LlmCompletion>
  /** Traduce los errores del proveedor a algo accionable para el panel. */
  describeError(error: unknown): string
}
