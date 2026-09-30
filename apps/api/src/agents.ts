import { runGoldenSuite, TOOLS, type ModelClient } from "@pronex/agent";
import type { Principal } from "@pronex/auth";
import { withTenant } from "@pronex/db";
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { HttpError } from "./auth.js";

type Audit = (c: PoolClient, p: Principal, action: string, target: string | null, detail?: object) => Promise<void>;

const uuidParams = (...names: string[]) => ({
  type: "object",
  properties: Object.fromEntries(names.map((n) => [n, { type: "string", format: "uuid" }])),
});

const versionProps = {
  prompt: { type: "string", minLength: 1, maxLength: 50_000 },
  model: { type: "string", pattern: "^claude-[a-z0-9-]+$", maxLength: 64 },
  tools: { type: "array", uniqueItems: true, items: { type: "string", enum: Object.keys(TOOLS) } },
  effort: { type: "string", enum: ["low", "medium", "high", "xhigh", "max"] },
  maxSteps: { type: "integer", minimum: 1, maximum: 20 },
  conversationBudgetUsd: { type: "number", exclusiveMinimum: 0, maximum: 100 },
  notes: { type: "string", maxLength: 2000 },
} as const;

interface VersionBody {
  prompt: string;
  model?: string;
  tools?: string[];
  effort?: string;
  maxSteps?: number;
  conversationBudgetUsd?: number;
  notes?: string;
}

const DEFAULT_MODEL = "claude-opus-5-5";
const DEFAULT_TOOLS = ["handoff_to_human", "update_lead"];
const VERSION_COLUMNS = "id, agent_id, version, prompt, model, tools, effort, max_steps, conversation_budget_usd, notes, created_by, created_at";

async function insertVersion(c: PoolClient, p: Principal, agentId: string, version: number, b: VersionBody) {
  const { rows: [v] } = await c.query(
    `insert into agent_versions (tenant_id, agent_id, version, prompt, model, tools, effort, max_steps, conversation_budget_usd, notes, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning ${VERSION_COLUMNS}`,
    [p.tenantId, agentId, version, b.prompt, b.model ?? DEFAULT_MODEL, JSON.stringify(b.tools ?? DEFAULT_TOOLS),
      b.effort ?? "medium", b.maxSteps ?? 6, b.conversationBudgetUsd ?? 0.5, b.notes ?? null,
      p.kind === "user" ? `user:${p.userId}` : `api_key:${p.keyId}`],
  );
  return v;
}

async function lockAgent(c: PoolClient, agentId: string) {
  const { rows: [a] } = await c.query("select * from agents where id = $1 for update", [agentId]);
  if (!a) throw new HttpError(404, "agent_not_found");
  return a as { id: string; published_version_id: string | null; canary_version_id: string | null; canary_percent: number };
}

async function versionOf(c: PoolClient, agentId: string, versionId: string) {
  const { rows: [v] } = await c.query("select id, version from agent_versions where id = $1 and agent_id = $2", [versionId, agentId]);
  if (!v) throw new HttpError(404, "version_not_found");
  return v as { id: string; version: number };
}

