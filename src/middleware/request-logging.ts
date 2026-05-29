/**
 * Request Logging Middleware
 *
 * Fire-and-forget logging to worker-logs. Only emits for error responses
 * (4xx → warn, 5xx → error). 2xx/3xx are intentionally silent: CF Workers
 * observability already captures per-request analytics, so access-log noise
 * is redundant and costs AppLogsDO invocations.
 */

import type { MiddlewareHandler } from "hono";

// worker-logs RPC binding type
export type LogsBinding = {
  info: (appId: string, msg: string, context?: Record<string, unknown>) => Promise<void>;
  warn: (appId: string, msg: string, context?: Record<string, unknown>) => Promise<void>;
  error: (appId: string, msg: string, context?: Record<string, unknown>) => Promise<void>;
};

/**
 * Build the request-logging middleware for the given app id.
 */
export function requestLogging(
  appId: string
): MiddlewareHandler<{ Bindings: { LOGS?: LogsBinding } }> {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const status = c.res.status;
    if (status < 400) return;
    const logs = c.env?.LOGS;
    if (!logs) return;
    const duration = Date.now() - start;
    const pathname = c.req.path;
    const context = {
      method: c.req.method,
      path: pathname,
      status,
      duration_ms: duration,
      user_agent: c.req.header("user-agent")?.slice(0, 100),
    };
    const logEntry = (
      status >= 500
        ? logs.error(appId, `${c.req.method} ${pathname}`, context)
        : logs.warn(appId, `${c.req.method} ${pathname}`, context)
    ).catch((err: unknown) => {
      console.error("[logging] Failed to send log:", err);
    });
    // c.executionCtx throws when no ExecutionContext is provided (e.g. in tests),
    // so guard with try/catch rather than optional chaining on the getter itself.
    try {
      c.executionCtx.waitUntil(logEntry);
    } catch {
      // No ExecutionContext available (local dev / test) — fire-and-forget without waitUntil
    }
  };
}
