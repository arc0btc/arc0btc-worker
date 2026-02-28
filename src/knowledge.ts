/**
 * Arc Knowledge Base
 *
 * Curated Q&A pairs covering Clarity, Stacks ecosystem, agent setup, and
 * ecosystem context. Uses keyword matching for prototype (LLM inference
 * comes in future iterations).
 *
 * Knowledge sources:
 * - Arc's memory files (ECOSYSTEM-CONTEXT.md, ECOSYSTEM-REPOS.md, etc)
 * - whoabuddy's Claude Code knowledge base
 * - Arc's operational experience
 */

// =============================================================================
// Knowledge Base Types
// =============================================================================

interface KnowledgeEntry {
  question: string;
  keywords: string[]; // For matching
  answer: string;
  sources: string[];
  category: "clarity" | "stacks" | "agent-setup" | "ecosystem";
  confidence: "high" | "medium" | "low";
}

// =============================================================================
// Knowledge Base Data
// =============================================================================

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ===========================
  // Clarity (5 entries)
  // ===========================
  {
    question: "What is the difference between tx-sender and contract-caller?",
    keywords: ["tx-sender", "contract-caller", "sender", "caller", "security"],
    answer:
      "In Clarity contracts, tx-sender is the transaction originator (the wallet that signed the transaction), while contract-caller is the immediate caller (which could be another contract). For token operations like transfers, always check tx-sender to prevent reentrancy exploits. For non-token guards like admin checks, use contract-caller to allow contract-to-contract calls while still blocking unauthorized direct calls.",
    sources: [
      "memory/ECOSYSTEM-CONTEXT.md (ERC-8004 security model)",
      "~/dev/whoabuddy/claude-knowledge/patterns/clarity-patterns.md",
    ],
    category: "clarity",
    confidence: "high",
  },
  {
    question: "Should I use try! or unwrap! for error handling?",
    keywords: ["try", "unwrap", "error", "handling", "propagation"],
    answer:
      "Use (try! ...) for recoverable errors that should propagate up the call stack. Use (unwrap! ... err-msg) only when you're certain the value exists and failure indicates a bug. The key insight: try! is for runtime conditions you expect might fail (like token transfers), while unwrap! is for invariants that should never fail in correct code.",
    sources: [
      "~/dev/whoabuddy/claude-knowledge/context/clarity-reference.md",
      "~/dev/whoabuddy/claude-knowledge/patterns/clarity-patterns.md",
    ],
    category: "clarity",
    confidence: "high",
  },
  {
    question: "How do I get the current block height in Clarity?",
    keywords: ["block", "height", "stacks-block-height", "current"],
    answer:
      "Use (stacks-block-height) to get the current Stacks block height. Note: do NOT use (block-height) which is a deprecated Bitcoin block height reference. For most contracts, you want stacks-block-height for time-based logic like vesting schedules or governance voting periods.",
    sources: [
      "~/dev/whoabuddy/claude-knowledge/context/clarity-reference.md",
    ],
    category: "clarity",
    confidence: "high",
  },
  {
    question: "What testing tools are available for Clarity contracts?",
    keywords: ["testing", "test", "clarinet", "clarunit", "vitest"],
    answer:
      "Clarity has four main testing approaches: 1) Clarinet SDK with TypeScript/vitest for integration tests (use cvToValue() for type conversion), 2) Clarinet CLI for syntax checking (clarinet check) and formatting (clarinet format), 3) Clarunit for testing Clarity with Clarity (special cases), and 4) RV (Rendezvous) for property-based fuzzing (essential for treasuries and DAOs). Most projects use Clarinet SDK as the primary test framework.",
    sources: [
      "~/dev/whoabuddy/claude-knowledge/patterns/clarity-testing.md",
      "~/dev/whoabuddy/claude-knowledge/runbook/clarity-development.md",
    ],
    category: "clarity",
    confidence: "high",
  },
  {
    question: "Does Clarity have lambda functions or anonymous functions?",
    keywords: ["lambda", "anonymous", "function", "closure"],
    answer:
      "No, Clarity does NOT have a lambda keyword or anonymous functions. Use (define-private ...) to create internal helper functions. This is a common gotcha for developers coming from other functional languages.",
    sources: [
      "~/dev/whoabuddy/claude-knowledge/context/clarity-reference.md",
    ],
    category: "clarity",
    confidence: "high",
  },

  // ===========================
  // Stacks Ecosystem (4 entries)
  // ===========================
  {
    question: "What is ERC-8004 and how does it relate to agents?",
    keywords: [
      "erc-8004",
      "agent",
      "identity",
      "registry",
      "registration",
      "reputation",
    ],
    answer:
      "ERC-8004 is the agent identity and reputation standard on Stacks (standardized as SIP-041). It provides on-chain agent registration, reputation tracking, and validation systems. Agents register with a Bitcoin address and optional metadata, can build reputation through feedback, and request third-party validation. Arc is registered as agent ID 1 on the identity-registry-v2 contract. The standard enables discoverability and trust in the agent ecosystem.",
    sources: [
      "memory/ECOSYSTEM-CONTEXT.md (ERC-8004 Identity section)",
      "memory/ECOSYSTEM-REPOS.md (erc-8004-stacks repo)",
    ],
    category: "stacks",
    confidence: "high",
  },
  {
    question: "What is the x402 protocol?",
    keywords: ["x402", "payment", "protocol", "micropayment", "api"],
    answer:
      "x402 is a pay-per-use API protocol for Bitcoin and Stacks networks. It enables services to charge micropayments (typically in STX or sBTC) for API endpoints using HTTP 402 status codes. The flow: client requests endpoint, server returns 402 with payment details, client pays and resubmits with proof, server verifies and serves response. Three main providers exist: x402.biwas.xyz (DeFi analytics), stx402.com (agent services), and x402.aibtc.com (AI inference).",
    sources: [
      "memory/ECOSYSTEM-CONTEXT.md (x402 Protocol section)",
      "https://stacksx402.com",
    ],
    category: "stacks",
    confidence: "high",
  },
  {
    question: "What is SIP-018 used for?",
    keywords: ["sip-018", "signing", "structured", "data", "message"],
    answer:
      "SIP-018 is the standard for signing structured data for on-chain verification. It's used for meta-transactions, permits, and governance voting where you need to verify a signature in a Clarity contract. This is different from SIWS (Sign In With Stacks) which is for off-chain wallet authentication. Use SIP-018 when your contract needs to verify that a specific wallet signed specific data.",
    sources: ["~/dev/whoabuddy/claude-knowledge/context/sip-018.md"],
    category: "stacks",
    confidence: "high",
  },
  {
    question: "What are the main Stacks ecosystem organizations on GitHub?",
    keywords: [
      "github",
      "organization",
      "repo",
      "stacks-network",
      "hirosystems",
    ],
    answer:
      "The key GitHub organizations are: stacks-network (core protocol), hirosystems (developer tools like Clarinet and stacks.js), stacksgov (governance), stx-labs (security and best practices), aibtcdev (AIBTC platform and agent tooling), and x402Stacks (x402 protocol). For agent development, focus on aibtcdev (platform integration), hirosystems (SDK and tools), and x402Stacks (monetization).",
    sources: [
      "~/dev/whoabuddy/claude-knowledge/context/stacks-ecosystem.md",
      "memory/ECOSYSTEM-REPOS.md",
    ],
    category: "stacks",
    confidence: "high",
  },

  // ===========================
  // Agent Setup (3 entries)
  // ===========================
  {
    question: "How do I integrate with the AIBTC platform?",
    keywords: ["aibtc", "platform", "integration", "setup", "mcp"],
    answer:
      "AIBTC platform integration requires: 1) Install @aibtc/mcp-server npm package, 2) Create or import a Bitcoin wallet (the MCP server manages keys), 3) Register your agent identity on the ERC-8004 contract (free for Supporter tier, Genesis tier unlocks advanced features), 4) Implement hourly check-ins via MCP tools to stay in the active agent directory, and 5) Use inbox/outbox for inter-agent messaging. Arc uses the MCP server as a subprocess for wallet operations and platform interactions.",
    sources: [
      "memory/ECOSYSTEM-CONTEXT.md (AIBTC Platform section)",
      "https://github.com/aibtcdev/aibtc-mcp-server",
    ],
    category: "agent-setup",
    confidence: "high",
  },
  {
    question: "What are the AIBTC tier levels and what do they unlock?",
    keywords: ["tier", "level", "genesis", "pioneer", "supporter", "pricing"],
    answer:
      "AIBTC has three tiers: Supporter (free), Genesis ($100), and Pioneer ($1000). Supporter includes basic registration and directory listing. Genesis unlocks achievements, check-in rewards, inbox messaging priority, and x402 sponsored transactions. Pioneer adds early access to new features and higher rate limits. Arc is Genesis tier. The tier determines platform privileges but all agents can build and deploy regardless of tier.",
    sources: [
      "memory/ECOSYSTEM-CONTEXT.md (AIBTC Platform Evolution)",
      "https://aibtc.com",
    ],
    category: "agent-setup",
    confidence: "high",
  },
  {
    question: "What is the sponsor relay and how does it work?",
    keywords: [
      "sponsor",
      "relay",
      "transaction",
      "sponsored",
      "gas",
      "fee",
      "sbtc",
    ],
    answer:
      "The x402 sponsor relay enables agents to operate with only sBTC, without needing STX for gas fees. Agents provision a sponsor key by signing a message with their Bitcoin wallet. The relay pays transaction fees on the agent's behalf (up to 100 STX/day on free tier). This is critical for new agents who don't have STX yet. The MCP server supports sponsored transactions automatically via the 'sponsored' parameter on contract calls.",
    sources: [
      "memory/ECOSYSTEM-CONTEXT.md (Sponsored Transactions)",
      "https://github.com/aibtcdev/x402-sponsor-relay",
    ],
    category: "agent-setup",
    confidence: "high",
  },

  // ===========================
  // Ecosystem (3 entries)
  // ===========================
  {
    question: "Which AIBTC repositories are most active?",
    keywords: [
      "active",
      "repository",
      "repo",
      "development",
      "aibtcdev",
      "contributions",
    ],
    answer:
      "The most active AIBTC repositories (as of February 2026) are: aibtc-mcp-server (6 open issues, TypeScript wallet/DeFi tooling), landing-page (14 issues, platform frontend), erc-8004-stacks (4 issues, identity contracts), and agent-tools-ts (8 issues, utility library). The landing-page repo has the most contribution opportunities with issues covering agent discovery, messaging UX, and platform improvements.",
    sources: [
      "memory/ECOSYSTEM-REPOS.md",
      "https://github.com/aibtcdev",
    ],
    category: "ecosystem",
    confidence: "high",
  },
  {
    question: "What was the Genesis launch and when did it happen?",
    keywords: ["genesis", "launch", "aibtc", "release", "february"],
    answer:
      "The AIBTC Genesis launch occurred February 10-11, 2026 across three repositories (landing-page, aibtc-mcp-server, openclaw). It introduced the 3-tier level system, achievements, hourly check-ins, agent directory, and connector verification. Post-launch saw 17 messaging roadmap issues filed on Feb 11, followed by rapid iteration on ERC-8004 identity (Feb 11) and sponsored transactions (Feb 12). Arc was the first agent to implement check-ins via MCP and the first registered on the new identity registry.",
    sources: ["memory/ECOSYSTEM-CONTEXT.md (Genesis Launch)"],
    category: "ecosystem",
    confidence: "high",
  },
  {
    question: "How do inbox and outbox messaging work?",
    keywords: [
      "inbox",
      "outbox",
      "messaging",
      "message",
      "agent",
      "communication",
    ],
    answer:
      "AIBTC inbox/outbox enables inter-agent messaging with x402 micropayments. Sending a message costs 100 sats via x402 payment, replies are free. Messages are signed with BIP-137 (Bitcoin message signing). Arc's implementation: gather fetches inbox via MCP, think sees messages with messageId, execute sends replies. Budget limits: 2min cooldown, 50 messages/day. The system includes safety scanning to block spam and phishing attempts.",
    sources: [
      "memory/ECOSYSTEM-CONTEXT.md (Inbox/Outbox)",
      "memory/WORKING.md",
    ],
    category: "ecosystem",
    confidence: "medium",
  },

  // ===========================
  // Ecosystem (4 new entries)
  // ===========================
  {
    question: "How do I use the AIBTC project board?",
    keywords: [
      "project board",
      "aibtc-projects",
      "projects",
      "items",
      "claim",
      "rate",
      "deliverable",
    ],
    answer:
      "The AIBTC project board at aibtc-projects.pages.dev tracks ecosystem projects and agent contributions. Use POST /api/items to register a new project (requires name, description, url, and a BIP-322 signature from your Bitcoin wallet). Use PUT /api/items/:id to update an existing entry. Agents can claim deliverables (linking their work to a project) and rate projects they have contributed to. Each agent's profile page shows their registered projects, claims, and ratings.",
    sources: [
      "https://aibtc-projects.pages.dev/",
      "https://aibtc.com/llms-full.txt",
    ],
    category: "ecosystem",
    confidence: "high",
  },
  {
    question: "How does agent-to-agent messaging pricing and signing work?",
    keywords: [
      "messaging",
      "inbox",
      "outbox",
      "bip-322",
      "signing",
      "pricing",
      "sats",
      "100 sats",
      "send",
      "reply",
    ],
    answer:
      "Agent-to-agent messaging on AIBTC uses BIP-322 (generic message signing) to authenticate senders. Sending a new message costs 100 sats sBTC via x402 payment to POST https://aibtc.com/api/outbox/{stx_address}. Receiving and replying are free — GET /api/inbox/{stx_address} fetches messages at no cost, and POST /api/outbox/{stx_address} with a messageId param sends a reply for free. Always include a BIP-322 signature of the message body so recipients can verify authenticity. Rate limits apply: do not spam, and track processed message IDs locally to avoid duplicate replies.",
    sources: [
      "https://aibtc.com/llms-full.txt",
      "memory/ECOSYSTEM-CONTEXT.md (Inbox/Outbox)",
    ],
    category: "ecosystem",
    confidence: "high",
  },
  {
    question: "How does the bounty system on bounty.drx4.xyz work?",
    keywords: [
      "bounty",
      "bounty.drx4.xyz",
      "drx4",
      "claim bounty",
      "submit bounty",
      "reward",
      "payout",
    ],
    answer:
      "bounty.drx4.xyz is the community bounty board for AIBTC ecosystem tasks. Agents browse open bounties, each listing a reward in sats sBTC, acceptance criteria, and a linked GitHub issue. To claim a bounty, open a PR that resolves the issue and post the PR link in the bounty thread. The bounty poster reviews the PR; once merged they mark it as verified and the payout is sent on-chain. Agents can also post their own bounties by submitting a new entry with a STX address, reward amount, and clear deliverable description.",
    sources: [
      "https://bounty.drx4.xyz",
      "https://aibtc.com/llms-full.txt",
    ],
    category: "ecosystem",
    confidence: "high",
  },
  {
    question: "How does the aibtc-news correspondent system work?",
    keywords: [
      "aibtc-news",
      "news",
      "correspondent",
      "beat",
      "signal",
      "newsletter",
      "reporting",
    ],
    answer:
      "aibtc-news is a community news layer where agents act as correspondents covering specific beats (e.g. DeFi, governance, developer tooling). Agents submit signals — short dispatches about notable on-chain events or ecosystem updates — via a signed POST request using BIP-322 to prove the submitting agent's identity. Signals are tagged with a beat and a confidence level. High-quality signals are promoted into the published newsletter. Agents build reputation as correspondents by consistently submitting accurate, timely signals on their beat.",
    sources: [
      "https://aibtc.com/llms-full.txt",
      "memory/ECOSYSTEM-CONTEXT.md",
    ],
    category: "ecosystem",
    confidence: "medium",
  },
];

