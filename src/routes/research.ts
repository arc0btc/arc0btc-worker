/**
 * Research feed routes — x402-gated arXiv AI research digests
 *
 * GET /api/research         — Discovery endpoint (free)
 * GET /api/research/latest  — Latest digest (teaser free, full content 2500 sats)
 * GET /api/research/:date   — Historical digest (teaser free, full content 1000 sats)
 */

import { Hono } from "hono";
import { buildPaymentRequired, verifyPayment } from "../lib/x402";

interface DigestTeaser {
  date: string;
  generated: string;
  papersReviewed: number;
  relevantPapers: number;
  categories: string[];
  highlights: Array<{ title: string; tags: string[]; score: number }>;
}

interface DigestFull extends DigestTeaser {
  content: string;
}

type ResearchBindings = {
  RESEARCH_KV: KVNamespace;
};

const research = new Hono<{ Bindings: ResearchBindings }>();

// Discovery endpoint — lists available digests with pricing info (free)
research.get("/", async (c) => {
  const kv = c.env.RESEARCH_KV;

  const latestKey = await kv.get("research:latest-key");
  const indexRaw = await kv.get("research:index");
  const dates = indexRaw ? (JSON.parse(indexRaw) as string[]) : [];

  return c.json({
    service: "Arc Research Feed",
    description:
      "AI/LLM/agent research digests compiled from arXiv, gated via x402 micropayments.",
    provider: {
      name: "Arc (arc0.btc)",
      stxAddress: "SP2GHQRCRMYY4S8PMBR49BEKX144VR437YT42SF3B",
      site: "https://arc0btc.com",
    },
    pricing: {
      latest: { amount: 2500, currency: "sats (sBTC)", protocol: "x402" },
      historical: { amount: 1000, currency: "sats (sBTC)", protocol: "x402" },
    },
    endpoints: {
      latest: "/api/research/latest",
      byDate: "/api/research/{YYYY-MM-DD}",
      index: "/api/research",
    },
    latestDate: latestKey || null,
    availableDates: dates,
    totalDigests: dates.length,
  });
});

// Latest digest — teaser free, full content gated at 2500 sats
research.get("/latest", async (c) => {
  const kv = c.env.RESEARCH_KV;
  const PRICE_SATS = 2500;

  const latestKey = await kv.get("research:latest-key");
  if (!latestKey) {
    return c.json({ error: "No digests available" }, 404);
  }

  const metaRaw = await kv.get(`research:meta:${latestKey}`);
  if (!metaRaw) {
    return c.json({ error: "Digest metadata not found" }, 404);
  }

  const meta: DigestTeaser = JSON.parse(metaRaw);

  const paymentHeader = c.req.header("payment-signature");

  if (!paymentHeader) {
    const teaserResponse = {
      ...meta,
      pricing: {
        amount: PRICE_SATS,
        currency: "sats (sBTC)",
        description: "Full arXiv AI research digest with abstracts and analysis",
      },
      _links: {
        pay: {
          description: "Send x402 payment to access full digest content",
          header: "payment-signature",
        },
        historical: "/api/research/{date}",
      },
    };

    const paymentRequired = buildPaymentRequired(
      `${new URL(c.req.url).origin}/api/research/latest`,
      PRICE_SATS,
      `Latest arXiv AI research digest (${meta.date})`
    );

    return new Response(JSON.stringify({ teaser: teaserResponse }, null, 2), {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "payment-required": paymentRequired.headers.get("payment-required") || "",
      },
    });
  }

  const verification = await verifyPayment(paymentHeader, PRICE_SATS);

  if (!verification.success) {
    return c.json(
      { error: "Payment verification failed", detail: verification.error },
      402
    );
  }

  const contentRaw = await kv.get(`research:content:${latestKey}`);
  if (!contentRaw) {
    return c.json({ error: "Digest content not found" }, 500);
  }

  const fullDigest: DigestFull = {
    ...meta,
    content: contentRaw,
  };

  return new Response(JSON.stringify(fullDigest, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "payment-response": btoa(
        JSON.stringify({
          success: true,
          payer: verification.payer,
          transaction: verification.txid,
        })
      ),
    },
  });
});

// Historical digest by date — teaser free, full content gated at 1000 sats (2500 if latest)
research.get("/:date", async (c) => {
  const date = c.req.param("date");
  const kv = c.env.RESEARCH_KV;
  const BASE_PRICE_SATS = 1000;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date format. Use YYYY-MM-DD." }, 400);
  }

  const latestKey = await kv.get("research:latest-key");

  const metaRaw = await kv.get(`research:meta:${date}`);
  if (!metaRaw) {
    const indexRaw = await kv.get("research:index");
    const available = indexRaw ? (JSON.parse(indexRaw) as string[]) : [];

    return c.json(
      {
        error: `No digest found for ${date}`,
        available: available.slice(0, 20),
      },
      404
    );
  }

  const meta: DigestTeaser = JSON.parse(metaRaw);

  const isLatest = date === latestKey;
  const priceSats = isLatest ? 2500 : BASE_PRICE_SATS;

  const paymentHeader = c.req.header("payment-signature");

  if (!paymentHeader) {
    const teaserResponse = {
      ...meta,
      isLatest,
      pricing: {
        amount: priceSats,
        currency: "sats (sBTC)",
        description: isLatest
          ? "Latest digest — full content with abstracts and analysis"
          : "Historical digest — full content with abstracts and analysis",
      },
      _links: {
        pay: {
          description: "Send x402 payment to access full digest content",
          header: "payment-signature",
        },
        latest: "/api/research/latest",
      },
    };

    return new Response(JSON.stringify({ teaser: teaserResponse }, null, 2), {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "payment-required":
          buildPaymentRequired(
            `${new URL(c.req.url).origin}/api/research/${date}`,
            priceSats,
            `arXiv AI research digest for ${date}`
          ).headers.get("payment-required") || "",
      },
    });
  }

  const verification = await verifyPayment(paymentHeader, priceSats);

  if (!verification.success) {
    return c.json(
      { error: "Payment verification failed", detail: verification.error },
      402
    );
  }

  const contentRaw = await kv.get(`research:content:${date}`);
  if (!contentRaw) {
    return c.json({ error: "Digest content not found" }, 500);
  }

  const fullDigest: DigestFull = {
    ...meta,
    content: contentRaw,
  };

  return new Response(JSON.stringify(fullDigest, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "payment-response": btoa(
        JSON.stringify({
          success: true,
          payer: verification.payer,
          transaction: verification.txid,
        })
      ),
    },
  });
});

export { research };
