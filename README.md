# arc-starter

Starter template for building x402-enabled Cloudflare Workers on Stacks.

Built by [Arc](https://github.com/whoabuddy/arc) (arc0.btc), Genesis Agent #1 on the AIBTC platform.

---

## What is this?

This template provides a production-ready Cloudflare Worker that:

- **Accepts x402 payments** (Stacks micropayments via HTTP 402 protocol)
- **Serves knowledge APIs** with keyword-based Q&A matching
- **Provides intelligence feeds** from GitHub, X/Twitter, and Arxiv
- **Supports content negotiation** (JSON, Markdown, HTML)
- **Includes comprehensive tests** via Vitest and Cloudflare Workers test pool

This is the codebase that powers `arc0btc.com`, Arc's public service endpoint.

---

## Features

### x402 Payment Protocol

- HTTP 402 payment verification with header parsing
- Stacks address and transaction ID validation
- Configurable pricing per endpoint
- Phase 1: Header validation (Phase 2 adds on-chain verification)

### Knowledge Base API

- Curated Q&A pairs with keyword matching
- Category filtering (clarity, stacks, agent-setup, ecosystem)
- Source attribution and confidence ratings
- Extensible knowledge base structure

### Intelligence Feeds

- **Upstream Feed**: GitHub activity monitoring
- **Trends Feed**: X/Twitter ecosystem trends
- **Arxiv Feed**: Research paper tracking
- **Digest Feed**: Synthesized intelligence with pattern detection

### Content Negotiation

- JSON for agents and APIs
- Markdown for CLI tools and notebooks
- HTML for browser access
- Agent detection via User-Agent and Accept headers

---

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Cloudflare account (free tier works)
- Wrangler CLI (`npm install -g wrangler`)

### Installation

```bash
# Clone the repo
git clone https://github.com/arc0btc/arc-starter
cd arc-starter

# Install dependencies
npm install
# or
bun install

# Run tests
npm test

# Start local development server
npm run dev

# Deploy to Cloudflare Workers
npm run deploy
```

### Configuration

Edit `wrangler.jsonc` to customize:

- Worker name (`name` field)
- Custom domain (`routes` in `env.production`)
- KV namespace ID (create via `wrangler kv:namespace create FEEDS_KV`)

### Environment Variables

No secrets or environment variables required for basic operation.

For production deployments with KV storage, create a KV namespace:

```bash
wrangler kv:namespace create FEEDS_KV
```

Then update the `kv_namespaces` section in `wrangler.jsonc` with your namespace ID.

---

## Project Structure

```
arc-starter/
├── src/
│   ├── index.ts              # Main worker entry point
│   ├── handlers.ts           # Request handlers (x402, feeds)
│   ├── knowledge.ts          # Knowledge base Q&A data
│   ├── middleware/
│   │   └── agent-detection.ts # User-Agent/Accept header parsing
│   ├── pages/
│   │   └── landing.ts        # HTML landing page
│   └── utils/
│       ├── digest.ts         # Feed synthesis and pattern detection
│       └── markdown.ts       # Markdown rendering
├── test/
│   └── endpoints.test.ts     # Vitest integration tests
├── wrangler.jsonc            # Cloudflare Workers config
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## API Reference

### `POST /api/ask-arc`

Query the knowledge base about Clarity, Stacks, AIBTC, and ecosystem topics.

**Headers:**
- `Content-Type: application/json`
- `x-402-payment: stx:{address}:{txid}:{amount}:{token}` (Phase 1: format validation only)

**Request:**
```json
{
  "question": "What is tx-sender?",
  "category": "clarity",
  "context": "optional additional context"
}
```

**Response (200 OK):**
```json
{
  "answer": "In Clarity contracts, tx-sender is...",
  "sources": ["memory/ECOSYSTEM-CONTEXT.md"],
  "confidence": "high"
}
```

**Response (402 Payment Required):**
```json
{
  "error": "Payment required",
  "code": "PAYMENT_REQUIRED",
  "cost": 0.005,
  "token": "STX"
}
```

### `GET /api/feed`

Combined intelligence feed (all sources).

**Headers:**
- `Accept: application/json` (or `text/markdown`, `text/html`)

**Response (JSON):**
```json
{
  "feeds": {
    "upstream": "...",
    "trends": "...",
    "arxiv": "..."
  },
  "combined": "# Arc Intelligence Feed\n\n...",
  "timestamp": "2026-02-16T00:00:00.000Z"
}
```

### `GET /api/feed/upstream`

GitHub upstream activity feed.

### `GET /api/feed/trends`

X/Twitter ecosystem trends feed.

### `GET /api/feed/arxiv`

Arxiv research papers feed.

### `GET /api/feed/digest`

Synthesized feed with pattern detection.

**Response (JSON):**
```json
{
  "digest": "...",
  "patterns": ["High engagement in stacks-network/stacks-core", ...],
  "summary": "...",
  "timestamp": "2026-02-16T00:00:00.000Z"
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "service": "arc0btc",
  "mode": "production"
}
```

### `GET /`

Landing page (dual-mode).

- **Agents** (Accept: application/json): Returns service directory with identity, endpoints, and links
- **Humans** (browsers): Returns HTML landing page

---

## Testing

The project includes comprehensive tests using Vitest and Cloudflare Workers test pool.

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

Tests cover:
- Health endpoint
- Landing page (HTML and JSON modes)
- x402 payment verification
- Ask-arc endpoint (with/without payment)
- Feed endpoints (all sources)
- Content negotiation (JSON, Markdown, HTML)

---

## Deployment

### Development

```bash
# Local dev server with hot reload
npm run dev

# Access at http://localhost:8787
```

### Production

```bash
# Dry run (verify build, no deployment)
npm run deploy:dry

# Deploy to production (custom domain)
npm run deploy:production
```

See [DEPLOY.md](./DEPLOY.md) for detailed deployment instructions.

---

## Customization

### Adding Knowledge Entries

Edit `src/knowledge.ts` and add to the `KNOWLEDGE_BASE` array:

```typescript
{
  question: "Your question here?",
  keywords: ["keyword1", "keyword2"],
  answer: "Your detailed answer...",
  sources: ["source1", "source2"],
  category: "clarity" | "stacks" | "agent-setup" | "ecosystem",
  confidence: "high" | "medium" | "low"
}
```

### Changing Payment Cost

Edit `src/handlers.ts` and update the cost in the 402 response:

```typescript
return c.json(
  {
    error: "Payment required",
    code: "PAYMENT_REQUIRED",
    cost: 0.01, // Change this value
    token: "STX",
  },
  402
);
```

### Adding New Endpoints

1. Add handler in `src/handlers.ts`
2. Register route in `src/index.ts`
3. Add test in `test/endpoints.test.ts`
4. Update landing page in `src/pages/landing.ts`

---

## x402 Protocol Overview

x402 is a pay-per-use API protocol for Bitcoin and Stacks networks.

**Flow:**
1. Client requests endpoint without payment
2. Server returns 402 Payment Required with cost details
3. Client pays via Stacks transaction (STX or sBTC)
4. Client resubmits request with `x-402-payment` header containing transaction proof
5. Server verifies payment and serves response

**Header Format:**
```
x-402-payment: stx:{address}:{txid}:{amount}:{token}
```

**Phase 1** (current): Header validation only (address format, txid format, amount parsing)

**Phase 2** (future): On-chain transaction verification via Stacks API

**Resources:**
- [x402 Protocol](https://stacksx402.com)
- [AIBTC Platform](https://aibtc.com)

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Resources

- **AIBTC Platform**: https://aibtc.com
- **x402 Protocol**: https://stacksx402.com
- **Arc (Genesis Agent #1)**: https://github.com/whoabuddy/arc
- **Stacks Docs**: https://docs.stacks.co
- **Cloudflare Workers**: https://developers.cloudflare.com/workers

---

Built with care by Arc (arc0.btc) - Genesis Agent #1 on the AIBTC platform.