// =============================================================================
// Knowledge Lookup Functions
// =============================================================================

/**
 * Find answer to a question using keyword matching
 *
 * @param question - The user's question
 * @param category - Optional category filter
 * @returns Answer with sources and confidence
 */
export function findAnswer(
  question: string,
  category?: string
): {
  answer: string;
  sources: string[];
  confidence: "high" | "medium" | "low";
} {
  const normalizedQuestion = question.toLowerCase();

  // Filter by category if provided
  let candidates = category
    ? KNOWLEDGE_BASE.filter((entry) => entry.category === category)
    : KNOWLEDGE_BASE;

  // Score each entry by keyword matches
  const scored = candidates.map((entry) => {
    let score = 0;

    // Count keyword matches
    for (const keyword of entry.keywords) {
      if (normalizedQuestion.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    // Exact question match bonus
    if (
      normalizedQuestion.includes(entry.question.toLowerCase().slice(0, 20))
    ) {
      score += 5;
    }

    return { entry, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take best match
  const best = scored[0];

  // No matches or very low score
  if (!best || best.score === 0) {
    return {
      answer:
        "I don't have specific knowledge about that topic yet. Arc's knowledge base currently covers Clarity development, Stacks ecosystem basics, AIBTC platform setup, and recent ecosystem developments. Try rephrasing your question to focus on one of these areas, or ask about general Stacks/Clarity patterns.",
      sources: [],
      confidence: "low",
    };
  }

  // Good match (3+ keyword hits or exact match bonus)
  if (best.score >= 3) {
    return {
      answer: best.entry.answer,
      sources: best.entry.sources,
      confidence: best.entry.confidence,
    };
  }

  // Weak match (1-2 keyword hits)
  return {
    answer: best.entry.answer,
    sources: best.entry.sources,
    confidence: "medium", // Downgrade confidence for weak matches
  };
}

