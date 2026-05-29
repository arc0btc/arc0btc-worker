/**
 * Endpoint tests for arc0btc worker
 */

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import worker from "../src/index";
import { requestLogging, type LogsBinding } from "../src/middleware/request-logging";

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
    // Hermetic: mount the real middleware on an isolated app with deterministic
    // routes, so behaviour is independent of the worker's actual endpoints/bindings.
    function makeMockLogs() {
      const calls: { method: string; appId: string; msg: string; context: Record<string, unknown> }[] = [];
      const record = (method: string) => (appId: string, msg: string, context?: Record<string, unknown>) => {
        calls.push({ method, appId, msg, context: context ?? {} });
        return Promise.resolve();
      };
      const LOGS: LogsBinding = { info: record("info"), warn: record("warn"), error: record("error") };
      return { LOGS, calls };
    }

    function makeApp() {
      const app = new Hono<{ Bindings: { LOGS?: LogsBinding } }>();
      app.use("*", requestLogging("arc0btc-worker"));
      app.get("/ok", (c) => c.text("ok", 200));
      app.get("/redirect", (c) => c.redirect("/ok", 302));
      app.get("/bad", (c) => c.text("bad request", 400));
      app.get("/boom", (c) => c.text("kaboom", 500));
      return app;
    }

    it("stays silent on a 2xx response", async () => {
      const app = makeApp();
      const { LOGS, calls } = makeMockLogs();
      const res = await app.request("/ok", {}, { LOGS });
      expect(res.status).toBe(200);
      expect(calls).toHaveLength(0);
    });

    it("stays silent on a 3xx response", async () => {
      const app = makeApp();
      const { LOGS, calls } = makeMockLogs();
      const res = await app.request("/redirect", {}, { LOGS });
      expect(res.status).toBe(302);
      expect(calls).toHaveLength(0);
    });

    it("emits warn exactly once on a 4xx response", async () => {
      const app = makeApp();
      const { LOGS, calls } = makeMockLogs();
      const res = await app.request("/bad", {}, { LOGS });
      expect(res.status).toBe(400);
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("warn");
      expect(calls[0].appId).toBe("arc0btc-worker");
      expect(calls[0].context.status).toBe(400);
      expect(calls[0].context.method).toBe("GET");
      expect(calls[0].context.path).toBe("/bad");
    });

    it("emits error exactly once on a 5xx response", async () => {
      const app = makeApp();
      const { LOGS, calls } = makeMockLogs();
      const res = await app.request("/boom", {}, { LOGS });
      expect(res.status).toBe(500);
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("error");
      expect(calls[0].appId).toBe("arc0btc-worker");
      expect(calls[0].context.status).toBe(500);
      expect(calls[0].context.method).toBe("GET");
      expect(calls[0].context.path).toBe("/boom");
    });

    it("does not throw on a 4xx response when no LOGS binding is present", async () => {
      const app = makeApp();
      const res = await app.request("/bad", {}, {});
      expect(res.status).toBe(400);
    });
  });
});
