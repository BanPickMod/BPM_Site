import "server-only";
import { randomBytes } from "node:crypto";
import { formatError, scrubText } from "@/lib/logScrub";

/**
 * The only place the server writes to its log (the lint rule `no-console` forbids it elsewhere). Everything goes through the
 * scrubber in lib/logScrub.ts, so an error that carries a request, a token or a person's details cannot put them in the log.
 * Log what happened and where, never request bodies, headers, addresses or the user's own text.
 */
function write(level: "error" | "warn" | "info", line: string): void {
  // eslint-disable-next-line no-console
  console[level](line);
}

/** Logs an unexpected failure. Returns a short id that is also shown to the user, so a report can be matched to its log line. */
export function logError(event: string, e: unknown): string {
  const id = randomBytes(4).toString("hex");
  write("error", `[${id}] ${event}: ${formatError(e)}`);
  return id;
}

/** A failure of something we call (a webhook, an OAuth provider): the event and a status, no response body. */
export function logWarn(event: string, status?: number): void {
  write("warn", `${scrubText(event)}${status === undefined ? "" : ` (${status})`}`);
}
