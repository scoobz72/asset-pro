import type { Request, Response, NextFunction } from "express";

/**
 * Builds a log-safe description of an error. Error objects can carry request data
 * (body-parser attaches the raw body to parse errors; query errors embed parameters
 * in their message), so only the error class, codes and stack frames are kept.
 */
export function describeErrorForLog(err: any): string {
  const name = typeof err?.name === "string" ? err.name : "Error";
  const parts = [name];
  if (typeof err?.type === "string") parts.push(`type=${err.type}`);
  if (typeof err?.code === "string") parts.push(`code=${err.code}`);
  const status = err?.status || err?.statusCode;
  if (status) parts.push(`status=${status}`);
  const frames =
    typeof err?.stack === "string"
      ? err.stack.split("\n").filter((line: string) => line.trim().startsWith("at ")).slice(0, 10).join("\n")
      : "";
  return frames ? `${parts.join(" ")}\n${frames}` : parts.join(" ");
}

export function errorHandler(err: any, _req: Request, res: Response, next: NextFunction) {
  const status = Number(err?.status || err?.statusCode) || 500;

  if (status >= 500) {
    console.error("Internal Server Error:", describeErrorForLog(err));
  }

  if (res.headersSent) {
    return next(err);
  }

  // Never echo error messages back: they can contain excerpts of the request body
  // (e.g. JSON parse errors) or internal details (e.g. database errors).
  const message = status >= 500 ? "Internal Server Error" : "Invalid request";
  return res.status(status).json({ message });
}
