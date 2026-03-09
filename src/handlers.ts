/**
 * Request handlers for arc0btc worker endpoints
 */

import type { Context } from "hono";
import { findAnswer } from "./knowledge";
import { detectAgent } from "./middleware/agent-detection";
import { renderFeedPage } from "./utils/markdown";
import {
  synthesizeDigest,
  detectPatterns,
  generateDigestSummary,
} from "./utils/digest";

// =============================================================================
// x402 Payment Verification (Stubbed for Phase 1)
// =============================================================================

/**
 * Check for x402 payment header and verify payment
 *
 * Phase 2: Parses x-402-payment header and validates format
 * Format: stx:{address}:{txid}:{amount}:{token}
 *
 * Note: Phase 2 trusts the header (no on-chain verification yet)
 * Future: Add on-chain tx verification via Stacks API
 */
function verifyX402Payment(c: Context): {
  verified: boolean;
  callerAddress?: string;
  amount?: number;
  token?: string;
  error?: string;
} {
  const paymentHeader = c.req.header("x-402-payment");

  if (!paymentHeader) {
    // No payment header - return payment required
    return {
      verified: false,
      error: "Payment required",
    };
  }

  console.log("[x402] Payment header present:", paymentHeader);

  // Parse header format: stx:{address}:{txid}:{amount}:{token}
  const parts = paymentHeader.split(":");

  if (parts.length < 5 || parts[0] !== "stx") {
    console.log("[x402] Invalid header format:", paymentHeader);
    return {
      verified: false,
      error: "Invalid payment header format (expected: stx:address:txid:amount:token)",
    };
  }

  const [, address, txid, amountStr, token] = parts;

  // Validate address (basic check: starts with SP or SM, 41 chars)
  if (!address.match(/^S[PM][0-9A-Z]{39}$/)) {
    console.log("[x402] Invalid Stacks address:", address);
    return {
      verified: false,
      error: "Invalid Stacks address in payment header",
    };
  }

  // Validate txid (64 hex chars with optional 0x prefix)
  const cleanTxid = txid.startsWith("0x") ? txid.slice(2) : txid;
  if (!cleanTxid.match(/^[0-9a-f]{64}$/i)) {
    console.log("[x402] Invalid transaction ID:", txid);
    return {
      verified: false,
      error: "Invalid transaction ID in payment header",
    };
  }

  // Validate amount (must be positive number)
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    console.log("[x402] Invalid amount:", amountStr);
    return {
      verified: false,
      error: "Invalid amount in payment header",
    };
  }

  if (!token) {
    console.log("[x402] Invalid token:", token);
    return {
      verified: false,
      error: "Invalid token in payment header",
    };
  }

  console.log(
    `[x402] Payment verified: ${amount} ${token} from ${address} (tx: ${cleanTxid})`
  );

  return {
    verified: true,
    callerAddress: address,
    amount,
    token,
  };
}

// =============================================================================
// Ask Arc Handler
// =============================================================================

export async function handleAskArc(c: Context): Promise<Response> {
  const payment = verifyX402Payment(c);

  if (!payment.verified) {
    return c.json(
      {
        error: "Payment required",
        code: "PAYMENT_REQUIRED",
        cost: 0.005,
        token: "STX",
      },
      402
    );
  }

  // Parse request body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch (error) {
    return c.json(
      {
        error: "Invalid JSON in request body",
        code: "INVALID_JSON",
      },
      400
    );
  }

  // Validate request schema
  if (!body || typeof body !== "object") {
    return c.json(
      {
        error: "Request body must be an object",
        code: "INVALID_REQUEST",
      },
      400
    );
  }

  const { question, context, category } = body as Record<string, unknown>;

  if (!question || typeof question !== "string") {
    return c.json(
      {
        error: "Missing or invalid 'question' field",
        code: "INVALID_REQUEST",
      },
      400
    );
  }

  if (question.length > 500) {
    return c.json(
      {
        error: "Question too long (max 500 characters)",
        code: "INVALID_REQUEST",
      },
      400
    );
  }

  if (context && typeof context !== "string") {
    return c.json(
      {
        error: "Invalid 'context' field (must be string)",
        code: "INVALID_REQUEST",
      },
      400
    );
  }

  if (typeof context === "string" && context.length > 1000) {
    return c.json(
      {
        error: "Context too long (max 1000 characters)",
        code: "INVALID_REQUEST",
      },
      400
    );
  }

  if (
    category &&
    !["clarity", "stacks", "agent-setup", "ecosystem"].includes(
      category as string
    )
  ) {
    return c.json(
      {
        error:
          "Invalid category (must be: clarity, stacks, agent-setup, ecosystem)",
        code: "INVALID_REQUEST",
      },
      400
    );
  }

  // Process query
  const startTime = Date.now();

  try {
    const result = findAnswer(question, category as string | undefined);
    const responseTime = Date.now() - startTime;

    console.log(
      `[ask-arc] Query processed in ${responseTime}ms: "${question.slice(0, 50)}..." -> confidence: ${result.confidence}`
    );

    return c.json({
      answer: result.answer,
      sources: result.sources,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("[ask-arc] Error processing query:", error);

    return c.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      500
    );
  }
}

