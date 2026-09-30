/**
 * pnpm local:dev — levanta la API y el worker del agente juntos, con las
 * variables de .env. Ctrl+C detiene ambos.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { ROOT, loadEnv } from "./env.js";

loadEnv();
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("⚠  ANTHROPIC_API_KEY está vacía en .env: el agente no podrá responder.\n");
}

const children: ChildProcess[] = [];

function run(name: string, pkg: string, color: number) {
  const child = spawn("pnpm", ["--filter", pkg, "start"], { cwd: ROOT, env: process.env, shell: true });
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream: NodeJS.ReadableStream, out: NodeJS.WriteStream) => {
    let buf = "";
    stream.on("data", (d: Buffer) => {
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop()!;
      for (const line of lines) out.write(tag + line + "\n");
    });
  };
  pipe(child.stdout!, process.stdout);
  pipe(child.stderr!, process.stderr);
  child.on("exit", (code) => {
    console.log(`${tag}terminó (código ${code}). Deteniendo todo.`);
    shutdown(code ?? 1);
  });
  children.push(child);
}

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (!c.killed) c.kill("SIGINT");
  setTimeout(() => process.exit(code), 1500).unref();
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run("api", "@pronex/api", 36);
run("worker", "@pronex/worker", 35);
console.log(`API en http://localhost:${process.env.PORT ?? 3000}  ·  Temporal UI en http://localhost:8233\n`);
