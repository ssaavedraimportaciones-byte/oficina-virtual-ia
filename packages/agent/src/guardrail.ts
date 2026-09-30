/**
 * Guardrail síncrono: revisa cada respuesta del agente ANTES de enviarla.
 *
 * Son reglas deterministas (sin LLM) para que sean rápidas (< 1 ms típico, meta
 * p95 < 150 ms), predecibles y auditables. Un "block" impide el envío: el cliente
 * recibe un aviso y la conversación pasa a una persona.
 */
import { PLATFORM_RULES } from "./prompt.js";

export type Verdict = "pass" | "warn" | "block";

export interface Finding {
  rule: string;
  verdict: Exclude<Verdict, "pass">;
  detail: Record<string, unknown>;
}

export interface GuardrailInput {
  /** Texto que el agente quiere enviar. */
  reply: string;
  /** Instrucciones del negocio (fuente autorizada de precios y datos). */
  businessFacts: string;
  /** Lo que dijo el cliente en la conversación (y sus datos conocidos). */
  customerText: string;
  /** Mensajes nuevos del cliente en este turno (para detectar intentos de manipulación). */
  latestInbound?: string;
}

export interface GuardrailResult {
  verdict: Verdict;
  findings: Finding[];
  latencyMs: number;
}

// --- Montos ------------------------------------------------------------------

