import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  handleAskArc,
  handleAgentCard,
  handleAgentRegistration,
} from "./handlers";
import { detectAgent } from "./middleware/agent-detection";
import { requestLogging, type LogsBinding } from "./middleware/request-logging";
import { research } from "./routes/research";

// Assets binding from wrangler config (serves built React SPA)
type AssetsBinding = {
  fetch: (request: Request) => Promise<Response>;
};

type Bindings = {
  LOGS?: LogsBinding;
  ASSETS?: AssetsBinding;
  RESEARCH_KV: KVNamespace;
};

const APP_ID = "arc0btc-worker";

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for cross-origin requests
app.use("*", cors());

// Request logging middleware — fire-and-forget to worker-logs (errors only)
app.use("*", requestLogging(APP_ID));

// Landing page — JSON for agent clients, SPA for humans (served by assets binding)
app.get("/", (c) => {
  const agent = detectAgent(
    c.req.header("user-agent") || "",
    c.req.header("accept") || ""
  );

  // Agent clients get JSON service directory
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
          cost: [
            { tier: "Quick", amount: 250, unit: "sats", model: "Haiku" },
            { tier: "Research", amount: 2500, unit: "sats", model: "Sonnet" },
            { tier: "Deep", amount: 10000, unit: "sats", model: "Opus" },
          ],
          description: "Ask Arc about Clarity, Stacks, AIBTC, Bitcoin protocols, agent architecture",
        },
        {
          endpoint: "/api/services/pr-review",
          method: "POST",
          cost: [
            { tier: "Standard", amount: 15000, unit: "sats", model: "Sonnet" },
            { tier: "Express", amount: 30000, unit: "sats", model: "Opus" },
          ],
          description: "Structured code review with severity labels and ERC-8004 attestation",
        },
        {
          endpoint: "/api/research",
          method: "GET",
          cost: [
            { tier: "Latest", amount: 2500, unit: "sats (sBTC)" },
            { tier: "Historical", amount: 1000, unit: "sats (sBTC)" },
          ],
          description: "AI/LLM/agent research digests from arXiv (x402-gated)",
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

  // Human visitors — delegate to assets binding (React SPA)
  if (c.env?.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  // Fallback if assets not available (dev without build)
  return c.text("arc0btc.com — build the client first: bun run build:client", 500);
});

// Services page — serve SPA for human visitors, JSON catalog for agents
app.get("/services", (c) => {
  return c.redirect("/services/", 301);
});

app.get("/services/", (c) => {
  const agent = detectAgent(
    c.req.header("user-agent") || "",
    c.req.header("accept") || ""
  );

  if (agent.isAgent && agent.preferredFormat === "json") {
    return c.json({
      services: [
        {
          name: "Ask Arc",
          endpoint: "/api/ask-arc",
          method: "POST",
          protocol: "x402",
          tiers: [
            { tier: "Quick", cost: 250, unit: "sats", model: "Haiku", description: "Simple factual queries, quick lookups" },
            { tier: "Research", cost: 2500, unit: "sats", model: "Sonnet", description: "Synthesis, summaries, ecosystem questions" },
            { tier: "Deep", cost: 10000, unit: "sats", model: "Opus", description: "Architecture analysis, complex code review, strategy" },
          ],
          rateLimit: "20 questions/day",
        },
        {
          name: "PR Review",
          endpoint: "/api/services/pr-review",
          method: "POST",
          protocol: "x402",
          tiers: [
            { tier: "Standard", cost: 15000, unit: "sats", model: "Sonnet", description: "Correctness, style, suggestions" },
            { tier: "Express", cost: 30000, unit: "sats", model: "Opus", description: "Deep analysis, security, architecture" },
          ],
          rateLimit: "5 reviews/day",
        },
        {
          name: "Research Feed",
          endpoint: "/api/research",
          method: "GET",
          protocol: "x402",
          tiers: [
            { tier: "Latest", cost: 2500, unit: "sats (sBTC)", description: "Most recent digest" },
            { tier: "Historical", cost: 1000, unit: "sats (sBTC)", description: "Past digests by date" },
          ],
        },
      ],
    });
  }

  // Human visitors — serve SPA via assets binding
  if (c.env?.ASSETS) {
    // Rewrite to index.html so the SPA router handles /services/
    const url = new URL(c.req.url);
    url.pathname = "/";
    return c.env.ASSETS.fetch(new Request(url, c.req.raw));
  }

  return c.text("arc0btc.com — build the client first: bun run build:client", 500);
});

// Legal pages — serve SPA for human visitors
app.get("/legal", (c) => {
  return c.redirect("/legal/", 301);
});

app.get("/legal/*", (c) => {
  if (c.env?.ASSETS) {
    const url = new URL(c.req.url);
    url.pathname = "/";
    return c.env.ASSETS.fetch(new Request(url, c.req.raw));
  }
  return c.text("arc0btc.com — build the client first: bun run build:client", 500);
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

// ERC-8004 Agent registration file (domain verification + agent discovery)
app.get("/.well-known/agent-registration.json", handleAgentRegistration);

// x402 protocol discovery — advertises payment capabilities
app.get("/.well-known/x402", (c) => {
  return c.json({
    x402Version: 2,
    provider: "Arc (arc0.btc)",
    network: "stacks:1",
    relay: "https://x402-relay.aibtc.com",
    payTo: "SP2GHQRCRMYY4S8PMBR49BEKX144VR437YT42SF3B",
    asset: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
    endpoints: [
      { path: "/api/ask-arc", method: "POST", description: "Ask Arc — knowledge base queries" },
      { path: "/api/research", method: "GET", description: "Research feed — AI/LLM digests" },
    ],
  });
});

// Ask Arc endpoint (x402 paid)
app.post("/api/ask-arc", handleAskArc);

// Research feed endpoints (x402 paid)
app.route("/api/research", research);

export default app;
