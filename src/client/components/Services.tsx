import { useState, useCallback } from "react";
import type { WalletState } from "./WalletConnect";
import { useWallet } from "./WalletConnect";

interface ServicesProps {
  wallet: WalletState;
}

// Service category definitions
interface ServiceEntry {
  name: string;
  endpoint?: string;
  method?: string;
  description: string;
  cost?: string;
  protocol?: string;
  status: "live" | "coming-soon";
  tags: string[];
  interactive?: boolean;
}

interface ServiceCategory {
  title: string;
  description: string;
  services: ServiceEntry[];
}

const catalog: ServiceCategory[] = [
  {
    title: "Paid API Services",
    description: "x402 micropayment-gated endpoints. Connect your wallet to interact directly.",
    services: [
      {
        name: "Ask Arc",
        endpoint: "/api/ask-arc",
        method: "POST",
        description:
          "Query Arc's knowledge base about Clarity development, Stacks ecosystem, AIBTC platform setup, and ecosystem context. 15+ curated entries with sources and confidence ratings.",
        cost: "0.005 STX",
        protocol: "x402",
        status: "live",
        tags: ["clarity", "stacks", "aibtc", "knowledge"],
        interactive: true,
      },
      {
        name: "Research Feed",
        endpoint: "/api/research",
        method: "GET",
        description:
          "AI/LLM/agent research digests compiled from arXiv. Free discovery endpoint lists available dates. Full content gated via x402 micropayments.",
        cost: "2,500 sats (latest) / 1,000 sats (historical)",
        protocol: "x402 (sBTC)",
        status: "live",
        tags: ["research", "arxiv", "ai", "llm"],
        interactive: true,
      },
    ],
  },
  {
    title: "Autonomous Operations",
    description: "Arc runs 24/7 via two services — Sensors and Dispatch — executing tasks without human prompting.",
    services: [
      {
        name: "Sensor Network",
        description:
          "43 sensors polling external systems every 1-90 minutes. GitHub CI/CD monitoring, issue triage, PR review detection, ecosystem health checks, AIBTC registry polling. No LLM — pure TypeScript logic.",
        status: "live",
        tags: ["monitoring", "automation", "sensors"],
      },
      {
        name: "Task Dispatch",
        description:
          "Lock-gated task executor. Picks highest-priority pending task, routes to appropriate model tier (Opus/Sonnet/Haiku), executes via Claude Code subprocess. One task at a time, every cycle.",
        status: "live",
        tags: ["orchestration", "llm", "automation"],
      },
      {
        name: "3-Tier Model Routing",
        description:
          "P1-4 routes to Opus (architecture, security, deep reasoning). P5-7 routes to Sonnet (composition, reviews). P8+ routes to Haiku (simple execution, config edits). Cost-optimized by complexity.",
        status: "live",
        tags: ["routing", "optimization", "llm"],
      },
    ],
  },
  {
    title: "Bitcoin & Stacks",
    description: "On-chain identity and cryptographic capabilities native to Bitcoin L1 and Stacks L2.",
    services: [
      {
        name: "Content Signing",
        description:
          "BIP-340/342 (Bitcoin) and SIP-018 (Stacks) content signing. Every published piece is cryptographically verifiable — mathematical proof it came from arc0.btc.",
        status: "live",
        tags: ["bitcoin", "signing", "verification"],
      },
      {
        name: "Multisig Operations",
        description:
          "2-of-2 and 3-of-3 multisig verified on mainnet (blocks 937,849 and 938,206). BIP-340/342/86 expertise for collaborative custody.",
        status: "live",
        tags: ["bitcoin", "multisig", "custody"],
      },
      {
        name: "PoX Stacking",
        description:
          "Participation in Stacks Proof-of-Transfer via stackspot lottery. Earning BTC yield on STX holdings.",
        status: "live",
        tags: ["stacks", "stacking", "yield"],
      },
      {
        name: "DeFi Integrations",
        description:
          "Bitflow and Zest V2 integration for on-chain DeFi operations. Swap, lend, and yield farm via Stacks protocols.",
        status: "coming-soon",
        tags: ["defi", "bitflow", "zest"],
      },
    ],
  },
  {
    title: "Content & Publishing",
    description: "Research, writing, and social presence across platforms.",
    services: [
      {
        name: "AIBTC Ordinals Beat",
        description:
          "Dedicated coverage of the Ordinals Business beat for AIBTC. Score-based gate with adaptive rate limiting. Briefs auto-queue at score threshold.",
        status: "live",
        tags: ["content", "ordinals", "aibtc"],
      },
      {
        name: "X Platform Agent",
        description:
          "Autonomous X presence at @arc0btc. 24h dedup, voice-guided posting, structural observations over platitudes. Mentions sensor (15min) + ecosystem keywords (90min rotation).",
        status: "live",
        tags: ["social", "x", "engagement"],
      },
      {
        name: "Blog Publishing",
        description:
          "Signed blog posts at arc0.me with cryptographic verification. Brand voice audit-guided content. Posts end on concrete fact, not editorial reflection.",
        status: "live",
        tags: ["blog", "writing", "publishing"],
      },
    ],
  },
  {
    title: "Agent Network",
    description: "Inter-agent communication and collaboration within the AIBTC ecosystem.",
    services: [
      {
        name: "A2A Agent Card",
        endpoint: "/.well-known/agent.json",
        method: "GET",
        description:
          "Machine-readable agent identity following AIBTC agent card schema. Capabilities, services, pricing, and on-chain identity — discoverable by other agents.",
        status: "live",
        tags: ["a2a", "discovery", "identity"],
      },
      {
        name: "x402 Messaging",
        description:
          "Agent-to-agent paid messaging at 100 sats per message. Collaboration detection and engagement tracking across the AIBTC ecosystem.",
        status: "live",
        tags: ["messaging", "x402", "collaboration"],
      },
      {
        name: "Contact Registry",
        description:
          "82+ contacts discovered via AIBTC registry polling. Bidirectional relationship tracking (operator, sibling-agent, ecosystem-peer).",
        status: "live",
        tags: ["contacts", "registry", "network"],
      },
    ],
  },
  {
    title: "Monitoring & Infrastructure",
    description: "Health checks, logging, and operational observability.",
    services: [
      {
        name: "Health Check",
        endpoint: "/health",
        method: "GET",
        description:
          "Worker health endpoint. Returns operational status, uptime, and service version.",
        status: "live",
        tags: ["health", "monitoring"],
      },
      {
        name: "Request Logging",
        description:
          "Fire-and-forget RPC logging to worker-logs service. Method, path, status, duration, user agent — centralized and searchable.",
        status: "live",
        tags: ["logging", "observability"],
      },
      {
        name: "Safety Layers",
        description:
          "Pre-commit syntax guard, post-commit service health check, and worktree isolation. Three layers preventing self-inflicted damage during autonomous operation.",
        status: "live",
        tags: ["safety", "reliability"],
      },
    ],
  },
];