const CURRENCY = String.raw`(?:US\$|USD|CLP|MXN|ARS|COP|PEN|UF|EUR|R\$|S\/|€|\$)`;
const NUMBER = String.raw`\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const WORD_CURRENCY = String.raw`(?:d[oó]lares?|pesos?|euros?|soles?|reales?|lucas?)`;
const AMOUNT_RE = new RegExp(
  String.raw`${CURRENCY}\s?(${NUMBER})|(${NUMBER})\s?(?:${CURRENCY}|${WORD_CURRENCY})(?![a-záéíóú])`,
  "giu",
);

/** "49.990" → "49990", "49,99" → "4999", "1 200" → "1200", "49,00" → "49". */
function canonicalNumber(raw: string): string {
  return raw.replace(/[.,]00$/, "").replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
}

export function extractAmounts(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(AMOUNT_RE)) {
    const n = m[1] ?? m[2];
    if (n) out.add(canonicalNumber(n));
  }
  return [...out];
}

// --- Datos personales --------------------------------------------------------

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(?<![\d$])\+?\d(?:[\s-]?\d){7,14}(?!\d)/g;
const RUT_RE = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g;
const CARD_RE = /\b(?:\d[ -]?){12,18}\d\b/g;

const digits = (s: string) => s.replace(/\D/g, "");
const lastDigits = (s: string, n = 8) => digits(s).slice(-n);

function luhn(num: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = num.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// --- Filtración de instrucciones internas -------------------------------------

const normalizeWords = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ\s]/g, " ").split(/\s+/).filter(Boolean);

const SHINGLE = 8;
function shingles(words: string[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + SHINGLE <= words.length; i++) out.add(words.slice(i, i + SHINGLE).join(" "));
  return out;
}
const PLATFORM_SHINGLES = shingles(normalizeWords(PLATFORM_RULES));
const LEAK_MARKERS = [/reglas de la plataforma/i, /instrucciones del negocio/i, /\[SIN_RESPUESTA\]/];

// --- Manipulación --------------------------------------------------------------

const INJECTION_RE = [
  /ignor[ae]\w*\s+(?:todas?\s+)?(?:las?\s+|tus\s+)?(?:instrucciones|reglas|indicaciones)/i,
  /ignore\s+(?:all\s+)?(?:previous|prior|your)\s+(?:instructions|rules)/i,
  /(?:system|developer)\s+prompt/i,
  /(?:revela|muestra|dime)\s+(?:tu|tus|el)\s+(?:prompt|instrucciones)/i,
  /(?:ahora\s+eres|act[uú]a\s+como|you\s+are\s+now|pretend\s+to\s+be)/i,
];

const MAX_LENGTH = 1200;

export function checkReply(input: GuardrailInput): GuardrailResult {
  const t0 = performance.now();
  const findings: Finding[] = [];
  const { reply, businessFacts, customerText } = input;

  // 1. Montos: solo los que figuran en las instrucciones del negocio.
  const allowed = new Set(extractAmounts(businessFacts));
  const fromCustomer = new Set(extractAmounts(customerText));
  for (const amount of extractAmounts(reply)) {
    if (allowed.has(amount)) continue;
    if (fromCustomer.has(amount)) {
      findings.push({ rule: "amount_from_customer", verdict: "warn", detail: { amount } });
    } else {
      findings.push({ rule: "unsupported_amount", verdict: "block", detail: { amount } });
    }
  }

  // 2. Datos personales que no son del cliente ni del negocio.
  // Los tramos ya reconocidos como montos no se evalúan como teléfono ni tarjeta.
  const amountSpans = [...reply.matchAll(AMOUNT_RE)].map((m) => [m.index!, m.index! + m[0].length] as const);
  const insideAmount = (m: RegExpMatchArray) =>
    amountSpans.some(([a, b]) => m.index! < b && m.index! + m[0].length > a);
  const known = `${customerText}\n${businessFacts}`;
  const knownLower = known.toLowerCase();
  const knownPhones = new Set([...known.matchAll(PHONE_RE)].map((m) => lastDigits(m[0])));
  for (const m of reply.matchAll(EMAIL_RE)) {
    if (!knownLower.includes(m[0].toLowerCase())) findings.push({ rule: "foreign_email", verdict: "block", detail: { value: m[0] } });
  }
  for (const m of reply.matchAll(PHONE_RE)) {
    if (insideAmount(m)) continue;
    if (!knownPhones.has(lastDigits(m[0]))) findings.push({ rule: "foreign_phone", verdict: "block", detail: { value: m[0] } });
  }
  for (const m of reply.matchAll(RUT_RE)) {
    if (!digits(known).includes(digits(m[0]).slice(0, -1))) findings.push({ rule: "foreign_rut", verdict: "block", detail: { value: m[0] } });
  }
  for (const m of reply.matchAll(CARD_RE)) {
    if (insideAmount(m)) continue;
    const d = digits(m[0]);
    // Una tarjeta nunca se repite por chat, aunque la haya escrito el cliente.
    if (d.length >= 13 && luhn(d)) findings.push({ rule: "card_number", verdict: "block", detail: { last4: d.slice(-4) } });
  }

  // 3. Filtración de las reglas internas.
  const replyShingles = shingles(normalizeWords(reply));
  let overlap = 0;
  for (const s of replyShingles) if (PLATFORM_SHINGLES.has(s)) overlap++;
  if (overlap > 0 || LEAK_MARKERS.some((re) => re.test(reply))) {
    findings.push({ rule: "prompt_leak", verdict: "block", detail: { overlappingSpans: overlap } });
  }

  // 4. Formato de WhatsApp.
  if (reply.length > MAX_LENGTH) findings.push({ rule: "too_long", verdict: "warn", detail: { length: reply.length } });
  if (/^#{1,6}\s/m.test(reply) || /\|\s*-{3,}/.test(reply) || /```/.test(reply)) {
    findings.push({ rule: "markdown_format", verdict: "warn", detail: {} });
  }

  // 5. Intento de manipulación en lo que escribió el cliente (señal, no bloqueo).
  if (input.latestInbound && INJECTION_RE.some((re) => re.test(input.latestInbound!))) {
    findings.push({ rule: "injection_attempt", verdict: "warn", detail: {} });
  }

  const verdict: Verdict = findings.some((f) => f.verdict === "block") ? "block" : findings.length ? "warn" : "pass";
  return { verdict, findings, latencyMs: performance.now() - t0 };
}
