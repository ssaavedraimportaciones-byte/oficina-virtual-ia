import type Anthropic from "@anthropic-ai/sdk";
import type { PoolClient } from "pg";

/** Estado que las herramientas acumulan durante un turno y el runtime aplica al final. */
export interface TurnEffects {
  handoffReason: string | null;
}

export interface ToolContext {
  db: PoolClient; // ya dentro de withTenant
  tenantId: string;
  conversationId: string;
  leadId: string;
  effects: TurnEffects;
}

interface ToolDef {
  definition: Anthropic.Beta.BetaTool;
  /** Valida la entrada (el modelo es una fuente no confiable) y ejecuta. Devuelve texto para el modelo. */
  run(input: unknown, ctx: ToolContext): Promise<string>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

class ToolInputError extends Error {}

function stringOrNull(v: unknown, field: string, max: number): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") throw new ToolInputError(`${field} debe ser texto o null`);
  const t = v.trim();
  if (t.length > max) throw new ToolInputError(`${field} excede ${max} caracteres`);
  return t || null;
}

export const TOOLS: Record<string, ToolDef> = {
  handoff_to_human: {
    definition: {
      name: "handoff_to_human",
      description:
        "Transfiere la conversación a una persona del equipo. Úsala cuando el cliente pida hablar con una persona, " +
        "cuando no tengas la información para responder con certeza, ante reclamos, o si el cliente parece molesto. " +
        "Después de llamarla, escribe un mensaje breve avisando que alguien del equipo continuará.",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["reason"],
        properties: { reason: { type: "string", description: "Motivo breve, para el equipo humano." } },
      },
    },
    async run(input, ctx) {
      if (!isObj(input)) throw new ToolInputError("entrada inválida");
      const reason = stringOrNull(input.reason, "reason", 500) ?? "sin motivo";
      ctx.effects.handoffReason = reason;
      return "Transferencia registrada. Avísale al cliente que una persona del equipo continuará la conversación.";
    },
  },

  update_lead: {
    definition: {
      name: "update_lead",
      description:
        "Guarda datos que el cliente te dio explícitamente en esta conversación (nombre, email). " +
        "No inventes ni deduzcas datos. Usa null en los campos que no cambian.",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["full_name", "email"],
        properties: {
          full_name: { type: ["string", "null"] },
          email: { type: ["string", "null"] },
        },
      },
    },
    async run(input, ctx) {
      if (!isObj(input)) throw new ToolInputError("entrada inválida");
      const fullName = stringOrNull(input.full_name, "full_name", 200);
      const email = stringOrNull(input.email, "email", 320);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ToolInputError("email con formato inválido");
      if (!fullName && !email) return "Sin cambios.";
      await ctx.db.query(
        "update leads set full_name = coalesce($2, full_name), email = coalesce($3, email) where id = $1",
        [ctx.leadId, fullName, email],
      );
      return "Datos del cliente actualizados.";
    },
  },
};

/** Solo las herramientas habilitadas en la versión del agente, en orden estable (clave para el caché). */
export function toolDefinitionsFor(enabled: string[]): Anthropic.Beta.BetaTool[] {
  return Object.keys(TOOLS).filter((n) => enabled.includes(n)).sort().map((n) => TOOLS[n]!.definition);
}

export async function executeTool(
  block: Anthropic.Beta.BetaToolUseBlock,
  enabled: string[],
  ctx: ToolContext,
): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  const tool = TOOLS[block.name];
  if (!tool || !enabled.includes(block.name)) {
    return { type: "tool_result", tool_use_id: block.id, is_error: true, content: `Herramienta no disponible: ${block.name}` };
  }
  try {
    return { type: "tool_result", tool_use_id: block.id, content: await tool.run(block.input, ctx) };
  } catch (err) {
    if (err instanceof ToolInputError) {
      return { type: "tool_result", tool_use_id: block.id, is_error: true, content: err.message };
    }
    throw err; // errores de BD, etc.: los maneja el runtime
  }
}
