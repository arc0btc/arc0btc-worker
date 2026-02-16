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
  const env = c.env as { FEEDS_KV: KVNamespace };

  try {
    const [upstream, trends, arxiv] = await Promise.all([
      env.FEEDS_KV.get("feed:upstream"),
      env.FEEDS_KV.get("feed:trends"),
      env.FEEDS_KV.get("feed:arxiv"),
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
 * Handle upstream feed endpoint (GitHub activity)
 */
export async function handleFeedUpstream(c: Context): Promise<Response> {
  const env = c.env as { FEEDS_KV: KVNamespace };

  try {
    const data = await env.FEEDS_KV.get("feed:upstream");

    if (!data) {
      return c.json({ error: "Feed not found" }, 404);
    }

    const agent = detectAgent(
      c.req.header("user-agent") || "",
      c.req.header("accept") || ""
    );

    if (agent.preferredFormat === "json") {
      return c.json({
        source: "upstream",
        content: data,
        format: "markdown",
        timestamp: new Date().toISOString(),
      });
    } else if (agent.preferredFormat === "markdown") {
      return c.text(data, 200, {
        "Content-Type": "text/markdown",
      });
    } else {
      return c.html(renderFeedPage("Upstream Activity", data));
    }
  } catch (error) {
    console.error("[feed:upstream] Error fetching feed:", error);
    return c.json({ error: "Failed to fetch feed data" }, 500);
  }
}

/**
 * Handle trends feed endpoint (X activity)
 */
export async function handleFeedTrends(c: Context): Promise<Response> {
  const env = c.env as { FEEDS_KV: KVNamespace };

  try {
    const data = await env.FEEDS_KV.get("feed:trends");

    if (!data) {
      return c.json({ error: "Feed not found" }, 404);
    }

    const agent = detectAgent(
      c.req.header("user-agent") || "",
      c.req.header("accept") || ""
    );

    if (agent.preferredFormat === "json") {
      return c.json({
        source: "trends",
        content: data,
        format: "markdown",
        timestamp: new Date().toISOString(),
      });
    } else if (agent.preferredFormat === "markdown") {
      return c.text(data, 200, {
        "Content-Type": "text/markdown",
      });
    } else {
      return c.html(renderFeedPage("Ecosystem Trends", data));
    }
  } catch (error) {
    console.error("[feed:trends] Error fetching feed:", error);
    return c.json({ error: "Failed to fetch feed data" }, 500);
  }
}

/**
 * Handle arxiv feed endpoint (Research papers)
 */
export async function handleFeedArxiv(c: Context): Promise<Response> {
  const env = c.env as { FEEDS_KV: KVNamespace };

  try {
    const data = await env.FEEDS_KV.get("feed:arxiv");

    if (!data) {
      return c.json({ error: "Feed not found" }, 404);
    }

    const agent = detectAgent(
      c.req.header("user-agent") || "",
      c.req.header("accept") || ""
    );

    if (agent.preferredFormat === "json") {
      return c.json({
        source: "arxiv",
        content: data,
        format: "markdown",
        timestamp: new Date().toISOString(),
      });
    } else if (agent.preferredFormat === "markdown") {
      return c.text(data, 200, {
        "Content-Type": "text/markdown",
      });
    } else {
      return c.html(renderFeedPage("Research Papers", data));
    }
  } catch (error) {
    console.error("[feed:arxiv] Error fetching feed:", error);
    return c.json({ error: "Failed to fetch feed data" }, 500);
  }
}

/**
 * Handle digest endpoint (synthesized feed with pattern detection)
 */
export async function handleFeedDigest(c: Context): Promise<Response> {
  const env = c.env as { FEEDS_KV: KVNamespace };

  try {
    const [upstream, trends, arxiv] = await Promise.all([
      env.FEEDS_KV.get("feed:upstream"),
      env.FEEDS_KV.get("feed:trends"),
      env.FEEDS_KV.get("feed:arxiv"),
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
          ? `<div style="background: #fef3c7; padding: 1rem; border-radius: 6px; margin-bottom: 2rem;">
              <h3 style="margin-top: 0; color: #92400e;">Patterns Detected</h3>
              <ul style="margin: 0;">
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
