// server/utils/logger.ts
import util from "util";

export const DEBUG = process.env.DEBUG === "true";

function formatMessage(
  level: string,
  msg: string,
  meta?: Record<string, unknown>
) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${util.inspect(meta, { depth: 3 })}` : "";
  return `${timestamp} [${level}] ${msg}${metaStr}`;
}

export function logInfo(message: string, meta?: Record<string, unknown>) {
  console.info(formatMessage("INFO", message, meta));
}

export function logWarn(message: string, meta?: Record<string, unknown>) {
  console.warn(formatMessage("WARN", message, meta));
}

export function logError(
  context: string,
  err: unknown,
  meta?: Record<string, unknown>
) {
  const errMsg =
    err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  console.error(formatMessage("ERROR", `${context} - ${errMsg}`, meta));
}

export function logDebug(message: string, meta?: Record<string, unknown>) {
  if (DEBUG) console.debug(formatMessage("DEBUG", message, meta));
}
