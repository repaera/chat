#!/bin/bash
# ================================================
# Telegram Webhook Setup – Option 1 (NO secret_token)
# ✅ Now 100% jq-free (works on any machine)
# Auto-detects project root + loads .env.local
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

# ── 3. Required env vars ─────────────────────────────────────
if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo "❌ ERROR: TELEGRAM_BOT_TOKEN is not set in .env.local / .env"
  exit 1
fi

if [[ -z "${TELEGRAM_WEBHOOK_URL:-}" ]]; then
  echo "❌ ERROR: TELEGRAM_WEBHOOK_URL is not set"
  echo ""
  echo "Add this to your .env.local (in project root):"
  echo "   TELEGRAM_WEBHOOK_URL=https://your-app-name.vercel.app/api/webhooks/telegram"
  exit 1
fi

echo ""
echo "🚀 Setting Telegram webhook (Option 1 – no secret_token)"
echo "   Bot token  : ${TELEGRAM_BOT_TOKEN:0:8}... (hidden)"
echo "   Webhook URL: $TELEGRAM_WEBHOOK_URL"
echo ""

# Set the webhook
echo "🔄 Calling setWebhook..."
RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${TELEGRAM_WEBHOOK_URL}\",
    \"allowed_updates\": [\"message\"]
  }")

echo "$RESPONSE"
echo ""

# Fetch webhook info
echo "🔍 Fetching current webhook info..."
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"

echo ""
echo "🎉 Done!"
echo ""
echo "Next steps:"
echo "1. Add to .env.local (project root):"
echo "     TELEGRAM_GROUPS_ENABLED=true"
echo "2. Test in a group: @yourbotname hi"
echo "3. Check your server logs – you should now see 200 instead of 404"
echo ""
echo "Tip: If you want pretty JSON in the future, run: brew install jq  (macOS) or sudo apt install jq (Linux/WSL)"