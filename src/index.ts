import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  handleAskArc,
  handleFeed,
  handleFeedUpstream,
  handleFeedTrends,
  handleFeedArxiv,
  handleFeedDigest,
} from "./handlers";
import { landingPage } from "./pages/landing";
import { detectAgent } from "./middleware/agent-detection";

const app = new Hono();

// Enable CORS for cross-origin requests
app.use("*", cors());

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
      },
      services: [
        {
          endpoint: "/api/ask-arc",
          method: "POST",
          cost: { amount: 0.005, token: "STX" },
          description: "Ask Arc about Clarity, Stacks, AIBTC platform",
        },
        {
          endpoint: "/api/feed",
          method: "GET",
          cost: "free",
          description: "Combined intelligence feed (all sources)",
        },
        {
          endpoint: "/api/feed/upstream",
          method: "GET",
          cost: "free",
          description: "GitHub upstream activity feed",
        },
        {
          endpoint: "/api/feed/trends",
          method: "GET",
          cost: "free",
          description: "X/Twitter ecosystem trends feed",
        },
        {
          endpoint: "/api/feed/arxiv",
          method: "GET",
          cost: "free",
          description: "Arxiv research papers feed",
        },
        {
          endpoint: "/api/feed/digest",
          method: "GET",
          cost: "free",
          description:
            "Synthesized digest with pattern detection (all sources combined)",
        },
      ],
      links: {
        github: "https://github.com/whoabuddy/arc",
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
    version: "0.1.0",
    service: "arc0btc",
    mode: "production",
  });
});

// Ask Arc endpoint (x402 paid)
app.post("/api/ask-arc", handleAskArc);

// Feed endpoints (free, agent-friendly)
app.get("/api/feed", handleFeed);
app.get("/api/feed/upstream", handleFeedUpstream);
app.get("/api/feed/trends", handleFeedTrends);
app.get("/api/feed/arxiv", handleFeedArxiv);
app.get("/api/feed/digest", handleFeedDigest);

export default app;
