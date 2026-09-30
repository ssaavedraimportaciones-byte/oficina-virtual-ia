import { createRequire } from "node:module";
import { anthropicModelClient } from "@pronex/agent";
import { SecretBox } from "@pronex/auth";
import { WhatsAppClient } from "@pronex/channels";
import { sendMessage } from "@pronex/messaging";
import { NativeConnection, Worker } from "@temporalio/worker";
import pg from "pg";
import * as activities from "./activities.js";
import { TASK_QUEUE } from "./names.js";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

const pool = new pg.Pool({ connectionString: required("APP_DATABASE_URL"), max: 10 });
const secretBox = new SecretBox(required("PRONEX_SECRET_KEY"));
const whatsapp = new WhatsAppClient({ graphVersion: process.env.META_GRAPH_VERSION, baseUrl: process.env.META_GRAPH_BASE_URL || undefined });

// Credenciales de Anthropic: ANTHROPIC_API_KEY (o un perfil de `ant auth login`).
activities.configureActivities({
  pool,
  model: anthropicModelClient(),
  send: (req) => sendMessage({ pool, secretBox, whatsapp }, req),
});

const connection = await NativeConnection.connect({ address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233" });
const worker = await Worker.create({
  connection,
  namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
  taskQueue: TASK_QUEUE,
  workflowsPath: createRequire(import.meta.url).resolve("./workflows.ts"),
  activities,
  bundlerOptions: {
    // Los imports usan ".js" (ESM de TypeScript); en el bundle apuntan a los .ts.
    webpackConfigHook: (config) => ({
      ...config,
      resolve: { ...config.resolve, extensionAlias: { ".js": [".ts", ".js"] } },
    }),
  },
});
console.log(`Worker de Pronex escuchando la cola "${TASK_QUEUE}"`);
await worker.run();
