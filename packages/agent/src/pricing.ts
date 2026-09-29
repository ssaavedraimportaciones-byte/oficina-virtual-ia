import type Anthropic from "@anthropic-ai/sdk";

/** USD por millón de tokens. Tarifas de la API de Anthropic (2026-09). */
interface Price {
  input: number;
  output: number;
  cacheRead: number;
}

const PRICES: Record<string, Price> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1 },
};

/** Modelo desconocido: se cobra como el más caro para no subestimar el presupuesto. */
const UNKNOWN: Price = { input: 10, output: 50, cacheRead: 1 };

/** La escritura en caché (TTL 5 min) cuesta 1,25× la entrada normal. */
const CACHE_WRITE_MULTIPLIER = 1.25;

export function priceOf(model: string): Price {
  return PRICES[model] ?? UNKNOWN;
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

export function usageCost(model: string, usage: Anthropic.Beta.BetaUsage): UsageTotals {
  const p = priceOf(model);
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const costUsd =
    (usage.input_tokens * p.input +
      usage.output_tokens * p.output +
      cacheRead * p.cacheRead +
      cacheWrite * p.input * CACHE_WRITE_MULTIPLIER) / 1_000_000;
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    costUsd,
  };
}
