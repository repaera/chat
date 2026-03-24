#!/bin/bash
# ================================================
# WhatsApp Cloud API Webhook Setup
# ✅ jq-free (works on any machine)
# Auto-detects project root + loads .env.local
#
# What this script does:
#   1. Validates required env vars
#   2. Tests webhook verification endpoint (simulates Meta's GET challenge)
#   3. Subscribes your app to the WABA (the critical undocumented step)
#   4. Shows next steps for Meta Developer Portal
# ================================================

set -euo pipefail

# ── 1. Auto-find project root (even if run from scripts/) ─────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

while [[ ! -f "$PROJECT_ROOT/package.json" && ! -f "$PROJECT_ROOT/.env.local" && "$PROJECT_ROOT" != "/" ]]; do
  PROJECT_ROOT="$(dirname "$PROJECT_ROOT")"
done

echo "📍 Project root detected: $PROJECT_ROOT"
cd "$PROJECT_ROOT"

# ── 2. Smart .env loading (Next.js style) ─────────────────────
ENV_FILE=""

if [[ -f .env.local ]]; then
  ENV_FILE=".env.local"
  echo "📁 Loading .env.local (highest priority)"
elif [[ -f .env ]]; then
  ENV_FILE=".env"
  echo "📁 Loading .env"
else
  echo "⚠️  No .env.local or .env found – using shell/exported variables only"
fi

if [[ -n "$ENV_FILE" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$ENV_FILE" | xargs) 2>/dev/null || true
  echo "   ✅ Loaded from $ENV_FILE"
fi

# ── 3. Required env vars ──────────────────────────────────────
MISSING=0

if [[ -z "${WHATSAPP_ACCESS_TOKEN:-}" ]]; then
  echo "❌ ERROR: WHATSAPP_ACCESS_TOKEN is not set"
  MISSING=1
fi

if [[ -z "${WHATSAPP_PHONE_NUMBER_ID:-}" ]]; then
  echo "❌ ERROR: WHATSAPP_PHONE_NUMBER_ID is not set"
  MISSING=1
fi

if [[ -z "${WHATSAPP_WEBHOOK_VERIFY_TOKEN:-}" ]]; then
  echo "❌ ERROR: WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set"
  MISSING=1
fi

if [[ $MISSING -eq 1 ]]; then
  echo ""
  echo "Add the missing variables to .env.local — see docs/whatsapp-setup.md for where to find each value."
  exit 1
fi

echo ""
echo "   Access token    : ${WHATSAPP_ACCESS_TOKEN:0:8}... (hidden)"
echo "   Phone number ID : $WHATSAPP_PHONE_NUMBER_ID"
echo "   Verify token    : ${WHATSAPP_WEBHOOK_VERIFY_TOKEN:0:4}... (hidden)"
echo ""

# ── 4. Test webhook verification endpoint ────────────────────
if [[ -z "${WHATSAPP_WEBHOOK_URL:-}" ]]; then
  echo "⚠️  WHATSAPP_WEBHOOK_URL is not set — skipping verification test."
  echo "   Add it to .env.local to test your endpoint:"
  echo "   WHATSAPP_WEBHOOK_URL=https://your-domain.com/api/webhooks/whatsapp"
else
  CHALLENGE="chat_sdk_test_$$"
  echo "🔍 Testing webhook verification endpoint..."
  echo "   URL: $WHATSAPP_WEBHOOK_URL"
  echo "   Sending GET with hub.challenge=$CHALLENGE"
  echo ""

  VERIFY_RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${WHATSAPP_WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${WHATSAPP_WEBHOOK_VERIFY_TOKEN}&hub.challenge=${CHALLENGE}")

  HTTP_BODY=$(echo "$VERIFY_RESPONSE" | head -n -1)
  HTTP_CODE=$(echo "$VERIFY_RESPONSE" | tail -n 1)

  if [[ "$HTTP_CODE" == "200" && "$HTTP_BODY" == "$CHALLENGE" ]]; then
    echo "   ✅ Verification passed (HTTP $HTTP_CODE, challenge echoed correctly)"
  elif [[ "$HTTP_CODE" == "200" ]]; then
    echo "   ⚠️  HTTP 200 but challenge mismatch"
    echo "   Expected : $CHALLENGE"
    echo "   Got      : $HTTP_BODY"
    echo "   Check your WHATSAPP_WEBHOOK_VERIFY_TOKEN matches what's set in the Meta Portal."
  else
    echo "   ❌ Verification failed (HTTP $HTTP_CODE)"
    echo "   Response: $HTTP_BODY"
    echo "   Make sure your server is running and reachable from the internet."
  fi
  echo ""
fi

# ── 5. Subscribe app to WABA ──────────────────────────────────
if [[ -z "${WHATSAPP_WABA_ID:-}" ]]; then
  echo "⚠️  WHATSAPP_WABA_ID is not set — skipping WABA subscription."
  echo "   This is required for real messages to reach your webhook."
  echo "   Find your WABA ID in Meta Developer Console → WhatsApp → API Setup."
  echo "   Add it to .env.local:"
  echo "   WHATSAPP_WABA_ID=<your WhatsApp Business Account ID>"
else
  echo "🔗 Subscribing app to WABA (ID: $WHATSAPP_WABA_ID)..."
  SUB_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "https://graph.facebook.com/v21.0/${WHATSAPP_WABA_ID}/subscribed_apps" \
    -H "Authorization: Bearer ${WHATSAPP_ACCESS_TOKEN}")

  SUB_BODY=$(echo "$SUB_RESPONSE" | head -n -1)
  SUB_CODE=$(echo "$SUB_RESPONSE" | tail -n 1)

  if [[ "$SUB_CODE" == "200" ]]; then
    echo "   ✅ WABA subscription successful"
    echo "   Response: $SUB_BODY"
  else
    echo "   ❌ WABA subscription failed (HTTP $SUB_CODE)"
    echo "   Response: $SUB_BODY"
    echo "   Check that WHATSAPP_ACCESS_TOKEN has whatsapp_business_management scope."
  fi
  echo ""
fi

echo "🎉 Done!"
echo ""
echo "Remaining steps (must be done in Meta Developer Portal):"
echo "  1. WhatsApp → Configuration → Webhooks"
echo "     Set callback URL : https://your-domain.com/api/webhooks/whatsapp"
echo "     Set verify token : (your WHATSAPP_WEBHOOK_VERIFY_TOKEN)"
echo "     Click 'Verify and Save'"
echo "  2. Click 'Manage' next to Webhook fields → subscribe to 'messages'"
echo "  3. Switch app from Development → Live (top of the page)"
echo "  4. Add a payment method in Meta Business Suite → Billing & Payments"
echo ""
echo "See docs/whatsapp-setup.md for the full guide."
