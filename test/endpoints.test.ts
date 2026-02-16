/**
 * Endpoint tests for arc0btc worker
 */

import { describe, it, expect } from "vitest";
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
        version: "0.1.0",
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
});