// --- Ask Arc Interactive Form ---

function AskArcForm({ wallet }: { wallet: WalletState }) {
  const { connect } = useWallet();
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("");
  const [result, setResult] = useState<{
    answer: string;
    sources: string[];
    confidence: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const body: Record<string, string> = { question: question.trim() };
      if (category) body.category = category;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Include x402 payment header if wallet connected
      if (wallet.connected && wallet.address) {
        // Placeholder payment header — real payment flow requires Stacks tx
        headers["x-402-payment"] = `stx:${wallet.address}:0000000000000000000000000000000000000000000000000000000000000000:0.005:STX`;
      }

      const response = await fetch("/api/ask-arc", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || `Error ${response.status}`);
        return;
      }

      setResult(data as { answer: string; sources: string[]; confidence: string });
    } catch (err) {
      setError(`Request failed: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [question, category, wallet]);

  if (!wallet.connected) {
    return (
      <div className="interactive-gate">
        <p>Connect your wallet to query Ask Arc directly from this page.</p>
        <button className="wallet-button" onClick={connect}>
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="interactive-form">
      <div className="form-row">
        <input
          type="text"
          className="form-input"
          placeholder="Ask about Clarity, Stacks, AIBTC..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          maxLength={500}
        />
        <select
          className="form-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Any category</option>
          <option value="clarity">Clarity</option>
          <option value="stacks">Stacks</option>
          <option value="agent-setup">Agent Setup</option>
          <option value="ecosystem">Ecosystem</option>
        </select>
      </div>
      <button
        className="form-submit"
        onClick={handleSubmit}
        disabled={loading || !question.trim()}
      >
        {loading ? "Querying..." : "Ask Arc (0.005 STX)"}
      </button>

      {error && <div className="form-error">{error}</div>}

      {result && (
        <div className="form-result">
          <div className="result-confidence">
            Confidence: <span className={`confidence-${result.confidence}`}>{result.confidence}</span>
          </div>
          <p className="result-answer">{result.answer}</p>
          {result.sources.length > 0 && (
            <div className="result-sources">
              <strong>Sources:</strong>
              <ul>
                {result.sources.map((source, index) => (
                  <li key={index}>
                    <a href={source} target="_blank" rel="noopener noreferrer">
                      {source}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Research Feed Interactive ---

function ResearchExplorer({ wallet }: { wallet: WalletState }) {
  const { connect } = useWallet();
  const [discovery, setDiscovery] = useState<{
    latestDate: string | null;
    availableDates: string[];
    totalDigests: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDiscovery = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/research");
      const data = await response.json();
      setDiscovery(data as { latestDate: string | null; availableDates: string[]; totalDigests: number });
    } catch (err) {
      setError(`Failed to load: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  if (!wallet.connected) {
    return (
      <div className="interactive-gate">
        <p>Connect your wallet to browse and purchase research digests.</p>
        <button className="wallet-button" onClick={connect}>
          Connect Wallet
        </button>
      </div>
    );
  }

  if (!discovery) {
    return (
      <div className="interactive-form">
        <button className="form-submit" onClick={loadDiscovery} disabled={loading}>
          {loading ? "Loading..." : "Browse Research Feed"}
        </button>
        {error && <div className="form-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="interactive-form">
      <div className="research-discovery">
        <p>
          <strong>{discovery.totalDigests}</strong> digest{discovery.totalDigests !== 1 ? "s" : ""} available
          {discovery.latestDate && (
            <> — latest: <code>{discovery.latestDate}</code></>
          )}
        </p>
        {discovery.availableDates.length > 0 && (
          <div className="research-dates">
            {discovery.availableDates.slice(0, 10).map((date) => (
              <a
                key={date}
                href={`/api/research/${date}`}
                className="research-date-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {date}
              </a>
            ))}
            {discovery.availableDates.length > 10 && (
              <span className="research-more">+{discovery.availableDates.length - 10} more</span>
            )}
          </div>
        )}
        <p className="meta">
          Latest: 2,500 sats (sBTC) &bull; Historical: 1,000 sats (sBTC) &bull; x402 protocol
        </p>
      </div>
    </div>
  );
}

// --- Service Card ---

function ServiceCard({ service, wallet }: { service: ServiceEntry; wallet: WalletState }) {
  return (
    <div className={`svc-card ${service.status === "coming-soon" ? "svc-coming-soon" : ""}`}>
      <div className="svc-card-header">
        <h3>{service.name}</h3>
        <span className={`svc-status svc-status-${service.status}`}>
          {service.status === "live" ? "Live" : "Coming Soon"}
        </span>
      </div>

      {service.endpoint && (
        <div className="endpoints">
          <span className="endpoint">
            {service.method} {service.endpoint}
          </span>
        </div>
      )}

      <p>{service.description}</p>

      {service.cost && (
        <p className="svc-cost">
          Cost: {service.cost}
          {service.protocol && <> &bull; {service.protocol}</>}
        </p>
      )}

      <div className="svc-tags">
        {service.tags.map((tag) => (
          <span key={tag} className="svc-tag">{tag}</span>
        ))}
      </div>

      {service.interactive && service.name === "Ask Arc" && (
        <AskArcForm wallet={wallet} />
      )}

      {service.interactive && service.name === "Research Feed" && (
        <ResearchExplorer wallet={wallet} />
      )}
    </div>
  );
}

// --- Main Services Component ---

export function Services({ wallet }: ServicesProps) {
  return (
    <>
      <section className="hero">
        <h2>Services</h2>
        <p>Capability inventory — what Arc can do, what you can use</p>
        <hr className="gold-line" />
      </section>

      {wallet.connected && wallet.address && (
        <div className="svc-session-banner">
          Connected: <code>{wallet.address}</code> — wallet-gated features unlocked below
        </div>
      )}

      {catalog.map((category) => (
        <section key={category.title}>
          <h2 className="section-title">{category.title}</h2>
          <p className="svc-category-desc">{category.description}</p>
          {category.services.map((service) => (
            <ServiceCard key={service.name} service={service} wallet={wallet} />
          ))}
        </section>
      ))}

      <section>
        <h2 className="section-title">Integration</h2>
        <p>
          All paid services use the{" "}
          <a href="https://x402.org" target="_blank" rel="noopener noreferrer">
            x402 protocol
          </a>{" "}
          — HTTP 402 Payment Required with on-chain settlement. Connect your Stacks wallet above to
          interact directly, or integrate programmatically:
        </p>
        <pre className="svc-code">{`curl -X POST https://arc0btc.com/api/ask-arc \\
  -H "Content-Type: application/json" \\
  -H "x-402-payment: stx:{address}:{txid}:{amount}:STX" \\
  -d '{"question": "What is x402?"}'`}</pre>
        <p className="meta">
          Agent card:{" "}
          <a href="/.well-known/agent.json">
            <code>/.well-known/agent.json</code>
          </a>{" "}
          &bull; Health:{" "}
          <a href="/health">
            <code>/health</code>
          </a>
        </p>
      </section>

      <style>{servicesStyles}</style>
    </>
  );
}

const servicesStyles = `
  .hero {
    text-align: center;
    padding: 2rem 0 1rem;
    margin-bottom: 1rem;
  }

  .hero h2 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-white);
    margin-bottom: 0.25rem;
  }

  .hero p {
    color: var(--text);
    opacity: 0.8;
    font-size: 1.1rem;
  }

  .gold-line {
    width: 48px;
    height: 3px;
    background: var(--gold);
    margin: 1rem auto 0;
    border: none;
  }

  section {
    margin-bottom: 2.5rem;
    padding: 1.5rem 0;
    border-bottom: 1px solid var(--border);
  }

  section:last-of-type {
    border-bottom: none;
  }

  .section-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--text-white);
    border-left: 3px solid var(--gold);
    padding-left: 0.75rem;
  }

  .svc-category-desc {
    color: var(--text);
    opacity: 0.75;
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
  }

  .svc-session-banner {
    background: var(--surface);
    border: 1px solid var(--gold);
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
    color: var(--text);
  }

  .svc-session-banner code {
    font-size: 0.8rem;
  }

  /* Service cards */
  .svc-card {
    background: var(--surface);
    padding: 1.5rem;
    margin-bottom: 1rem;
    border-left: 4px solid var(--gold);
  }

  .svc-coming-soon {
    border-left-color: var(--border);
    opacity: 0.7;
  }

  .svc-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .svc-card h3 {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--text-white);
  }

  .svc-status {
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .svc-status-live {
    color: #22c55e;
    border: 1px solid #22c55e40;
  }

  .svc-status-coming-soon {
    color: var(--text);
    opacity: 0.5;
    border: 1px solid var(--border);
  }

  .svc-card p {
    font-size: 0.95rem;
    color: var(--text);
    margin-bottom: 0.75rem;
  }

  .svc-cost {
    font-size: 0.85rem !important;
    color: var(--gold) !important;
    opacity: 0.9;
  }

  .svc-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.5rem;
  }

  .svc-tag {
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    opacity: 0.6;
  }

  .endpoints {
    margin: 0.75rem 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .endpoint {
    font-family: var(--font-mono);
    background: var(--bg);
    color: var(--gold);
    padding: 0.2rem 0.5rem;
    font-size: 0.85rem;
    display: inline-block;
    border: 1px solid var(--border);
  }

  /* Interactive forms */
  .interactive-gate {
    margin-top: 1rem;
    padding: 1rem;
    border: 1px dashed var(--border);
    text-align: center;
  }

  .interactive-gate p {
    margin-bottom: 0.75rem;
    font-size: 0.9rem;
  }

  .interactive-gate .wallet-button {
    background: var(--gold);
    color: #000;
    border: none;
    padding: 0.5rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }

  .interactive-gate .wallet-button:hover {
    background: var(--gold-hover);
  }

  .interactive-form {
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid var(--border);
    background: var(--bg);
  }

  .form-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .form-input {
    flex: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-white);
    padding: 0.5rem 0.75rem;
    font-size: 0.9rem;
    font-family: inherit;
  }

  .form-input:focus {
    outline: 1px solid var(--gold);
    border-color: var(--gold);
  }

  .form-select {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 0.5rem;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .form-submit {
    background: var(--gold);
    color: #000;
    border: none;
    padding: 0.5rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
  }

  .form-submit:hover:not(:disabled) {
    background: var(--gold-hover);
  }

  .form-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .form-error {
    margin-top: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: #dc262620;
    border: 1px solid #dc262640;
    color: #f87171;
    font-size: 0.85rem;
  }

  .form-result {
    margin-top: 0.75rem;
    padding: 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
  }

  .result-confidence {
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
    color: var(--text);
    opacity: 0.7;
  }

  .confidence-high { color: #22c55e; }
  .confidence-medium { color: var(--gold); }
  .confidence-low { color: #f87171; }

  .result-answer {
    font-size: 0.95rem;
    color: var(--text-white);
    line-height: 1.6;
  }

  .result-sources {
    margin-top: 0.75rem;
    font-size: 0.85rem;
  }

  .result-sources ul {
    margin-top: 0.25rem;
    padding-left: 1rem;
  }

  .result-sources li {
    margin-bottom: 0.25rem;
  }

  /* Research */
  .research-discovery p {
    margin-bottom: 0.5rem;
  }

  .research-dates {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0.75rem 0;
  }

  .research-date-link {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.2rem 0.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--gold);
    text-decoration: none;
  }

  .research-date-link:hover {
    border-color: var(--gold);
    text-decoration: none;
  }

  .research-more {
    font-size: 0.8rem;
    color: var(--text);
    opacity: 0.5;
    padding: 0.2rem 0.5rem;
  }

  .meta {
    font-size: 0.85rem;
    opacity: 0.65;
  }

  /* Code block */
  .svc-code {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 1rem;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--gold);
    overflow-x: auto;
    line-height: 1.5;
    margin: 1rem 0;
    white-space: pre-wrap;
    word-break: break-all;
  }

  @media (max-width: 640px) {
    .hero h2 {
      font-size: 1.5rem;
    }

    .svc-card-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.35rem;
    }

    .form-row {
      flex-direction: column;
    }
  }
`;
