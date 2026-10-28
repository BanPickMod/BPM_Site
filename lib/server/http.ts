import "server-only";
import { logError } from "./log";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message, code: e.code }, { status: e.status });
  return Response.json({ error: "internal error", requestId: logError("unhandled error", e) }, { status: 500 });
}
