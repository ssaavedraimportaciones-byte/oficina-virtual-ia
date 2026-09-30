/**
 * pnpm local:chat — simulador de WhatsApp por terminal.
 *
 * Tú escribes como si fueras el cliente: cada línea viaja a la API como un
 * webhook firmado igual que los de Meta. Las respuestas del agente, que la API
 * enviaría a Meta, llegan a un servidor falso de Meta que corre aquí mismo y
 * se muestran en pantalla. Recorre el camino real completo: webhook → base de
 * datos → Temporal → Claude → guardrail → envío.
 *
 * Comandos: /nuevo (otro cliente)  ·  /salir
 */
import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { loadEnv, need, readState } from "./env.js";

loadEnv();
const state = readState();
const apiUrl = `http://localhost:${process.env.PORT ?? 3000}`;
const graphUrl = new URL(process.env.META_GRAPH_BASE_URL || "http://localhost:4010");
const appSecret = need("META_APP_SECRET");

let customer = { phone: "56911112222", name: "Cliente de prueba" };
const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "\x1b[32mTú:\x1b[0m " });

function show(line: string) {
  process.stdout.write(`\r\x1b[K${line}\n`);
  rl.prompt(true);
}

// --- Meta falso: recibe lo que el agente "envía" por WhatsApp -----------------
const graph = createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    try {
      const msg = JSON.parse(body || "{}");
      const text = msg.text?.body ?? (msg.template ? `[plantilla ${msg.template.name}]` : "[mensaje]");
      show(`\x1b[36mAgente →\x1b[0m ${text}`);
    } catch {
      show("\x1b[31m(mensaje saliente ilegible)\x1b[0m");
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ messaging_product: "whatsapp", messages: [{ id: `wamid.sim.${randomUUID()}` }] }));
  });
});

graph.on("error", (err: NodeJS.ErrnoException) => {
  console.error(err.code === "EADDRINUSE"
    ? `El puerto ${graphUrl.port} está ocupado: ¿hay otro "pnpm local:chat" abierto?`
    : `No pude abrir el servidor falso de Meta: ${err.message}`);
  process.exit(1);
});

graph.listen(Number(graphUrl.port || 80), async () => {
  try {
    await fetch(`${apiUrl}/health`);
  } catch {
    console.error(`No encuentro la API en ${apiUrl}. En otra terminal ejecuta: pnpm local:dev`);
    process.exit(1);
  }
  console.log(`Simulador de WhatsApp conectado a ${apiUrl}. Escribe como cliente (/nuevo, /salir).`);
  console.log("El agente espera ~3 s por si sigues escribiendo antes de responder.\n");
  rl.prompt();
});

// --- Cliente: cada línea es un webhook firmado como los de Meta ----------------
async function sendAsCustomer(text: string) {
  const payload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "SIMULADOR", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "56900000000", phone_number_id: state.phoneNumberId },
      contacts: [{ wa_id: customer.phone, profile: { name: customer.name } }],
      messages: [{ from: customer.phone, id: `wamid.sim.in.${randomUUID()}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } }],
    } }] }],
  });
  const signature = `sha256=${createHmac("sha256", appSecret).update(payload).digest("hex")}`;
  const res = await fetch(`${apiUrl}/webhooks/whatsapp`, {
    method: "POST", body: payload, headers: { "content-type": "application/json", "x-hub-signature-256": signature },
  });
  if (!res.ok) show(`\x1b[31mLa API respondió ${res.status}: ${await res.text()}\x1b[0m`);
  else if ((await res.json()).unknown_account) show("\x1b[31mEl número simulado no está conectado. Ejecuta: pnpm local:setup\x1b[0m");
}

rl.on("line", async (line) => {
  const text = line.trim();
  if (!text) return rl.prompt();
  if (text === "/salir") return shutdown();
  if (text === "/nuevo") {
    customer = { phone: `569${Math.floor(10_000_000 + Math.random() * 89_999_999)}`, name: `Cliente ${Math.floor(Math.random() * 1000)}` };
    show(`(ahora escribes como ${customer.name}, +${customer.phone})`);
    return;
  }
  try {
    await sendAsCustomer(text);
  } catch (err) {
    show(`\x1b[31mNo pude enviar: ${(err as Error).message}\x1b[0m`);
  }
  rl.prompt();
});

rl.on("close", () => shutdown());
function shutdown() {
  graph.close();
  process.exit(0);
}
