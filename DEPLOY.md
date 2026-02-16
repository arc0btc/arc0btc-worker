# arc0btc.com Worker Deployment Guide

This document provides step-by-step instructions for deploying the arc0btc.com Cloudflare Worker to production.

---

## Prerequisites

Before deploying, ensure you have:

1. **Cloudflare account** with arc0btc.com domain configured
2. **wrangler CLI** installed (`npm install -g wrangler` or use `npx`)
3. **Cloudflare authentication** configured (`wrangler login` or API token in environment)
4. **DNS configured** for arc0btc.com (should already point to Cloudflare)

---

## Pre-Deployment Checks

Run these checks before deploying:

```bash
cd ~/arc/services/arc0btc-worker

# 1. Verify all tests pass
npm test

# Expected: 9 tests passing
# ✓ test/endpoints.test.ts (9 tests)

# 2. Check wrangler config
cat wrangler.jsonc

# Expected:
# - workers_dev: false (don't create .workers.dev URL)
# - routes: custom_domain for arc0btc.com
# - observability: enabled

# 3. Verify production mode
grep 'mode: "production"' src/index.ts

# Expected: mode: "production" in health endpoint

# 4. Check for local dev artifacts
ls -la .wrangler/

# .wrangler/ is gitignored and contains build artifacts (safe to ignore)
```

---

## Deployment Steps

### Step 1: Deploy to Production

```bash
cd ~/arc/services/arc0btc-worker
npx wrangler deploy
```

**Expected output:**
```
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded arc0btc-worker (X.XX sec)
Published arc0btc-worker (X.XX sec)
  https://arc0btc.com
Current Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**What happens:**
- Worker code is bundled and uploaded to Cloudflare
- Deployed to custom domain arc0btc.com (no .workers.dev URL)
- Available globally via Cloudflare's edge network
- Previous version remains accessible for rollback

### Step 2: Verify Health Endpoint

Wait 10-30 seconds for deployment to propagate, then:

```bash
curl https://arc0btc.com/health
```

**Expected response:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "service": "arc0btc",
  "mode": "production"
}
```

### Step 3: Verify Ask-Arc Endpoint

Test the ask-arc endpoint with a payment header:

```bash
curl -X POST https://arc0btc.com/api/ask-arc \
  -H "Content-Type: application/json" \
  -H "x-402-payment: stx:SP2GHQRCRMYY4S8PMBR49BEKX144VR437YT42SF3B:0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab:0.005:STX" \
  -d '{
    "question": "What is tx-sender?",
    "category": "clarity"
  }'
```

**Expected response:**
```json
{
  "answer": "tx-sender is a Clarity keyword that returns the principal (address) that initiated the current transaction...",
  "sources": ["~/dev/whoabuddy/claude-knowledge/context/clarity-reference.md"],
  "confidence": "high"
}
```

### Step 4: Test Payment Required Error

Verify payment enforcement works:

```bash
curl -X POST https://arc0btc.com/api/ask-arc \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is Clarity?"
  }'
```

**Expected response (402 Payment Required):**
```json
{
  "error": "Payment required",
  "code": "PAYMENT_REQUIRED",
  "cost": 0.005,
  "token": "STX"
}
```

### Step 5: Verify Arc Health Monitoring

Arc's automated health monitoring will pick up the production worker automatically. Check that it's being monitored:

```bash
cd ~/arc
bun run health
```

**Expected output:**
```
Service Health Check

arc0btc.com:
  Status: ok
  Status Code: 200
  Response Time: XXXms
  Last Checked: [timestamp]
```

**Note:** Health monitoring is already configured in `src/services/health.ts` to check `https://arc0btc.com/health` every cycle.

---

## Post-Deployment Verification Checklist

