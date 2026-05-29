/**
 * Request handlers for arc0btc worker endpoints
 */

import type { Context } from "hono";
import { findAnswer } from "./knowledge";
import { buildPaymentRequired, verifyPayment, encodeBase64 } from "./lib/x402";

// =============================================================================
// Ask Arc Handler
// =============================================================================

export async function handleAskArc(c: Context): Promise<Response> {
  const PRICE_SATS = 250; // Quick tier default

  const paymentHeader = c.req.header("payment-signature");

  if (!paymentHeader) {
    const paymentRequired = buildPaymentRequired(
      `${new URL(c.req.url).origin}/api/ask-arc`,
      PRICE_SATS,
      "Ask Arc — knowledge base query"
    );

    return new Response(
      JSON.stringify({
        error: "Payment required",
        code: "PAYMENT_REQUIRED",
        pricing: {
          quick: { amount: 250, unit: "sats (sBTC)", model: "Haiku" },
          research: { amount: 2500, unit: "sats (sBTC)", model: "Sonnet" },
          deep: { amount: 10000, unit: "sats (sBTC)", model: "Opus" },
        },
      }),
      {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          "payment-required": paymentRequired.headers.get("payment-required") || "",
        },
      }
    );
  }

  const payment = await verifyPayment(paymentHeader, PRICE_SATS);

  if (!payment.success) {
    return c.json(
      {
        error: "Payment verification failed",
        code: "PAYMENT_FAILED",
        detail: payment.error,
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

    return new Response(
      JSON.stringify({
        answer: result.answer,
        sources: result.sources,
        confidence: result.confidence,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "payment-response": encodeBase64(
            JSON.stringify({
              success: true,
              payer: payment.payer,
              transaction: payment.txid,
            })
          ),
        },
      }
    );
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
        cost: [
          { tier: "Quick", amount: 250, unit: "sats", model: "Haiku" },
          { tier: "Research", amount: 2500, unit: "sats", model: "Sonnet" },
          { tier: "Deep", amount: 10000, unit: "sats", model: "Opus" },
        ],
        description: "Ask Arc about Clarity, Stacks, AIBTC, Bitcoin protocols, agent architecture. Tiered by depth.",
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        endpoint: "https://arc0btc.com/api/services/pr-review",
        method: "POST",
        protocol: "x402",
        cost: [
          { tier: "Standard", amount: 15000, unit: "sats", model: "Sonnet" },
          { tier: "Express", amount: 30000, unit: "sats", model: "Opus" },
        ],
        description: "Submit a GitHub PR URL for structured code review with severity labels and ERC-8004 attestation.",
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        endpoint: "https://arc0btc.com/api/research",
        method: "GET",
        protocol: "x402",
        cost: [
          { tier: "Latest", amount: 2500, unit: "sats (sBTC)" },
          { tier: "Historical", amount: 1000, unit: "sats (sBTC)" },
        ],
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

