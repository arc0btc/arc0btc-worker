import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  handleAskArc,
  handleAgentCard,
} from "./handlers";
import { landingPage } from "./pages/landing";
import { detectAgent } from "./middleware/agent-detection";

// worker-logs RPC binding type
type LogsBinding = {
  info: (appId: string, msg: string, context?: Record<string, unknown>) => Promise<void>;
  warn: (appId: string, msg: string, context?: Record<string, unknown>) => Promise<void>;
  error: (appId: string, msg: string, context?: Record<string, unknown>) => Promise<void>;
};

const APP_ID = "arc0btc-worker";

const app = new Hono();

// Enable CORS for cross-origin requests
app.use("*", cors());

// Request logging middleware — fire-and-forget to worker-logs
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const logs = (c.env as { LOGS?: LogsBinding } | undefined)?.LOGS;
  if (logs) {
    const duration = Date.now() - start;
    const ctx = c.executionCtx;
    const logEntry = logs.info(APP_ID, `${c.req.method} ${new URL(c.req.url).pathname}`, {
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      duration_ms: duration,
      user_agent: c.req.header("user-agent")?.slice(0, 100),
    }).catch((err: unknown) => {
      console.error("[logging] Failed to send log:", err);
    });
    if (ctx?.waitUntil) {
      ctx.waitUntil(logEntry);
    }
  }
});

// Landing page (dual-mode: JSON for agents, HTML for humans)
app.get("/", (c) => {
  const agent = detectAgent(
    c.req.header("user-agent") || "",
    c.req.header("accept") || ""
  );

  if (agent.isAgent && agent.preferredFormat === "json") {
    return c.json({
      identity: {
        name: "Arc",
        bns: "arc0.btc",
        agent_id: 1,
        description: "Autonomous agent on Stacks • Genesis Agent #1",
        stx_address: "SP2GHQRCRMYY4S8PMBR49BEKX144VR437YT42SF3B",
        btc_address: "bc1qlezz2cgktx0t680ymrytef92wxksywx0jaw933",
        avatar_url: "https://arc0.me/avatar.png",
      },
      services: [
        {
          endpoint: "/api/ask-arc",
          method: "POST",
          cost: { amount: 0.005, token: "STX" },
          description: "Ask Arc about Clarity, Stacks, AIBTC platform",
        },
      ],
      links: {
        github: "https://github.com/arc0btc/arc-starter",
        blog: "https://arc0.me",
        platform: "https://aibtc.com",
        health: "/health",
      },
      contentNegotiation: {
        supported: ["application/json", "text/markdown", "text/html"],
        note: "Use Accept header to request preferred format",
      },
    });
  }

  return c.html(landingPage());
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    version: "0.2.0",
    service: "arc0btc",
    mode: "production",
  });
});

// A2A Agent card endpoint (machine-readable identity + capabilities)
app.get("/.well-known/agent.json", handleAgentCard);

// Ask Arc endpoint (x402 paid)
app.post("/api/ask-arc", handleAskArc);

export default app;
