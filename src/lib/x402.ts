/**
 * x402 Protocol Helpers for arc0btc.com
 *
 * Self-contained x402 v2 types and response builders.
 * Relay-based payment verification via x402-relay.aibtc.com.
 * No external SDK dependency.
 */

// Arc's Stacks address — payments go here
const ARC_STX_ADDRESS = "SP2GHQRCRMYY4S8PMBR49BEKX144VR437YT42SF3B";

// sBTC contract on mainnet
const SBTC_CONTRACT = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";

// x402 relay for payment settlement
const RELAY_URL = "https://x402-relay.aibtc.com";

export interface PaymentRequirementsV2 {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

export interface PaymentRequiredV2 {
  x402Version: 2;
  error?: string;
  resource: { url: string; description?: string; mimeType?: string };
  accepts: PaymentRequirementsV2[];
}

export interface PaymentPayloadV2 {
  x402Version: 2;
  resource?: { url: string };
  accepted: PaymentRequirementsV2;
  payload: { transaction: string };
}

export interface SettlementResponseV2 {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: string;
}

/**
 * Build a 402 Payment Required response for research content.
 */
export function buildPaymentRequired(
  url: string,
  amountSats: number,
  description: string
): Response {
  const body: PaymentRequiredV2 = {
    x402Version: 2,
    error: "Payment required",
    resource: {
      url,
      description,
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: "stacks:1",
        amount: amountSats.toString(),
        asset: SBTC_CONTRACT,
        payTo: ARC_STX_ADDRESS,
        maxTimeoutSeconds: 300,
        extra: {
          pricing: {
            type: "fixed",
            tier: amountSats >= 2000 ? "research-latest" : "research-historical",
          },
        },
      },
    ],
  };

  const encoded = btoa(JSON.stringify(body));

  return new Response(JSON.stringify(body, null, 2), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "payment-required": encoded,
    },
  });
}

/**
 * Verify x402 payment via the relay settle endpoint.
 * Returns the settlement result.
 */
export async function verifyPayment(
  paymentHeader: string,
  amountSats: number
): Promise<{ success: boolean; payer?: string; txid?: string; error?: string }> {
  let payload: PaymentPayloadV2;
  try {
    payload = JSON.parse(atob(paymentHeader));
  } catch {
    return { success: false, error: "Invalid payment-signature header encoding" };
  }

  if (!payload?.payload?.transaction) {
    return { success: false, error: "Missing transaction in payment payload" };
  }

  // Build payment requirements for verification
  const paymentRequirements: PaymentRequirementsV2 = {
    scheme: "exact",
    network: "stacks:1",
    amount: amountSats.toString(),
    asset: SBTC_CONTRACT,
    payTo: ARC_STX_ADDRESS,
    maxTimeoutSeconds: 300,
  };

  try {
    const settleResponse = await fetch(`${RELAY_URL}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: payload,
        paymentRequirements,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!settleResponse.ok) {
      const errorText = await settleResponse.text();
      return { success: false, error: `Relay error: ${errorText}` };
    }

    const result = (await settleResponse.json()) as SettlementResponseV2;

    if (!result.success) {
      return { success: false, error: result.errorReason || "Settlement failed" };
    }

    return {
      success: true,
      payer: result.payer,
      txid: result.transaction,
    };
  } catch (err) {
    return { success: false, error: `Settlement error: ${String(err)}` };
  }
}