export function registerAgentRoutes(app: FastifyInstance, pool: Pool, audit: Audit, model: ModelClient | undefined) {
  app.post<{ Body: VersionBody & { workspaceId: string; name: string } }>("/v1/agents", {
    config: { permission: "agents:write" },
    schema: {
      body: {
        type: "object", required: ["workspaceId", "name", "prompt"], additionalProperties: false,
        properties: { workspaceId: { type: "string", format: "uuid" }, name: { type: "string", minLength: 1, maxLength: 100 }, ...versionProps },
      },
    },
  }, async (req, reply) => {
    const p = req.principal!;
    const out = await withTenant(pool, p.tenantId, async (c) => {
      const ws = await c.query("select 1 from workspaces where id = $1", [req.body.workspaceId]);
      if (!ws.rowCount) throw new HttpError(404, "workspace_not_found");
      const { rows: [agent] } = await c.query(
        "insert into agents (tenant_id, workspace_id, name) values ($1, $2, $3) returning id, workspace_id, name, created_at",
        [p.tenantId, req.body.workspaceId, req.body.name],
      );
      const version = await insertVersion(c, p, agent.id, 1, req.body);
      await audit(c, p, "agent.create", agent.id, { name: req.body.name });
      return { ...agent, versions: [version], published_version_id: null };
    });
    return reply.status(201).send(out);
  });

  app.get("/v1/agents", { config: { permission: "agents:read" } }, async (req) => {
    const { rows } = await withTenant(pool, req.principal!.tenantId, (c) =>
      c.query(
        `select a.id, a.workspace_id, a.name, a.published_version_id, a.canary_version_id, a.canary_percent, a.created_at,
                (select max(version) from agent_versions v where v.agent_id = a.id) as latest_version
         from agents a order by a.created_at`,
      ),
    );
    return { data: rows };
  });

  app.get<{ Params: { id: string } }>("/v1/agents/:id/versions", {
    config: { permission: "agents:read" }, schema: { params: uuidParams("id") },
  }, async (req) => {
    const { rows } = await withTenant(pool, req.principal!.tenantId, (c) =>
      c.query(
        `select ${VERSION_COLUMNS.split(", ").map((col) => `v.${col}`).join(", ")},
                (select row_to_json(e) from (select id, status, total, passed, cost_usd, finished_at from eval_runs
                  where agent_version_id = v.id order by started_at desc limit 1) e) as last_eval
         from agent_versions v where v.agent_id = $1 order by v.version desc`,
        [req.params.id],
      ),
    );
    return { data: rows };
  });

  /** Una versión nueva parte de la anterior: solo se envía lo que cambia. */
  app.post<{ Params: { id: string }; Body: Partial<VersionBody> }>("/v1/agents/:id/versions", {
    config: { permission: "agents:write" },
    schema: { params: uuidParams("id"), body: { type: "object", additionalProperties: false, minProperties: 1, properties: versionProps } },
  }, async (req, reply) => {
    const p = req.principal!;
    const out = await withTenant(pool, p.tenantId, async (c) => {
      await lockAgent(c, req.params.id);
      const { rows: [prev] } = await c.query(
        `select version, prompt, model, tools, effort, max_steps, conversation_budget_usd from agent_versions
         where agent_id = $1 order by version desc limit 1`,
        [req.params.id],
      );
      const b = req.body;
      const merged: VersionBody = {
        prompt: b.prompt ?? prev.prompt, model: b.model ?? prev.model, tools: b.tools ?? prev.tools, effort: b.effort ?? prev.effort,
        maxSteps: b.maxSteps ?? prev.max_steps, conversationBudgetUsd: b.conversationBudgetUsd ?? Number(prev.conversation_budget_usd),
        notes: b.notes,
      };
      const changed = (["prompt", "model", "tools", "effort", "maxSteps", "conversationBudgetUsd"] as const).filter((k) => {
        const before = { prompt: prev.prompt, model: prev.model, tools: prev.tools, effort: prev.effort, maxSteps: prev.max_steps,
          conversationBudgetUsd: Number(prev.conversation_budget_usd) }[k];
        return JSON.stringify(before) !== JSON.stringify(merged[k]);
      });
      if (!changed.length) throw new HttpError(409, "no_changes");
      const v = await insertVersion(c, p, req.params.id, prev.version + 1, merged);
      await audit(c, p, "agent.version.create", v.id, { version: v.version, changed });
      return { ...v, changed };
    });
    return reply.status(201).send(out);
  });

  // --- Casos dorados -----------------------------------------------------------

  app.post<{ Params: { id: string }; Body: { name: string; turns: string[]; expectations?: object } }>("/v1/agents/:id/golden-cases", {
    config: { permission: "agents:write" },
    schema: {
      params: uuidParams("id"),
      body: {
        type: "object", required: ["name", "turns"], additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          turns: { type: "array", minItems: 1, maxItems: 10, items: { type: "string", minLength: 1, maxLength: 2000 } },
          expectations: {
            type: "object", additionalProperties: false,
            properties: {
              must_contain: { type: "array", maxItems: 20, items: { type: "string", minLength: 1 } },
              must_not_contain: { type: "array", maxItems: 20, items: { type: "string", minLength: 1 } },
              expect_handoff: { type: "boolean" },
              max_cost_usd: { type: "number", exclusiveMinimum: 0 },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const p = req.principal!;
    const row = await withTenant(pool, p.tenantId, async (c) => {
      await lockAgent(c, req.params.id);
      const r = await c.query(
        `insert into golden_cases (tenant_id, agent_id, name, turns, expectations) values ($1, $2, $3, $4, $5)
         on conflict (agent_id, name) do nothing returning id, name, turns, expectations, created_at`,
        [p.tenantId, req.params.id, req.body.name, JSON.stringify(req.body.turns), req.body.expectations ?? {}],
      );
      if (!r.rowCount) throw new HttpError(409, "golden_case_exists");
      return r.rows[0];
    });
    return reply.status(201).send(row);
  });

  app.get<{ Params: { id: string } }>("/v1/agents/:id/golden-cases", {
    config: { permission: "agents:read" }, schema: { params: uuidParams("id") },
  }, async (req) => {
    const { rows } = await withTenant(pool, req.principal!.tenantId, (c) =>
      c.query("select id, name, turns, expectations, created_at from golden_cases where agent_id = $1 order by name", [req.params.id]),
    );
    return { data: rows };
  });

  /** Corre los casos dorados contra una versión (llama al modelo real: tiene costo). */
  app.post<{ Params: { id: string; versionId: string } }>("/v1/agents/:id/versions/:versionId/evaluate", {
    config: { permission: "agents:write" }, schema: { params: uuidParams("id", "versionId") },
  }, async (req) => {
    if (!model) throw new HttpError(503, "model_not_configured");
    const p = req.principal!;
    const count = await withTenant(pool, p.tenantId, async (c) => {
      await versionOf(c, req.params.id, req.params.versionId);
      const { rows: [n] } = await c.query("select count(*)::int as n from golden_cases where agent_id = $1", [req.params.id]);
      return n.n as number;
    });
    if (count === 0) throw new HttpError(409, "no_golden_cases");
    if (count > 25) throw new HttpError(409, "too_many_golden_cases");
    return runGoldenSuite({ pool, model }, { tenantId: p.tenantId, agentId: req.params.id, versionId: req.params.versionId });
  });

  // --- Publicación ---------------------------------------------------------------

  /**
   * Publica una versión (o la pone en canary para un % de conversaciones). Si el agente
   * tiene casos dorados, la versión debe haberlos pasado en su última evaluación.
   * Solo el owner puede forzar la publicación sin evaluación aprobada.
   */
  app.post<{ Params: { id: string }; Body: { versionId: string; canaryPercent?: number; force?: boolean } }>("/v1/agents/:id/publish", {
    config: { permission: "agents:publish" },
    schema: {
      params: uuidParams("id"),
      body: {
        type: "object", required: ["versionId"], additionalProperties: false,
        properties: {
          versionId: { type: "string", format: "uuid" },
          canaryPercent: { type: "integer", minimum: 1, maximum: 99 },
          force: { type: "boolean" },
        },
      },
    },
  }, async (req) => {
    const p = req.principal!;
    const { versionId, canaryPercent, force = false } = req.body;
    if (force && !(p.kind === "user" && p.role === "owner")) throw new HttpError(403, "force_requires_owner");
    return withTenant(pool, p.tenantId, async (c) => {
      const agent = await lockAgent(c, req.params.id);
      const v = await versionOf(c, req.params.id, versionId);

      const { rows: [cases] } = await c.query("select count(*)::int as n from golden_cases where agent_id = $1", [agent.id]);
      const { rows: [lastEval] } = await c.query(
        "select status from eval_runs where agent_version_id = $1 and status <> 'running' order by started_at desc limit 1", [v.id],
      );
      const evalOk = cases.n === 0 || lastEval?.status === "passed";
      if (!evalOk && !force) {
        throw new HttpError(409, lastEval ? "golden_cases_failed" : "evaluation_required");
      }

      if (canaryPercent) {
        if (agent.published_version_id === v.id) throw new HttpError(409, "already_published");
        await c.query("update agents set canary_version_id = $2, canary_percent = $3 where id = $1", [agent.id, v.id, canaryPercent]);
      } else {
        await c.query(
          "update agents set published_version_id = $2, canary_version_id = null, canary_percent = 0 where id = $1", [agent.id, v.id],
        );
      }
      await audit(c, p, canaryPercent ? "agent.canary" : "agent.publish", v.id, {
        version: v.version, canaryPercent: canaryPercent ?? null, forced: force && !evalOk, previous: agent.published_version_id,
      });
      const { rows: [updated] } = await c.query(
        "select id, published_version_id, canary_version_id, canary_percent from agents where id = $1", [agent.id],
      );
      return updated;
    });
  });

  /** La canary pasa a ser la versión publicada para el 100 %. */
  app.post<{ Params: { id: string } }>("/v1/agents/:id/promote-canary", {
    config: { permission: "agents:publish" }, schema: { params: uuidParams("id") },
  }, async (req) => {
    const p = req.principal!;
    return withTenant(pool, p.tenantId, async (c) => {
      const agent = await lockAgent(c, req.params.id);
      if (!agent.canary_version_id) throw new HttpError(409, "no_canary");
      await c.query(
        "update agents set published_version_id = canary_version_id, canary_version_id = null, canary_percent = 0 where id = $1", [agent.id],
      );
      await audit(c, p, "agent.promote_canary", agent.canary_version_id, { previous: agent.published_version_id });
      return (await c.query("select id, published_version_id, canary_version_id, canary_percent from agents where id = $1", [agent.id])).rows[0];
    });
  });

  /** Vuelve a una versión anterior de inmediato (sin gate: es la salida de emergencia) y cancela la canary. */
  app.post<{ Params: { id: string }; Body: { versionId: string } }>("/v1/agents/:id/rollback", {
    config: { permission: "agents:publish" },
    schema: {
      params: uuidParams("id"),
      body: { type: "object", required: ["versionId"], additionalProperties: false, properties: { versionId: { type: "string", format: "uuid" } } },
    },
  }, async (req) => {
    const p = req.principal!;
    return withTenant(pool, p.tenantId, async (c) => {
      const agent = await lockAgent(c, req.params.id);
      const v = await versionOf(c, req.params.id, req.body.versionId);
      await c.query("update agents set published_version_id = $2, canary_version_id = null, canary_percent = 0 where id = $1", [agent.id, v.id]);
      await audit(c, p, "agent.rollback", v.id, { version: v.version, from: agent.published_version_id });
      return (await c.query("select id, published_version_id, canary_version_id, canary_percent from agents where id = $1", [agent.id])).rows[0];
    });
  });

  // --- Asignación de agente a un número -------------------------------------------

  app.post<{ Params: { id: string }; Body: { agentId: string | null } }>("/v1/channels/:id/agent", {
    config: { permission: "channels:manage" },
    schema: {
      params: uuidParams("id"),
      body: {
        type: "object", required: ["agentId"], additionalProperties: false,
        properties: { agentId: { anyOf: [{ type: "string", format: "uuid" }, { type: "null" }] } },
      },
    },
  }, async (req) => {
    const p = req.principal!;
    return withTenant(pool, p.tenantId, async (c) => {
      if (req.body.agentId) await lockAgent(c, req.body.agentId);
      const r = await c.query(
        "update channel_accounts set agent_id = $2 where id = $1 returning id, external_id, agent_id", [req.params.id, req.body.agentId],
      );
      if (!r.rowCount) throw new HttpError(404, "channel_not_found");
      await audit(c, p, "channel.assign_agent", req.params.id, { agentId: req.body.agentId });
      return r.rows[0];
    });
  });
}
