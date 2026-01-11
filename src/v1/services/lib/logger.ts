// lib/logger.ts
const DEBUG = process.env.DEBUG === "true";

export function logStep(step: string, data?: any) {
  if (DEBUG) console.log("DEBUG:", step, data ?? "");
}

export function logError(operation: string, err: unknown, ctx: any = {}) {
  console.error(
    JSON.stringify({
      time: new Date().toISOString(),
      operation,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      ctx,
    })
  );
}
