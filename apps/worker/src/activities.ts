import { failAgentTurn as fail, runAgentTurn as run, type RuntimeDeps, type TurnInput, type TurnOutcome } from "@pronex/agent";

let deps: RuntimeDeps | null = null;

/** El worker inyecta las dependencias reales (o de test) antes de arrancar. */
export function configureActivities(d: RuntimeDeps) {
  deps = d;
}

function current(): RuntimeDeps {
  if (!deps) throw new Error("Actividades sin configurar: llama a configureActivities()");
  return deps;
}

export async function runAgentTurn(input: TurnInput): Promise<TurnOutcome> {
  return run(current(), input);
}

export async function failAgentTurn(input: TurnInput, reason: string): Promise<TurnOutcome> {
  return fail(current(), input, new Error(reason));
}
