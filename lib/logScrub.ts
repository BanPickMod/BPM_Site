/**
 * What may reach the server log (docs/Privacy_Compliance_Additional_Plan.md, A7). An error object can carry anything the
 * failing code touched: a request URL with a query, a header, a database error quoting a row, a library echoing a token.
 * The log keeps the kind of failure and where it happened, and every value that could identify someone or open something is
 * replaced before the text is written. This is a safety net for what slips through: code should still not log request data.
 */

const RULES: [RegExp, string][] = [
  [/postgres(?:ql)?:\/\/\S+/gi, "[database-url]"],
  [/\bBearer\s+[A-Za-z0-9._~+\/=-]+/gi, "Bearer [token]"],
  [/\b(bpm_session|bpm_oauth\w*|session|cookie|authorization|\w*token|\w*secret|password|code)=[^;&\s"']+/gi, "$1=[redacted]"],
  [/([?&])(code|state|token|access_token|key|sig|signature)=[^&\s"')]+/gi, "$1$2=[redacted]"],
  [/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, "[email]"],
  [/\b\d-S2-\d-\d{3,}\b/g, "[handle]"],
  [/\b[A-Za-z0-9_]{2,24}#\d{4,5}\b/g, "[battletag]"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]"],
  [/\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b/gi, "[ip]"],
  [/(?<![\w:])(?:[0-9a-f]{1,4}:){1,7}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6})?(?![\w:])/gi, "[ip]"],
  [/([?])[^\s"')#]{3,}/g, "$1[query]"],
  [/\b[A-Za-z0-9_-]{40,}\b/g, "[secret]"],
];

export function scrubText(text: string): string {
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out;
}

const MAX_MESSAGE = 300;
const MAX_STACK_LINES = 4;

/** "Name [status code]: message" and the first stack lines, scrubbed and short. Never the error's other properties. */
export function formatError(e: unknown): string {
  if (!(e instanceof Error)) return scrubText(String(e)).slice(0, MAX_MESSAGE);
  const any = e as Error & { status?: unknown; code?: unknown };
  const tags = [typeof any.status === "number" ? any.status : null, typeof any.code === "string" ? any.code : null].filter((v) => v !== null).join(" ");
  const head = `${e.name}${tags ? ` [${tags}]` : ""}: ${scrubText(e.message).slice(0, MAX_MESSAGE)}`;
  const stack = (e.stack ?? "").split("\n").slice(1, 1 + MAX_STACK_LINES).map((l) => scrubText(l.trim()));
  return stack.length ? `${head}\n  ${stack.join("\n  ")}` : head;
}
