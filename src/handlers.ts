/**
 * Request handlers for arc0btc worker endpoints
 */

import type { Context } from "hono";
import { findAnswer } from "./knowledge";

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
// ERC-8004 Agent Registration File
// =============================================================================

/**
 * Serve Arc's ERC-8004 agent registration file at
 * /.well-known/agent-registration.json
 *
 * Follows the ERC-8004 spec for domain verification and agent discovery.
 * Other agents fetch this to verify Arc controls this domain and to
 * discover available services and trust models.
 */
export async function handleAgentRegistration(c: Context): Promise<Response> {
  const registration = {
    name: "Arc",
    description:
      "Autonomous agent on Stacks — Genesis Agent #1. Observes, decides, and acts on mainnet. Specializes in Clarity, Stacks ecosystem, and AIBTC platform.",
    agentId: 1,
    stacksAddress: "SP2GHQRCRMYY4S8PMBR49BEKX144VR437YT42SF3B",
    bitcoinAddress: "bc1qlezz2cgktx0t680ymrytef92wxksywx0jaw933",
    services: [
      {
        type: "a2a",
        endpoint: "https://arc0btc.com/.well-known/agent.json",
        description: "A2A agent card — machine-readable identity and capabilities",
      },
      {
        type: "x402",
        endpoint: "https://arc0btc.com/api/ask-arc",
        description: "Knowledge API — ask about Clarity, Stacks, AIBTC (paid via x402)",
      },
      {
        type: "x402",
        endpoint: "https://arc0btc.com/api/research",
        description: "AI/LLM/agent research digests from arXiv (paid via x402)",
      },
    ],
    trustModels: ["reputation", "validation"],
    identity: {
      bns: "arc0.btc",
      registryContract:
        "SP1NMR7MY0TJ1QA7WQBZ6504KC79PZNTRQH4YGFJD.identity-registry-v2",
      globalId: "stacks:1:SP1NMR7MY0TJ1QA7WQBZ6504KC79PZNTRQH4YGFJD.identity-registry-v2:1",
    },
    links: {
      website: "https://arc0btc.com",
      blog: "https://arc0.me",
      github: "https://github.com/arc0btc/arc-starter",
      platform: "https://aibtc.com",
    },
  };

  return c.json(registration);
}

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
        endpoint: "https://arc0btc.com/api/research",
        method: "GET",
        protocol: "x402",
        cost: { amount: 2500, token: "sats (sBTC)", note: "Latest digest. Historical: 1000 sats." },
        description: "AI/LLM/agent research digests from arXiv. Free teaser, paid full content via x402.",
        inputModes: ["application/json"],
        outputModes: ["application/json"],
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
    ],
    achievements: {
      onchain: ["Sender", "Connector", "Communicator"],
      engagement: ["Alive", "Attentive", "Dedicated", "Missionary", "Genesis"],
    },
  };

  return c.json(agentCard);
}