// =============================================================================
// Feed Handlers
// =============================================================================

/**
 * Handle combined feed endpoint (all sources)
 */
export async function handleFeed(c: Context): Promise<Response> {
  const kv = (c.env as { FEEDS_KV?: KVNamespace })?.FEEDS_KV;
  if (!kv) {
    return c.json({ error: "Feed service not configured" }, 503);
  }

  try {
    const [upstream, trends, arxiv] = await Promise.all([
      kv.get("feed:upstream"),
      kv.get("feed:trends"),
      kv.get("feed:arxiv"),
    ]);

    const combined = [
      "# Arc Intelligence Feed",
      "",
      "## Upstream Activity (GitHub)",
      upstream || "No data available",
      "",
      "## Ecosystem Trends (X)",
      trends || "No data available",
      "",
      "## Research Papers (Arxiv)",
      arxiv || "No data available",
      "",
      "---",
      `*Updated: ${new Date().toISOString()}*`,
    ].join("\n");

    const agent = detectAgent(
      c.req.header("user-agent") || "",
      c.req.header("accept") || ""
    );

    if (agent.preferredFormat === "json") {
      return c.json({
        feeds: {
          upstream: upstream || null,
          trends: trends || null,
          arxiv: arxiv || null,
        },
        combined,
        timestamp: new Date().toISOString(),
      });
    } else if (agent.preferredFormat === "markdown") {
      return c.text(combined, 200, {
        "Content-Type": "text/markdown",
      });
    } else {
      return c.html(renderFeedPage("Combined Feed", combined));
    }
  } catch (error) {
    console.error("[feed] Error fetching combined feed:", error);
    return c.json({ error: "Failed to fetch feed data" }, 500);
  }
}

/**
 * Factory function that creates a feed handler for a given KV key and title.
 * Replaces the formerly duplicated handleFeedUpstream, handleFeedTrends, and
 * handleFeedArxiv functions with a single parameterized implementation.
 */
function createFeedHandler(kvKey: string, title: string) {
  const source = kvKey.replace("feed:", "");
  return async function (c: Context): Promise<Response> {
    const kv = (c.env as { FEEDS_KV?: KVNamespace })?.FEEDS_KV;
    if (!kv) {
      return c.json({ error: "Feed service not configured" }, 503);
    }

    try {
      const data = await kv.get(kvKey);

      if (!data) {
        return c.json({ error: "Feed not found" }, 404);
      }

      const agent = detectAgent(
        c.req.header("user-agent") || "",
        c.req.header("accept") || ""
      );

      if (agent.preferredFormat === "json") {
        return c.json({
          source,
          content: data,
          format: "markdown",
          timestamp: new Date().toISOString(),
        });
      } else if (agent.preferredFormat === "markdown") {
        return c.text(data, 200, {
          "Content-Type": "text/markdown",
        });
      } else {
        return c.html(renderFeedPage(title, data));
      }
    } catch (error) {
      console.error(`[${kvKey}] Error fetching feed:`, error);
      return c.json({ error: "Failed to fetch feed data" }, 500);
    }
  };
}

export const handleFeedUpstream = createFeedHandler("feed:upstream", "Upstream Activity");
export const handleFeedTrends = createFeedHandler("feed:trends", "Ecosystem Trends");
export const handleFeedArxiv = createFeedHandler("feed:arxiv", "Research Papers");

// =============================================================================
// Agent Card Handler
// =============================================================================

/**
 * Serve Arc's A2A agent card at /.well-known/agent.json
 *
 * Follows the AIBTC agent card schema for machine-readable agent discovery.
 * Enables other agents and platforms to understand Arc's capabilities,
 * identity, and available services without prior knowledge.
 */
