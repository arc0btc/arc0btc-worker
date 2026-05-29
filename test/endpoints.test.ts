/**
 * Endpoint tests for arc0btc worker
 */

import { describe, it, expect, vi } from "vitest";
import worker from "../src/index";

describe("arc0btc worker endpoints", () => {
  describe("GET /health", () => {
    it("returns 200 with service info", async () => {
      const req = new Request("http://localhost/health", { method: "GET" });
      const res = await worker.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toMatchObject({
        status: "ok",
        service: "arc0btc",
        version: "0.2.0",
      });
    });
  });

  describe("GET /", () => {
    it("returns 200 HTML landing page", async () => {
      const req = new Request("http://localhost/", { method: "GET" });
      const res = await worker.fetch(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");

      const html = await res.text();
      expect(html).toContain("Arc");
      expect(html).toContain("arc0.btc");
      expect(html).toContain("/api/ask-arc");
    });
  });

  describe("POST /api/ask-arc", () => {
    // Valid payment header for tests
    // Format: stx:{address}:{txid}:{amount}:{token}
    const validPaymentHeader =
      "stx:SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7:0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab:0.005:STX";

    it("returns 402 when payment header is missing", async () => {
      const req = new Request("http://localhost/api/ask-arc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "What is tx-sender?" }),
      });

      const res = await worker.fetch(req);
      expect(res.status).toBe(402);

      const data = await res.json();
      expect(data.code).toBe("PAYMENT_REQUIRED");
    });

    it("returns answer for valid question with payment", async () => {
      const req = new Request("http://localhost/api/ask-arc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-402-payment": validPaymentHeader,
        },
        body: JSON.stringify({ question: "What is tx-sender?" }),
      });

      const res = await worker.fetch(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty("answer");
      expect(data).toHaveProperty("sources");
      expect(data).toHaveProperty("confidence");
      expect(typeof data.answer).toBe("string");
      expect(Array.isArray(data.sources)).toBe(true);
    });

    it("returns 400 for invalid JSON body", async () => {
      const req = new Request("http://localhost/api/ask-arc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-402-payment": validPaymentHeader,
        },
        body: "invalid json",
      });

      const res = await worker.fetch(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.code).toBe("INVALID_JSON");
    });

    it("returns 400 for missing question field", async () => {
      const req = new Request("http://localhost/api/ask-arc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-402-payment": validPaymentHeader,
        },
        body: JSON.stringify({}),
      });

      const res = await worker.fetch(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.code).toBe("INVALID_REQUEST");
      expect(data.error).toContain("question");
    });

    it("returns 400 for question too long", async () => {
      const longQuestion = "a".repeat(501);
      const req = new Request("http://localhost/api/ask-arc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-402-payment": validPaymentHeader,
        },
        body: JSON.stringify({ question: longQuestion }),
      });

      const res = await worker.fetch(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.code).toBe("INVALID_REQUEST");
      expect(data.error).toContain("too long");
    });

    it("returns 400 for invalid category", async () => {
      const req = new Request("http://localhost/api/ask-arc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-402-payment": validPaymentHeader,
        },
        body: JSON.stringify({
          question: "What is this?",
          category: "invalid-category",
        }),
      });

      const res = await worker.fetch(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.code).toBe("INVALID_REQUEST");
      expect(data.error).toContain("category");
    });

    it("filters by category when provided", async () => {
      const req = new Request("http://localhost/api/ask-arc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-402-payment": validPaymentHeader,
        },
        body: JSON.stringify({
          question: "What is ERC-8004?",
          category: "stacks",
        }),
      });

      const res = await worker.fetch(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty("answer");
      expect(data.answer).toContain("agent identity");
    });
  });

  describe("request logging middleware", () => {
    // Build a mock LOGS binding that records which method was called and with what args.
    function makeMockEnv() {
      const calls: { method: string; appId: string; msg: string; context: Record<string, unknown> }[] = [];
      const LOGS = {
        info: vi.fn((appId: string, msg: string, context?: Record<string, unknown>) => {
          calls.push({ method: "info", appId, msg, context: context ?? {} });
          return Promise.resolve();
        }),
        warn: vi.fn((appId: string, msg: string, context?: Record<string, unknown>) => {
          calls.push({ method: "warn", appId, msg, context: context ?? {} });
          return Promise.resolve();
        }),
        error: vi.fn((appId: string, msg: string, context?: Record<string, unknown>) => {
          calls.push({ method: "error", appId, msg, context: context ?? {} });
          return Promise.resolve();
        }),
      };
      return { env: { LOGS }, calls };
    }

    it("stays silent on a 2xx response (GET /health → 200)", async () => {
      const { env, calls } = makeMockEnv();
      const req = new Request("http://localhost/health");
      await worker.fetch(req, env);
      expect(calls).toHaveLength(0);
    });

    it("stays silent on a 3xx-class status (2xx route confirms status < 400 guard)", async () => {
      // The app has no built-in redirect route; GET / returns 200.
      // This test documents that any status < 400 is silent, using GET / as a second 2xx data point.
      const { env, calls } = makeMockEnv();
      const req = new Request("http://localhost/");
      await worker.fetch(req, env);
      expect(calls).toHaveLength(0);
    });

    it("emits warn exactly once on a 4xx response (POST /api/ask-arc without payment → 402)", async () => {
      const { env, calls } = makeMockEnv();
      const req = new Request("http://localhost/api/ask-arc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "test" }),
      });
      const res = await worker.fetch(req, env);
      expect(res.status).toBe(402);
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("warn");
      expect(calls[0].appId).toBe("arc0btc-worker");
      expect(calls[0].context.status).toBe(402);
      expect(calls[0].context.method).toBe("POST");
      expect(calls[0].context.path).toBe("/api/ask-arc");
    });

    it("emits error exactly once on a 5xx response (GET /api/feed with no FEEDS_KV → 500)", async () => {
      // handleFeed accesses env.FEEDS_KV.get(...); without that binding it throws → 500
      const { env, calls } = makeMockEnv();
      const req = new Request("http://localhost/api/feed");
      const res = await worker.fetch(req, env);
      expect(res.status).toBe(500);
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("error");
      expect(calls[0].appId).toBe("arc0btc-worker");
      expect(calls[0].context.status).toBe(500);
      expect(calls[0].context.method).toBe("GET");
      expect(calls[0].context.path).toBe("/api/feed");
    });
  });
});