- [ ] Health endpoint returns status="ok"
- [ ] Health endpoint shows mode="production"
- [ ] Ask-arc endpoint requires payment (402 without header)
- [ ] Ask-arc endpoint works with valid payment header
- [ ] Arc health monitoring picks up production worker
- [ ] Landing page loads at https://arc0btc.com
- [ ] No errors in Cloudflare dashboard logs

---

## Rollback Procedure

If deployment causes issues, you can rollback to the previous version.

### When to Rollback

Consider rollback if:
- Health endpoint returns errors or wrong status
- Ask-arc endpoint returns 500 errors
- Payment verification is broken
- Arc health monitoring shows "down" status

### How to Rollback

```bash
cd ~/arc/services/arc0btc-worker

# List recent deployments
npx wrangler deployments list

# Expected output shows deployment history:
# Deployment ID                        Created On              Author
# xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx YYYY-MM-DD HH:MM:SS UTC you@example.com
# yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy YYYY-MM-DD HH:MM:SS UTC you@example.com

# Rollback to previous deployment
npx wrangler rollback [previous-deployment-id]
```

**Verification after rollback:**
- Run all post-deployment verification steps
- Check Cloudflare dashboard for rollback confirmation
- Verify Arc health monitoring shows "ok" status

---

## Troubleshooting

### Issue: DNS not resolving

**Symptoms:** `curl: (6) Could not resolve host: arc0btc.com`

**Solution:**
1. Check Cloudflare DNS settings (should have CNAME or A record for arc0btc.com)
2. Wait for DNS propagation (can take 5-60 minutes)
3. Test with `dig arc0btc.com` or `nslookup arc0btc.com`

### Issue: SSL certificate error

**Symptoms:** `curl: (60) SSL certificate problem`

**Solution:**
1. Verify SSL/TLS is set to "Full" or "Full (strict)" in Cloudflare dashboard
2. Wait for certificate provisioning (automatic, takes 5-15 minutes on first deploy)
3. Check Cloudflare SSL/TLS → Edge Certificates for status

### Issue: 402 errors with valid payment header

**Symptoms:** Valid payment header returns 402

**Causes:**
- Payment header format incorrect (must be `stx:address:txid:amount:token`)
- Invalid Stacks address (must match `/^S[PM][0-9A-Z]{39}$/`)
- Invalid txid (must be 64 hex chars, optional 0x prefix)
- Invalid amount (must be positive number)

**Debugging:**
1. Check Cloudflare dashboard logs for x402 verification errors
2. Verify payment header format matches spec exactly
3. Test with known-good header from test suite

### Issue: 500 Internal Server Error

**Symptoms:** All requests return 500

**Debugging:**
1. Check Cloudflare dashboard → Workers & Pages → arc0btc-worker → Logs
2. Look for uncaught exceptions or runtime errors
3. Verify worker size is under limits (check `wrangler deploy` output)
4. Consider rollback if errors persist

### Issue: Health monitoring shows "down"

**Symptoms:** `bun run health` shows status="down"

**Debugging:**
1. Manually verify health endpoint: `curl https://arc0btc.com/health`
2. Check Cloudflare dashboard logs
3. Verify DNS resolution
4. Check for SSL certificate issues
5. Verify worker is deployed and running

---

## Notes

- **Deployment is instant** but DNS/SSL propagation can take 5-60 minutes on first deploy
- **No downtime** - Cloudflare maintains previous version until new one is verified
- **Observability enabled** - logs available in Cloudflare dashboard for debugging
- **No rate limiting** - Phase 1 implementation trusts payment headers (future: on-chain verification)
- **Automatic monitoring** - Arc health checks run every cycle (see `src/services/health.ts`)

---

## Related Documentation

- **Worker source:** `src/index.ts`, `src/handlers.ts`, `src/knowledge.ts`
- **Tests:** `test/endpoints.test.ts`
- **Wrangler config:** `wrangler.jsonc`
- **Health monitoring:** `~/arc/src/services/health.ts`
- **OPERATIONS.md:** Operational reference for Arc's public services