export async function handleAgentCard(c: Context): Promise<Response> {
  const agentCard = {
    name: "Arc",
    description: "Autonomous agent on Stacks — Genesis Agent #1. Observes, decides, and acts on mainnet. Specializes in Clarity, Stacks ecosystem, and AIBTC platform.",
    url: "https://arc0btc.com",
    provider: {
      organization: "arc0.btc",
      url: "https://arc0btc.com",
    },
    version: "1.0.0",
    documentationUrl: "https://arc0.me/about/",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    identity: {
      bns: "arc0.btc",
      agent_id: 1,
      stx_address: "SP2GHQRCRMYY4S8PMBR49BEKX144VR437YT42SF3B",
      btc_address: "bc1qlezz2cgktx0t680ymrytef92wxksywx0jaw933",
      avatar_url: "https://arc0.me/avatar.png",
      platform: "https://aibtc.com",
      level: 2,
      level_name: "Genesis",
    },
    links: {
      github: "https://github.com/arc0btc/arc-starter",
      blog: "https://arc0.me",
      platform: "https://aibtc.com",
      website: "https://arc0btc.com",
      health: "https://arc0btc.com/health",
    },
    services: [
      {
        endpoint: "https://arc0btc.com/api/ask-arc",
        method: "POST",
        protocol: "x402",
        cost: { amount: 0.005, token: "STX" },
        description: "Ask Arc about Clarity, Stacks, and the AIBTC platform. Paid via x402.",
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        endpoint: "https://arc0btc.com/api/feed",
        method: "GET",
        cost: "free",
        description: "Combined intelligence feed: GitHub upstream, X trends, Arxiv papers.",
        outputModes: ["application/json", "text/markdown", "text/html"],
      },
      {
        endpoint: "https://arc0btc.com/api/feed/upstream",
        method: "GET",
        cost: "free",
        description: "GitHub upstream activity feed.",
        outputModes: ["application/json", "text/markdown"],
      },
      {
        endpoint: "https://arc0btc.com/api/feed/trends",
        method: "GET",
        cost: "free",
        description: "X/Twitter Stacks ecosystem trends feed.",
        outputModes: ["application/json", "text/markdown"],
      },
      {
        endpoint: "https://arc0btc.com/api/feed/arxiv",
        method: "GET",
        cost: "free",
        description: "Arxiv research papers feed (Bitcoin, AI, agents).",
        outputModes: ["application/json", "text/markdown"],
      },
      {
        endpoint: "https://arc0btc.com/api/feed/digest",
        method: "GET",
        cost: "free",
        description: "Synthesized digest with pattern detection across all sources.",
        outputModes: ["application/json", "text/markdown"],
      },
    ],
    skills: [
      {
        id: "ask-arc",
        name: "Ask Arc",
        description: "Answer questions about Clarity smart contracts, Stacks blockchain, and the AIBTC agent platform.",
        tags: ["clarity", "stacks", "aibtc", "knowledge", "x402"],
        examples: [
          "How do I write a Clarity fungible token?",
          "What is the x402 payment protocol?",
          "How do I register on AIBTC?",
        ],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        id: "feed-intelligence",
        name: "Intelligence Feed",
        description: "Curated feed of Stacks ecosystem activity: GitHub repos, X trends, and Arxiv papers.",
        tags: ["feed", "intelligence", "stacks", "research"],
        examples: [
          "What's happening in the Stacks ecosystem?",
          "What are the latest Stacks research papers?",
        ],
        inputModes: [],
        outputModes: ["application/json", "text/markdown"],
      },
    ],
    achievements: {
      onchain: ["Sender", "Connector", "Communicator"],
      engagement: ["Alive", "Attentive", "Dedicated", "Missionary", "Genesis"],
    },
  };

  return c.json(agentCard);
}

/**
 * Handle digest endpoint (synthesized feed with pattern detection)
 */
export async function handleFeedDigest(c: Context): Promise<Response> {
  const kv = (c.env as { FEEDS_KV?: KVNamespace })?.FEEDS_KV;
  if (!kv) {
    return c.json({ error: "Feed service not configured" }, 503);
  }

  try {
    const [upstream, trends, arxiv] = await Promise.all([
      kv.get("feed:upstream"),
      kv.get("feed:trends"),
      kv.get("feed:arxiv"),
    ]);

    const digestData = {
      upstream: upstream || "No data available",
      trends: trends || "No data available",
      arxiv: arxiv || "No data available",
    };

    const digest = synthesizeDigest(digestData);
    const patterns = detectPatterns(digestData);
    const summary = generateDigestSummary(digestData);

    const agent = detectAgent(
      c.req.header("user-agent") || "",
      c.req.header("accept") || ""
    );

    if (agent.preferredFormat === "json") {
      return c.json({
        digest,
        patterns,
        summary,
        timestamp: new Date().toISOString(),
      });
    } else if (agent.preferredFormat === "markdown") {
      // Include patterns at the top for markdown
      const withPatterns =
        patterns.length > 0
          ? `**Patterns Detected:**\n\n${patterns.map((p) => `- ${p}`).join("\n")}\n\n---\n\n${digest}`
          : digest;

      return c.text(withPatterns, 200, {
        "Content-Type": "text/markdown",
      });
    } else {
      // HTML with patterns highlighted
      const htmlContent =
        patterns.length > 0
          ? `<div style="background: #1a1500; padding: 1rem; border-left: 4px solid #FEC233; margin-bottom: 2rem;">
              <h3 style="margin-top: 0; color: #FEC233;">Patterns Detected</h3>
              <ul style="margin: 0; color: #E9D4CF;">
                ${patterns.map((p) => `<li>${p}</li>`).join("")}
              </ul>
            </div>
            ${digest}`
          : digest;

      return c.html(renderFeedPage("Intelligence Digest", htmlContent));
    }
  } catch (error) {
    console.error("[feed:digest] Error generating digest:", error);
    return c.json({ error: "Failed to generate digest" }, 500);
  }
}
