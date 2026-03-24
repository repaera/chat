#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Chat — automated VPS installer
# Repo  : https://github.com/repaera/chat
# Usage : sudo bash install.sh                  (interactive)
#         sudo bash install.sh --non-interactive (reads environment variables)
#         sudo bash install.sh --verbose         (show full Docker build output)
#         sudo bash install.sh --help
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="https://github.com/repaera/chat.git"
INSTALL_DIR="/opt/chat"
VERBOSE=false
INSTALL_FAILED=false
STEP=0
TOTAL_STEPS=0
TMPFILES=()

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${BLUE}── $* ─────────────────────────────────────────${NC}"; }
step()    { STEP=$((STEP + 1)); echo -e "\n${BOLD}${BLUE}── [${STEP}/${TOTAL_STEPS}] $* ──────────────────────────────${NC}"; }

# ── Cleanup on failure ────────────────────────────────────────────────────────
cleanup_on_failure() {
	[[ "$INSTALL_FAILED" != "true" ]] && { rm -f "${TMPFILES[@]}" 2>/dev/null; return; }
	echo ""
	echo -e "${RED}[ERROR]${NC} Installation failed — stopping containers and cleaning up..."
	if [[ -d "$INSTALL_DIR" ]]; then
		cd "$INSTALL_DIR" 2>/dev/null \
			&& docker compose down --remove-orphans --timeout 10 2>/dev/null || true
	fi
	if [[ "$VERBOSE" == "true" && -d "$INSTALL_DIR" ]]; then
		echo -e "\n${YELLOW}── Docker logs (last 40 lines) ──────────────────────${NC}"
		cd "$INSTALL_DIR" 2>/dev/null \
			&& docker compose logs --tail=40 2>/dev/null || true
	fi
	echo ""
	echo -e "${YELLOW}[HINT]${NC} Fix the issue above then re-run: sudo bash install.sh"
	[[ "$VERBOSE" == "false" ]] && \
		echo -e "${YELLOW}[HINT]${NC} Re-run with --verbose for full Docker output on failure."
	rm -f "${TMPFILES[@]}" 2>/dev/null
}

trap 'INSTALL_FAILED=true' ERR
trap cleanup_on_failure EXIT

# ── Argument parsing ──────────────────────────────────────────────────────────
NON_INTERACTIVE=false

for arg in "$@"; do
	case "$arg" in
		--non-interactive | -y) NON_INTERACTIVE=true ;;
		--verbose | -v) VERBOSE=true ;;
		--help | -h)
			echo ""
			echo -e "${BOLD}Usage:${NC} sudo bash install.sh [--non-interactive] [--verbose]"
			echo ""
			echo "Interactive mode (default): prompts for all required values."
			echo ""
			echo -e "${BOLD}Flags:${NC}"
			echo "  --verbose / -v       Show full Docker build output (default: hidden, shown on failure)"
			echo ""
			echo -e "${BOLD}Non-interactive mode${NC} (--non-interactive):"
			echo "  Export these variables before running:"
			echo ""
			echo "  Required:"
			echo "    DOMAIN               e.g. chat.yourdomain.com"
			echo "    SSL_EMAIL            for Let's Encrypt certificate"
			echo "    DB_CHOICE            local-postgres (default) | local-mysql | external"
			echo "    DB_URL               full connection URL (required when DB_CHOICE=external)"
			echo "                         e.g. postgresql://user:pass@host:5432/dbname"
			echo "                              mysql://user:pass@host:3306/dbname"
			echo "    DB_PROVIDER          postgresql | mysql (required when DB_CHOICE=external)"
			echo "    LLM_PROVIDER         openrouter | openai | anthropic | azure-openai |"
			echo "                         azure-foundry | bedrock | vertex | fireworks | xai"
			echo "    LLM_API_KEY          API key for chosen provider"
			echo "                         (bedrock: AWS Access Key ID; vertex: not required)"
			echo "    R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY"
			echo "    R2_BUCKET_NAME / R2_PUBLIC_URL"
			echo "    TRIGGER_SECRET_KEY"
			echo "    RESEND_API_KEY / RESEND_FROM"
			echo "    SENTRY_DSN / SENTRY_ORG / SENTRY_PROJECT"
			echo ""
			echo "  Optional:"
			echo "    BETTER_AUTH_SECRET   auto-generated if not set"
			echo ""
			echo "  Provider-specific:"
			echo "    LLM_MODEL            override default model (all providers)"
			echo "    AWS_SECRET_KEY       AWS Secret Access Key (bedrock only)"
			echo "    AWS_REGION           default: us-east-1 (bedrock)"
			echo "    AZURE_RESOURCE       resource name before .openai.azure.com (azure-openai)"
			echo "    AZURE_FOUNDRY_ENDPOINT  full endpoint URL (azure-foundry)"
			echo "    GOOGLE_VERTEX_PROJECT   GCP project (vertex)"
			echo "    GOOGLE_VERTEX_LOCATION  default: us-central1 (vertex)"
			echo ""
			echo "  Other optional:"
			echo "    CLOUDFLARE_PROXY          true | false (default: false)"
			echo "                              Set true if domain is proxied through Cloudflare."
			echo "                              Skips certbot; nginx serves HTTP only."
			echo "                              SSL_EMAIL is not required when true."
			echo "    APP_NAME                  default: Chat"
			echo "    APP_SHORT_NAME            default: same as APP_NAME"
			echo "    APP_DESCRIPTION           app description (meta/SEO)"
			echo "    APP_PERSONA_CONTEXT       AI persona (e.g. 'food delivery service')"
			echo "    APP_LOCALE                default locale: en | id | kr | jp | es | zh | de | nl | fr | it (default: en)"
			echo "    APP_THEME_COLOR           PWA toolbar color (default: #ffffff)"
			echo "    APP_BG_COLOR              PWA splash bg color (default: #ffffff)"
			echo "    APP_FAVICON_URL           favicon URL override"
			echo "    APP_ICON_SVG_URL          SVG icon URL override"
			echo "    APP_ICON_192_URL          192px icon URL override"
			echo "    APP_ICON_512_URL          512px icon URL override"
			echo "    APP_APPLE_TOUCH_ICON_URL  Apple touch icon URL override"
			echo "    APP_OG_IMAGE_URL          OG image URL (1200×630)"
			echo "    APP_TWITTER_CARD          summary | summary_large_image (default)"
			echo "    APP_TWITTER_SITE          Twitter/X handle e.g. @yourhandle"
			echo "    APP_HELP_URL              help center URL (adds help button in header)"
			echo "    REDIS_URL                 Redis URL for shared rate limiting (optional)"
			echo "                              e.g. redis://host:6379 or rediss://user:token@host:6380"
			echo "                              Leave unset to use in-memory (single-instance only)"
			echo "    LLM_MAX_OUTPUT_TOKENS     max tokens per LLM response (default: 2048)"
			echo "    LLM_CONTEXT_WINDOW        max messages sent to LLM per turn (default: 30)"
			echo "    LLM_MAX_STEPS             max agentic tool-call steps per turn (default: 5)"
			echo "    MAX_TOOL_RESULT_CHARS     truncate tool results above this length (default: 3000)"
			echo "    WEEKLY_MESSAGE_LIMIT      max messages per user per 7 days (default: 0 = unlimited)"
			echo "                              Recommended: 100 for general-purpose deployments"
			echo "    PRESERVE_IMAGES        true | unset (default: unset)"
			echo "                              Skip R2 object deletion on conversation delete/cleanup."
			echo "                              Use when an MCP server stores R2 image URLs externally."
			echo "    USE_PREBUILT              true (default) | false"
			echo "                              Pull pre-built image from GHCR instead of building from source."
			echo "    APP_IMAGE                 Image to pull (default: ghcr.io/repaera/chat:latest)"
			echo "                              Pin a release: ghcr.io/repaera/chat:0.1.0"
			echo "    GTM_ID                    Google Tag Manager ID (e.g. GTM-XXXXXX)"
			echo "    LOCATION_MODE             v1 (default, browser geo) | v2 (Google Maps)"
			echo "    GOOGLE_MAPS_PUB_KEY       NEXT_PUBLIC key for Places autocomplete (v2)"
			echo "    GOOGLE_MAPS_KEY           Server key for Distance Matrix (v2)"
			echo "    GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET  (OAuth)"
			echo "    MCP_URL / MCP_TOKEN       OR  MCP_APPS_URL / MCP_APPS_TOKEN (not both)"
			echo "    MCP_JWT_SECRET"
			echo ""
			echo "  Bot platforms (Chat SDK — each platform only activates when its key(s) are set):"
			echo "    BOT_NAME                  display name for the bot user (default: assistant)"
			echo "    BOT_CONTEXT_WINDOW        messages loaded from DB per turn (default: 15)"
			echo "    BOT_GROUP_CONVERSATION    per-user (default) | shared"
			echo "    TELEGRAM_BOT_TOKEN        Telegram bot token from @BotFather"
			echo "    TELEGRAM_GROUPS_ENABLED   true | unset — allow @mentions in Telegram groups"
			echo "    TELEGRAM_BOT_USERNAME     bot username without @ (optional, auto-detected via getMe)"
			echo "    WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_APP_SECRET / WHATSAPP_ACCESS_TOKEN / WHATSAPP_WEBHOOK_VERIFY_TOKEN"
			echo "    WHATSAPP_WABA_ID          WhatsApp Business Account ID (required for messages to reach webhook)"
			echo "    WHATSAPP_NUMBER           WhatsApp business phone number shown to users (e.g. +1234567890)"
			echo "    SLACK_BOT_TOKEN / SLACK_SIGNING_SECRET"
			echo "    TEAMS_APP_ID / TEAMS_APP_PASSWORD"
			echo "    GCHAT_SERVICE_ACCOUNT_KEY (full service account JSON as single-line string)"
			echo "    DISCORD_BOT_TOKEN / DISCORD_PUBLIC_KEY / DISCORD_APPLICATION_ID"
			echo "    GITHUB_APP_ID / GITHUB_PRIVATE_KEY / GITHUB_WEBHOOK_SECRET"
			echo "    LINEAR_API_KEY / LINEAR_WEBHOOK_SECRET"
			echo "    {PLATFORM}_PERSONA_CONTEXT  per-platform system prompt injection"
			echo "                              e.g. TELEGRAM_PERSONA_CONTEXT='food delivery service'"
			echo ""
			exit 0
			;;
	esac
done

# ── Root check ────────────────────────────────────────────────────────────────
check_root() {
	[[ $EUID -eq 0 ]] || error "Run as root: sudo bash install.sh"
}

# ── Docker install ────────────────────────────────────────────────────────────
install_docker() {
	if command -v docker &>/dev/null; then
		success "Docker already installed ($(docker --version | cut -d' ' -f3 | tr -d ','))"
		return
	fi

	info "Docker not found — installing..."

	[[ -f /etc/os-release ]] || error "Cannot detect OS. Install Docker manually: https://docs.docker.com/engine/install/"
	# shellcheck source=/dev/null
	source /etc/os-release
	local distro="${ID:-unknown}"

	case "$distro" in
		ubuntu | debian)
			apt-get update -qq
			apt-get install -y -qq ca-certificates curl gnupg lsb-release git openssl
			install -m 0755 -d /etc/apt/keyrings
			curl -fsSL "https://download.docker.com/linux/${distro}/gpg" \
				| gpg --dearmor -o /etc/apt/keyrings/docker.gpg
			chmod a+r /etc/apt/keyrings/docker.gpg
			echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/${distro} $(lsb_release -cs) stable" \
				| tee /etc/apt/sources.list.d/docker.list >/dev/null
			apt-get update -qq
			apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
				docker-buildx-plugin docker-compose-plugin
			systemctl enable --now docker
			;;
		centos | rhel | rocky | almalinux | fedora)
			dnf install -y -q dnf-plugins-core git openssl
			dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
			dnf install -y -q docker-ce docker-ce-cli containerd.io \
				docker-buildx-plugin docker-compose-plugin
			systemctl enable --now docker
			;;
		*)
			error "Unsupported distro: ${distro}. Install Docker manually then re-run."
			;;
	esac

	success "Docker installed"
}

# ── Prompt helpers ────────────────────────────────────────────────────────────
_prompt() {
	local var="$1" label="$2" default="${3:-}" secret="${4:-false}" optional="${5:-false}"
	local val=""
	if [[ "$secret" == "true" ]]; then
		read -rsp "  ${label}${default:+ [${default}]}: " val </dev/tty
		echo
	else
		read -rp "  ${label}${default:+ [${default}]}: " val </dev/tty
	fi
	val="${val:-$default}"
	[[ -z "$val" && "$optional" != "true" ]] && error "${label} is required."
	printf -v "$var" '%s' "$val"
}

ask()     { _prompt "$1" "$2" "${3:-}" false false; }
ask_opt() { _prompt "$1" "$2" "${3:-}" false true; }
ask_sec() { _prompt "$1" "$2" "${3:-}" true false; }
ask_sec_opt() { _prompt "$1" "$2" "${3:-}" true true; }

# ── Interactive config ────────────────────────────────────────────────────────
collect_config_interactive() {
	ask DOMAIN "Domain (e.g. chat.yourdomain.com)"

	# Detect public IP
	local server_ip
	server_ip=$(curl -fsSL --max-time 5 ifconfig.me 2>/dev/null \
		|| curl -fsSL --max-time 5 api.ipify.org 2>/dev/null \
		|| echo "unknown")

	# Cloudflare proxy mode
	echo ""
	read -rp "  Is this domain proxied through Cloudflare (orange cloud)? [y/N]: " cf_choice </dev/tty
	if [[ "${cf_choice,,}" == "y" ]]; then
		CLOUDFLARE_PROXY=true
		echo ""
		echo -e "  ${BOLD}Cloudflare proxy mode${NC} — SSL is handled by Cloudflare."
		echo "  Set your Cloudflare SSL/TLS mode to 'Full' or higher (dashboard → SSL/TLS)."
		echo ""
		echo -e "  Add a ${BOLD}proxied A record${NC} in Cloudflare DNS:"
		if [[ "$server_ip" != "unknown" ]]; then
			echo -e "    ${BOLD}${DOMAIN}  →  ${server_ip}  (proxy: on)${NC}"
		else
			echo -e "  ${YELLOW}Could not detect server IP — add the A record manually.${NC}"
		fi
	else
		CLOUDFLARE_PROXY=false
		echo ""
		echo -e "  ${BOLD}DNS setup required before continuing:${NC}"
		if [[ "$server_ip" != "unknown" ]]; then
			echo -e "  Add an ${BOLD}A record${NC} in your DNS provider:"
			echo -e "    ${BOLD}${DOMAIN}  →  ${server_ip}${NC}"
		else
			echo -e "  ${YELLOW}Could not detect server IP automatically.${NC}"
			echo -e "  Add an A record pointing ${BOLD}${DOMAIN}${NC} to this server's public IP."
		fi
		echo ""
		echo "  SSL certificate setup will fail if DNS is not propagated."
	fi
	read -rp "  Press Enter once DNS is configured (Ctrl+C to abort)..." </dev/tty

	[[ "$CLOUDFLARE_PROXY" == "false" ]] && ask SSL_EMAIL "Email for SSL certificate"
	ask_opt APP_NAME  "App name" "Chat"
	ask_opt APP_PERSONA_CONTEXT "AI persona context (optional, e.g. 'food delivery service')"

	# Database
	echo ""
	echo "  Database:"
	echo "    1) Local PostgreSQL  — Docker container, managed by this installer (default)"
	echo "    2) Local MySQL / MariaDB — Docker container"
	echo "    3) External / Managed — AWS RDS, Aurora, PlanetScale, Supabase, Neon, Linode…"
	read -rp "  Choose [1-3]: " db_choice </dev/tty
	case "$db_choice" in
		2)
			DB_CHOICE="local-mysql"
			;;
		3)
			DB_CHOICE="external"
			echo ""
			echo "    Provider:"
			echo "      1) PostgreSQL-compatible (RDS PG, Aurora PG, Neon, Supabase, etc.)"
			echo "      2) MySQL / MariaDB-compatible (RDS MySQL, Aurora MySQL, PlanetScale, etc.)"
			read -rp "    Choose [1-2]: " db_prov_choice </dev/tty
			case "$db_prov_choice" in
				2) DB_PROVIDER="mysql" ;;
				*) DB_PROVIDER="postgresql" ;;
			esac
			ask DB_URL "Database URL (e.g. postgresql://user:pass@host:5432/dbname)"
			;;
		*)
			DB_CHOICE="local-postgres"
			;;
	esac

	# LLM provider
	echo ""
	echo "  LLM Provider:"
	echo "    1) OpenRouter  — 100+ models, free tier available (recommended)"
	echo "    2) OpenAI"
	echo "    3) Anthropic"
	echo "    4) Azure OpenAI"
	echo "    5) Azure AI Foundry"
	echo "    6) AWS Bedrock"
	echo "    7) Google Vertex AI"
	echo "    8) Fireworks AI"
	echo "    9) xAI Grok"
	read -rp "  Choose [1-9]: " llm_choice </dev/tty

	case "$llm_choice" in
		1) LLM_PROVIDER="openrouter";    ask_sec LLM_API_KEY "OpenRouter API key";   ask_opt LLM_MODEL "Model" "google/gemini-2.0-flash-exp:free" ;;
		2) LLM_PROVIDER="openai";        ask_sec LLM_API_KEY "OpenAI API key";        ask_opt LLM_MODEL "Model" "gpt-4o-mini" ;;
		3) LLM_PROVIDER="anthropic";     ask_sec LLM_API_KEY "Anthropic API key";     ask_opt LLM_MODEL "Model" "claude-haiku-4-5-20251001" ;;
		4) LLM_PROVIDER="azure-openai";  ask_sec LLM_API_KEY "Azure OpenAI API key";  ask LLM_MODEL "Deployment name"; ask AZURE_RESOURCE "Resource name (before .openai.azure.com)" ;;
		5) LLM_PROVIDER="azure-foundry"; ask_sec LLM_API_KEY "Azure Foundry API key"; ask LLM_MODEL "Deployment name"; ask AZURE_FOUNDRY_ENDPOINT "Foundry endpoint URL" ;;
		6) LLM_PROVIDER="bedrock";       ask_sec LLM_API_KEY "AWS Access Key ID";     ask_sec AWS_SECRET_KEY "AWS Secret Access Key"; ask_opt AWS_REGION "AWS region" "us-east-1"; ask_opt LLM_MODEL "Model" "anthropic.claude-3-5-haiku-20241022-v1:0" ;;
		7) LLM_PROVIDER="vertex";        ask GOOGLE_VERTEX_PROJECT "GCP project ID";  ask_opt GOOGLE_VERTEX_LOCATION "GCP region" "us-central1"; ask_opt LLM_MODEL "Model" "gemini-2.0-flash" ;;
		8) LLM_PROVIDER="fireworks";     ask_sec LLM_API_KEY "Fireworks API key";     ask_opt LLM_MODEL "Model" "accounts/fireworks/models/llama-v3p3-70b-instruct" ;;
		9) LLM_PROVIDER="xai";           ask_sec LLM_API_KEY "xAI API key";           ask_opt LLM_MODEL "Model" "grok-3-mini" ;;
		*) error "Invalid choice." ;;
	esac

	# Location mode
	echo ""
	echo "  Location sharing:"
	echo "    1) v1 — browser geolocation only (no API key needed)"
	echo "    2) v2 — Google Maps: Places search + commute calculator"
	read -rp "  Choose [1-2]: " loc_choice </dev/tty
	case "$loc_choice" in
		2)
			LOCATION_MODE="v2"
			ask     GOOGLE_MAPS_PUB_KEY "Google Maps API key (public, restrict to HTTP referrer + Places API)"
			ask_sec GOOGLE_MAPS_KEY     "Google Maps API key (server, restrict to IP + Distance Matrix API)"
			ask_opt GOOGLE_MAPS_REGION  "Maps region bias (optional, ISO 3166-1 alpha-2, e.g. US)"
			;;
		*) LOCATION_MODE="v1" ;;
	esac

	echo ""
	info "Cloudflare R2 — image storage"
	ask     R2_ACCOUNT_ID        "Account ID"
	ask_sec R2_ACCESS_KEY_ID     "Access Key ID"
	ask_sec R2_SECRET_ACCESS_KEY "Secret Access Key"
	ask     R2_BUCKET_NAME       "Bucket name"
	ask     R2_PUBLIC_URL        "Public URL (e.g. https://assets.yourdomain.com)"

	echo ""
	info "PRESERVE_IMAGES — optional"
	echo "  Set to true if an MCP server stores R2 image URLs from this app."
	echo "  When enabled, images are NOT deleted when conversations are removed."
	read -rp "  Enable PRESERVE_IMAGES? [y/N]: " preserve_choice </dev/tty
	if [[ "${preserve_choice,,}" == "y" ]]; then
		PRESERVE_IMAGES=true
	else
		PRESERVE_IMAGES=""
	fi

	echo ""
	info "Trigger.dev — background jobs"
	ask_sec TRIGGER_SECRET_KEY "Secret key (tr_live_...)"

	echo ""
	info "Better Auth secret"
	ask_sec_opt BETTER_AUTH_SECRET "Auth secret (press Enter to auto-generate)"

	echo ""
	info "Email via Resend"
	ask_sec RESEND_API_KEY "Resend API key"
	ask     RESEND_FROM    "From address (e.g. noreply@yourdomain.com)"

	echo ""
	info "Error tracking via Sentry"
	ask     SENTRY_DSN     "Sentry DSN (NEXT_PUBLIC_SENTRY_DSN)"
	ask     SENTRY_ORG     "Sentry org slug"
	ask     SENTRY_PROJECT "Sentry project slug"

	echo ""
	info "Google OAuth — optional (press Enter to skip)"
	ask_opt     GOOGLE_CLIENT_ID     "Google Client ID"
	ask_sec_opt GOOGLE_CLIENT_SECRET "Google Client Secret"

	echo ""
	info "MCP Server — optional, choose ONE or press Enter to skip"
	echo "    A) MCP_URL      — any backend (Rails, Laravel, Spring…) — tools only"
	echo "    B) MCP_APPS_URL — TypeScript MCP Apps server — tools + embedded UI"
	read -rp "  Choose [A/B or Enter to skip]: " mcp_choice </dev/tty
	MCP_URL=""; MCP_TOKEN=""; MCP_APPS_URL=""; MCP_APPS_TOKEN=""; MCP_JWT_SECRET=""
	case "${mcp_choice^^}" in
		A)
			ask     MCP_URL   "MCP_URL"
			ask_sec_opt MCP_TOKEN "Bearer token (optional)"
			ask_sec_opt MCP_JWT_SECRET "JWT secret for user identity (optional, openssl rand -hex 32)"
			;;
		B)
			ask     MCP_APPS_URL   "MCP_APPS_URL"
			ask_sec_opt MCP_APPS_TOKEN "Bearer token (optional)"
			ask_sec_opt MCP_JWT_SECRET "JWT secret for user identity (optional, openssl rand -hex 32)"
			;;
	esac

	echo ""
	info "Bot platforms — Chat SDK (press Enter to skip all)"
	echo "  Enables messaging bots on Telegram, WhatsApp, Slack, Teams, Google Chat,"
	echo "  Discord, GitHub, and/or Linear. Each platform is independent — configure"
	echo "  only the ones you need. Webhook URL: https://DOMAIN/api/webhooks/{platform}"
	read -rp "  Configure any bot platform? [y/N]: " bot_choice </dev/tty
	if [[ "${bot_choice,,}" == "y" ]]; then
		ask_opt BOT_NAME             "Bot display name" "assistant"
		ask_opt BOT_CONTEXT_WINDOW   "Message history loaded per turn" "15"
		ask_opt BOT_GROUP_CONVERSATION "Group conversation mode (per-user | shared)" "per-user"

		read -rp "  Enable Telegram? [y/N]: " t </dev/tty
		if [[ "${t,,}" == "y" ]]; then
			ask_sec TELEGRAM_BOT_TOKEN "Bot token (from @BotFather)"
			read -rp "  Allow @mentions in Telegram groups? [y/N]: " tg </dev/tty
			[[ "${tg,,}" == "y" ]] && TELEGRAM_GROUPS_ENABLED=true || TELEGRAM_GROUPS_ENABLED=""
			ask_opt TELEGRAM_BOT_USERNAME "Bot username without @ (optional, auto-detected)"
		fi

		read -rp "  Enable WhatsApp? [y/N]: " t </dev/tty
		if [[ "${t,,}" == "y" ]]; then
			ask     WHATSAPP_PHONE_NUMBER_ID      "Phone Number ID"
			ask_sec WHATSAPP_APP_SECRET           "App Secret (from Meta App Settings → Basic)"
			ask_sec WHATSAPP_ACCESS_TOKEN         "Access Token"
			ask_sec WHATSAPP_WEBHOOK_VERIFY_TOKEN "Webhook Verify Token"
			ask_opt WHATSAPP_WABA_ID             "WhatsApp Business Account ID (required for messages to reach webhook)"
			ask_opt WHATSAPP_NUMBER              "WhatsApp business phone number (optional, shown to users, e.g. +1234567890)"
		fi

		read -rp "  Enable Slack? [y/N]: " t </dev/tty
		if [[ "${t,,}" == "y" ]]; then
			ask_sec SLACK_BOT_TOKEN      "Bot Token (xoxb-...)"
			ask_sec SLACK_SIGNING_SECRET "Signing Secret"
		fi

		read -rp "  Enable Microsoft Teams? [y/N]: " t </dev/tty
		if [[ "${t,,}" == "y" ]]; then
			ask     TEAMS_APP_ID       "App ID"
			ask_sec TEAMS_APP_PASSWORD "App Password"
		fi

		read -rp "  Enable Google Chat? [y/N]: " t </dev/tty
		if [[ "${t,,}" == "y" ]]; then
			ask_sec GCHAT_SERVICE_ACCOUNT_KEY "Service account JSON (single-line string)"
		fi

		read -rp "  Enable Discord? [y/N]: " t </dev/tty
		if [[ "${t,,}" == "y" ]]; then
			ask_sec DISCORD_BOT_TOKEN       "Bot Token"
			ask     DISCORD_PUBLIC_KEY      "Public Key"
			ask     DISCORD_APPLICATION_ID  "Application ID"
		fi

		read -rp "  Enable GitHub? [y/N]: " t </dev/tty
		if [[ "${t,,}" == "y" ]]; then
			ask     GITHUB_APP_ID        "App ID"
			ask_sec GITHUB_PRIVATE_KEY   "Private Key (PEM, single line)"
			ask_sec GITHUB_WEBHOOK_SECRET "Webhook Secret"
		fi

		read -rp "  Enable Linear? [y/N]: " t </dev/tty
		if [[ "${t,,}" == "y" ]]; then
			ask_sec LINEAR_API_KEY        "API Key (lin_api_...)"
			ask_sec LINEAR_WEBHOOK_SECRET "Webhook Secret"
		fi
	fi

	echo ""
	info "Branding — press Enter to skip / use defaults"
	ask_opt APP_SHORT_NAME    "App short name (used in PWA launcher)" "${APP_NAME:-Chat}"
	ask_opt APP_DESCRIPTION   "App description (browser tab / SEO meta)"
	ask_opt APP_THEME_COLOR   "PWA theme color (mobile browser toolbar)" "#ffffff"
	ask_opt APP_BG_COLOR      "PWA splash background color" "#ffffff"

	echo ""
	info "Icons — paste absolute URLs or paths under public/ (press Enter to skip)"
	ask_opt APP_FAVICON_URL        "Favicon URL (e.g. https://cdn.example.com/favicon.ico)"
	ask_opt APP_ICON_SVG_URL       "SVG icon URL"
	ask_opt APP_ICON_192_URL       "192 × 192 icon URL"
	ask_opt APP_ICON_512_URL       "512 × 512 icon URL"
	ask_opt APP_APPLE_TOUCH_ICON_URL "Apple touch icon URL"

	echo ""
	info "Social / Open Graph — press Enter to skip"
	ask_opt APP_OG_IMAGE_URL  "OG image URL (1200 × 630)"
	ask_opt APP_TWITTER_CARD  "Twitter card type (summary | summary_large_image)" "summary_large_image"
	ask_opt APP_TWITTER_SITE  "Twitter/X handle (e.g. @yourhandle)"

	echo ""
	info "Chat UI"
	ask_opt APP_HELP_URL "Help center URL (adds help button in chat header)"

	echo ""
	info "Locale — default language when user has no preference"
	ask_opt APP_LOCALE "Default locale (en / id / kr / jp / es / zh / de / nl / fr / it)" "en"

	echo ""
	echo "  Redis — optional: shared rate limiting for multi-replica deployments"
	echo "  Leave empty to use in-memory rate limiting (fine for single instance)"
	ask_sec_opt REDIS_URL "Redis URL (e.g. redis://host:6379 or rediss://user:token@host:6380)"

	echo ""
	info "LLM tuning — press Enter to accept defaults"
	ask_opt LLM_MAX_OUTPUT_TOKENS "Max tokens per response" "2048"
	ask_opt LLM_CONTEXT_WINDOW    "Max messages sent to LLM per turn" "30"
	ask_opt LLM_MAX_STEPS         "Max agentic tool-call steps per turn" "5"
	ask_opt MAX_TOOL_RESULT_CHARS "Truncate tool results above this length (chars)" "3000"
	ask_opt WEEKLY_MESSAGE_LIMIT  "Weekly message limit per user (0 = unlimited, recommended: 100)" "0"

	echo ""
	info "Analytics — press Enter to skip"
	ask_opt GTM_ID "Google Tag Manager ID (e.g. GTM-XXXXXX)"

	echo ""
	info "App image"
	echo "  Pre-built: pulls ghcr.io/repaera/chat:latest from GHCR (faster, no build step)"
	echo "  Build:     compiles from source on this server (slower, always fresh)"
	read -rp "  Use pre-built GHCR image? [Y/n]: " prebuilt_choice </dev/tty
	case "${prebuilt_choice,,}" in
		n|no) USE_PREBUILT=false ;;
		*) USE_PREBUILT=true ;;
	esac
	if [[ "$USE_PREBUILT" == "true" ]]; then
		ask_opt APP_IMAGE "Image (press Enter for latest)" "ghcr.io/repaera/chat:latest"
	fi
}

# ── Silent config ─────────────────────────────────────────────────────────────
collect_config_silent() {
	: "${DOMAIN:?DOMAIN is required}"
	: "${LLM_PROVIDER:?LLM_PROVIDER is required}"
	: "${R2_ACCOUNT_ID:?R2_ACCOUNT_ID is required}"
	: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
	: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"
	: "${R2_BUCKET_NAME:?R2_BUCKET_NAME is required}"
	: "${R2_PUBLIC_URL:?R2_PUBLIC_URL is required}"
	: "${TRIGGER_SECRET_KEY:?TRIGGER_SECRET_KEY is required}"
	: "${RESEND_API_KEY:?RESEND_API_KEY is required}"
	: "${RESEND_FROM:?RESEND_FROM is required}"
	: "${SENTRY_DSN:?SENTRY_DSN is required}"
	: "${SENTRY_ORG:?SENTRY_ORG is required}"
	: "${SENTRY_PROJECT:?SENTRY_PROJECT is required}"

	case "$LLM_PROVIDER" in
		bedrock)
			: "${LLM_API_KEY:?LLM_API_KEY (AWS Access Key ID) is required for bedrock}"
			: "${AWS_SECRET_KEY:?AWS_SECRET_KEY is required for bedrock}"
			;;
		vertex)
			: "${GOOGLE_VERTEX_PROJECT:?GOOGLE_VERTEX_PROJECT is required for vertex}"
			;;
		azure-openai)
			: "${LLM_API_KEY:?LLM_API_KEY is required}"
			: "${AZURE_RESOURCE:?AZURE_RESOURCE (resource name) is required for azure-openai}"
			;;
		azure-foundry)
			: "${LLM_API_KEY:?LLM_API_KEY is required}"
			: "${AZURE_FOUNDRY_ENDPOINT:?AZURE_FOUNDRY_ENDPOINT is required for azure-foundry}"
			;;
		*)
			: "${LLM_API_KEY:?LLM_API_KEY is required for provider: ${LLM_PROVIDER}}"
			;;
	esac

	# Database
	DB_CHOICE="${DB_CHOICE:-local-postgres}"
	DB_PROVIDER="${DB_PROVIDER:-postgresql}"
	DB_URL="${DB_URL:-}"
	if [[ "$DB_CHOICE" == "external" ]]; then
		: "${DB_URL:?DB_URL is required when DB_CHOICE=external}"
		: "${DB_PROVIDER:?DB_PROVIDER (postgresql|mysql) is required when DB_CHOICE=external}"
	fi

	# Defaults for optional vars
	APP_NAME="${APP_NAME:-Chat}"
	APP_PERSONA_CONTEXT="${APP_PERSONA_CONTEXT:-}"
	LLM_MODEL="${LLM_MODEL:-}"
	LOCATION_MODE="${LOCATION_MODE:-v1}"
	GOOGLE_MAPS_PUB_KEY="${GOOGLE_MAPS_PUB_KEY:-}"
	GOOGLE_MAPS_KEY="${GOOGLE_MAPS_KEY:-}"
	GOOGLE_MAPS_REGION="${GOOGLE_MAPS_REGION:-}"
	AWS_REGION="${AWS_REGION:-us-east-1}"
	AZURE_RESOURCE="${AZURE_RESOURCE:-}"
	AZURE_FOUNDRY_ENDPOINT="${AZURE_FOUNDRY_ENDPOINT:-}"
	GOOGLE_VERTEX_PROJECT="${GOOGLE_VERTEX_PROJECT:-}"
	GOOGLE_VERTEX_LOCATION="${GOOGLE_VERTEX_LOCATION:-us-central1}"
	BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-}"
	GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
	GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
	MCP_URL="${MCP_URL:-}"
	MCP_TOKEN="${MCP_TOKEN:-}"
	MCP_APPS_URL="${MCP_APPS_URL:-}"
	MCP_APPS_TOKEN="${MCP_APPS_TOKEN:-}"
	MCP_JWT_SECRET="${MCP_JWT_SECRET:-}"

	CLOUDFLARE_PROXY="${CLOUDFLARE_PROXY:-false}"
	if [[ "$CLOUDFLARE_PROXY" == "false" ]]; then
		: "${SSL_EMAIL:?SSL_EMAIL is required when CLOUDFLARE_PROXY is not true}"
	fi

	# Branding
	APP_SHORT_NAME="${APP_SHORT_NAME:-}"
	APP_DESCRIPTION="${APP_DESCRIPTION:-}"
	APP_THEME_COLOR="${APP_THEME_COLOR:-}"
	APP_BG_COLOR="${APP_BG_COLOR:-}"
	# Icons
	APP_FAVICON_URL="${APP_FAVICON_URL:-}"
	APP_ICON_SVG_URL="${APP_ICON_SVG_URL:-}"
	APP_ICON_192_URL="${APP_ICON_192_URL:-}"
	APP_ICON_512_URL="${APP_ICON_512_URL:-}"
	APP_APPLE_TOUCH_ICON_URL="${APP_APPLE_TOUCH_ICON_URL:-}"
	# Social
	APP_OG_IMAGE_URL="${APP_OG_IMAGE_URL:-}"
	APP_TWITTER_CARD="${APP_TWITTER_CARD:-}"
	APP_TWITTER_SITE="${APP_TWITTER_SITE:-}"
	# Chat UI
	APP_HELP_URL="${APP_HELP_URL:-}"
	# Locale
	APP_LOCALE="${APP_LOCALE:-}"
	REDIS_URL="${REDIS_URL:-}"
	LLM_MAX_OUTPUT_TOKENS="${LLM_MAX_OUTPUT_TOKENS:-}"
	LLM_CONTEXT_WINDOW="${LLM_CONTEXT_WINDOW:-}"
	LLM_MAX_STEPS="${LLM_MAX_STEPS:-}"
	MAX_TOOL_RESULT_CHARS="${MAX_TOOL_RESULT_CHARS:-}"
	WEEKLY_MESSAGE_LIMIT="${WEEKLY_MESSAGE_LIMIT:-}"
	PRESERVE_IMAGES="${PRESERVE_IMAGES:-}"
	# Bot platforms (Chat SDK)
	BOT_NAME="${BOT_NAME:-}"
	BOT_CONTEXT_WINDOW="${BOT_CONTEXT_WINDOW:-}"
	BOT_GROUP_CONVERSATION="${BOT_GROUP_CONVERSATION:-}"
	TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
	TELEGRAM_GROUPS_ENABLED="${TELEGRAM_GROUPS_ENABLED:-}"
	TELEGRAM_BOT_USERNAME="${TELEGRAM_BOT_USERNAME:-}"
	WHATSAPP_PHONE_NUMBER_ID="${WHATSAPP_PHONE_NUMBER_ID:-}"
	WHATSAPP_APP_SECRET="${WHATSAPP_APP_SECRET:-}"
	WHATSAPP_ACCESS_TOKEN="${WHATSAPP_ACCESS_TOKEN:-}"
	WHATSAPP_WEBHOOK_VERIFY_TOKEN="${WHATSAPP_WEBHOOK_VERIFY_TOKEN:-}"
	WHATSAPP_WABA_ID="${WHATSAPP_WABA_ID:-}"
	WHATSAPP_NUMBER="${WHATSAPP_NUMBER:-}"
	SLACK_BOT_TOKEN="${SLACK_BOT_TOKEN:-}"
	SLACK_SIGNING_SECRET="${SLACK_SIGNING_SECRET:-}"
	TEAMS_APP_ID="${TEAMS_APP_ID:-}"
	TEAMS_APP_PASSWORD="${TEAMS_APP_PASSWORD:-}"
	GCHAT_SERVICE_ACCOUNT_KEY="${GCHAT_SERVICE_ACCOUNT_KEY:-}"
	DISCORD_BOT_TOKEN="${DISCORD_BOT_TOKEN:-}"
	DISCORD_PUBLIC_KEY="${DISCORD_PUBLIC_KEY:-}"
	DISCORD_APPLICATION_ID="${DISCORD_APPLICATION_ID:-}"
	GITHUB_APP_ID="${GITHUB_APP_ID:-}"
	GITHUB_PRIVATE_KEY="${GITHUB_PRIVATE_KEY:-}"
	GITHUB_WEBHOOK_SECRET="${GITHUB_WEBHOOK_SECRET:-}"
	LINEAR_API_KEY="${LINEAR_API_KEY:-}"
	LINEAR_WEBHOOK_SECRET="${LINEAR_WEBHOOK_SECRET:-}"
	USE_PREBUILT="${USE_PREBUILT:-true}"
	APP_IMAGE="${APP_IMAGE:-ghcr.io/repaera/chat:latest}"
	# Analytics
	GTM_ID="${GTM_ID:-}"

	local server_ip
	server_ip=$(curl -fsSL --max-time 5 ifconfig.me 2>/dev/null \
		|| curl -fsSL --max-time 5 api.ipify.org 2>/dev/null \
		|| echo "unknown")
	if [[ "$server_ip" != "unknown" ]]; then
		if [[ "$CLOUDFLARE_PROXY" == "true" ]]; then
			info "Server public IP: ${server_ip} — add as proxied A record in Cloudflare DNS for ${DOMAIN}"
		else
			info "Server public IP: ${server_ip} — ensure DNS A record for ${DOMAIN} points here before certbot runs"
		fi
	fi

	success "All required variables present"
}

# ── Generate secrets ──────────────────────────────────────────────────────────
generate_secrets() {
	if [[ -z "${BETTER_AUTH_SECRET:-}" ]]; then
		BETTER_AUTH_SECRET=$(openssl rand -hex 32)
		info "Generated BETTER_AUTH_SECRET"
	fi

	POSTGRES_PASSWORD=""
	MYSQL_PASSWORD=""
	MYSQL_ROOT_PASSWORD=""

	if [[ "$DB_CHOICE" == "local-postgres" ]]; then
		POSTGRES_PASSWORD=$(openssl rand -hex 24)
		success "Generated BETTER_AUTH_SECRET and PostgreSQL password"
	elif [[ "$DB_CHOICE" == "local-mysql" ]]; then
		MYSQL_PASSWORD=$(openssl rand -hex 24)
		MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)
		success "Generated BETTER_AUTH_SECRET and MySQL passwords"
	else
		success "Generated BETTER_AUTH_SECRET (external DB — no local password needed)"
	fi
}

# ── Clone repo ────────────────────────────────────────────────────────────────
clone_repo() {
	if [[ "$USE_PREBUILT" == "true" ]]; then
		mkdir -p "$INSTALL_DIR"
		success "Install directory ready at $INSTALL_DIR"
		return
	fi
	if [[ -d "$INSTALL_DIR/.git" ]]; then
		warn "Directory $INSTALL_DIR already exists — pulling latest"
		git -C "$INSTALL_DIR" pull --ff-only
	else
		git clone "$REPO_URL" "$INSTALL_DIR"
	fi
	success "Repo ready at $INSTALL_DIR"
}

# ── Write .env ────────────────────────────────────────────────────────────────
write_env() {
	# Backup existing .env before overwriting
	if [[ -f "$INSTALL_DIR/.env" ]]; then
		local backup="$INSTALL_DIR/.env.bak.$(date +%Y%m%d_%H%M%S)"
		cp "$INSTALL_DIR/.env" "$backup"
		warn "Existing .env backed up to $backup"
	fi

	# Build LLM provider block
	local llm_block
	case "$LLM_PROVIDER" in
		openrouter)
			llm_block="OPENROUTER_API_KEY=${LLM_API_KEY}"
			[[ -n "${LLM_MODEL:-}" ]] && llm_block+=$'\n'"OPENROUTER_MODEL=${LLM_MODEL}"
			;;
		openai)
			llm_block="OPENAI_API_KEY=${LLM_API_KEY}"
			[[ -n "${LLM_MODEL:-}" ]] && llm_block+=$'\n'"OPENAI_MODEL=${LLM_MODEL}"
			;;
		anthropic)
			llm_block="ANTHROPIC_API_KEY=${LLM_API_KEY}"
			[[ -n "${LLM_MODEL:-}" ]] && llm_block+=$'\n'"ANTHROPIC_MODEL=${LLM_MODEL}"
			;;
		azure-openai)
			llm_block="AZURE_OPENAI_API_KEY=${LLM_API_KEY}"$'\n'"AZURE_OPENAI_RESOURCE_NAME=${AZURE_RESOURCE}"
			[[ -n "${LLM_MODEL:-}" ]] && llm_block+=$'\n'"AZURE_OPENAI_DEPLOYMENT=${LLM_MODEL}"
			;;
		azure-foundry)
			llm_block="AZURE_FOUNDRY_ENDPOINT=${AZURE_FOUNDRY_ENDPOINT}"$'\n'"AZURE_FOUNDRY_API_KEY=${LLM_API_KEY}"
			[[ -n "${LLM_MODEL:-}" ]] && llm_block+=$'\n'"AZURE_FOUNDRY_MODEL=${LLM_MODEL}"
			;;
		bedrock)
			llm_block="AWS_ACCESS_KEY_ID=${LLM_API_KEY}"$'\n'"AWS_SECRET_ACCESS_KEY=${AWS_SECRET_KEY}"$'\n'"AWS_REGION=${AWS_REGION}"
			[[ -n "${LLM_MODEL:-}" ]] && llm_block+=$'\n'"BEDROCK_MODEL=${LLM_MODEL}"
			;;
		vertex)
			llm_block="GOOGLE_VERTEX_PROJECT=${GOOGLE_VERTEX_PROJECT}"$'\n'"GOOGLE_VERTEX_LOCATION=${GOOGLE_VERTEX_LOCATION}"
			[[ -n "${LLM_MODEL:-}" ]] && llm_block+=$'\n'"VERTEX_MODEL=${LLM_MODEL}"
			;;
		fireworks)
			llm_block="FIREWORKS_API_KEY=${LLM_API_KEY}"
			[[ -n "${LLM_MODEL:-}" ]] && llm_block+=$'\n'"FIREWORKS_MODEL=${LLM_MODEL}"
			;;
		xai)
			llm_block="XAI_API_KEY=${LLM_API_KEY}"
			[[ -n "${LLM_MODEL:-}" ]] && llm_block+=$'\n'"XAI_MODEL=${LLM_MODEL}"
			;;
	esac

		# Resolve short name: explicit value > same as APP_NAME
	local resolved_short_name="${APP_SHORT_NAME:-${APP_NAME}}"

	# Build database block
	local db_provider db_url db_creds
	if [[ "$DB_CHOICE" == "local-postgres" ]]; then
		db_provider="postgresql"
		db_url="postgresql://app:${POSTGRES_PASSWORD}@db:5432/app_db"
		db_creds="POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
	elif [[ "$DB_CHOICE" == "local-mysql" ]]; then
		db_provider="mysql"
		db_url="mysql://app:${MYSQL_PASSWORD}@db:3306/app_db"
		db_creds="MYSQL_PASSWORD=${MYSQL_PASSWORD}"$'\n'"MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}"
	else
		db_provider="$DB_PROVIDER"
		db_url="$DB_URL"
		db_creds=""
	fi

	cat >"$INSTALL_DIR/.env" <<EOF
# Generated by install.sh on $(date -u +"%Y-%m-%d %H:%M UTC")

# ── App ───────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://${DOMAIN}
NEXT_PUBLIC_APP_NAME="${APP_NAME}"
NEXT_PUBLIC_APP_SHORT_NAME="${resolved_short_name}"
${APP_DESCRIPTION:+NEXT_PUBLIC_APP_DESCRIPTION="${APP_DESCRIPTION}"}
${APP_PERSONA_CONTEXT:+APP_PERSONA_CONTEXT="${APP_PERSONA_CONTEXT}"}

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_PROVIDER=${db_provider}
DATABASE_URL=${db_url}
${db_creds}

# ── Auth ──────────────────────────────────────────────────────────────────────
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
BETTER_AUTH_URL=https://${DOMAIN}
${GOOGLE_CLIENT_ID:+GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}}
${GOOGLE_CLIENT_SECRET:+GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}}

# ── AI ────────────────────────────────────────────────────────────────────────
LLM_PROVIDER=${LLM_PROVIDER}
${llm_block}

# ── Location ──────────────────────────────────────────────────────────────────
NEXT_PUBLIC_LOCATION_MODE=${LOCATION_MODE}
${GOOGLE_MAPS_PUB_KEY:+NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_PUB_KEY}}
${GOOGLE_MAPS_KEY:+GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_KEY}}
${GOOGLE_MAPS_REGION:+NEXT_PUBLIC_GOOGLE_MAPS_REGION=${GOOGLE_MAPS_REGION}}

# ── Image Storage / R2 ────────────────────────────────────────────────────────
R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
R2_BUCKET_NAME=${R2_BUCKET_NAME}
R2_PUBLIC_URL=${R2_PUBLIC_URL}
${PRESERVE_IMAGES:+PRESERVE_IMAGES=${PRESERVE_IMAGES}}

# ── Background Jobs ───────────────────────────────────────────────────────────
TRIGGER_SECRET_KEY=${TRIGGER_SECRET_KEY}

# ── Email ─────────────────────────────────────────────────────────────────────
RESEND_API_KEY=${RESEND_API_KEY}
RESEND_FROM=${RESEND_FROM}

# ── Error tracking ────────────────────────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=${SENTRY_DSN}
SENTRY_ORG=${SENTRY_ORG}
SENTRY_PROJECT=${SENTRY_PROJECT}

# ── MCP ───────────────────────────────────────────────────────────────────────
${MCP_URL:+MCP_URL=${MCP_URL}}
${MCP_TOKEN:+MCP_TOKEN=${MCP_TOKEN}}
${MCP_APPS_URL:+MCP_APPS_URL=${MCP_APPS_URL}}
${MCP_APPS_TOKEN:+MCP_APPS_TOKEN=${MCP_APPS_TOKEN}}
${MCP_JWT_SECRET:+MCP_JWT_SECRET=${MCP_JWT_SECRET}}

# ── Branding ──────────────────────────────────────────────────────────────────
${APP_THEME_COLOR:+NEXT_PUBLIC_APP_THEME_COLOR=${APP_THEME_COLOR}}
${APP_BG_COLOR:+NEXT_PUBLIC_APP_BG_COLOR=${APP_BG_COLOR}}

# ── Icons ─────────────────────────────────────────────────────────────────────
${APP_FAVICON_URL:+APP_FAVICON_URL=${APP_FAVICON_URL}}
${APP_ICON_SVG_URL:+APP_ICON_SVG_URL=${APP_ICON_SVG_URL}}
${APP_ICON_192_URL:+APP_ICON_192_URL=${APP_ICON_192_URL}}
${APP_ICON_512_URL:+APP_ICON_512_URL=${APP_ICON_512_URL}}
${APP_APPLE_TOUCH_ICON_URL:+APP_APPLE_TOUCH_ICON_URL=${APP_APPLE_TOUCH_ICON_URL}}

# ── Social / OG ───────────────────────────────────────────────────────────────
${APP_OG_IMAGE_URL:+APP_OG_IMAGE_URL=${APP_OG_IMAGE_URL}}
${APP_TWITTER_CARD:+APP_TWITTER_CARD=${APP_TWITTER_CARD}}
${APP_TWITTER_SITE:+APP_TWITTER_SITE=${APP_TWITTER_SITE}}

# ── Chat UI ───────────────────────────────────────────────────────────────────
${APP_HELP_URL:+NEXT_PUBLIC_APP_HELP_URL=${APP_HELP_URL}}

# ── Locale ────────────────────────────────────────────────────────────────────
${APP_LOCALE:+APP_LOCALE=${APP_LOCALE}}

# ── Redis ─────────────────────────────────────────────────────────────────────
${REDIS_URL:+REDIS_URL=${REDIS_URL}}

# ── LLM tuning ────────────────────────────────────────────────────────────────
${LLM_MAX_OUTPUT_TOKENS:+LLM_MAX_OUTPUT_TOKENS=${LLM_MAX_OUTPUT_TOKENS}}
${LLM_CONTEXT_WINDOW:+LLM_CONTEXT_WINDOW=${LLM_CONTEXT_WINDOW}}
${LLM_MAX_STEPS:+LLM_MAX_STEPS=${LLM_MAX_STEPS}}
${MAX_TOOL_RESULT_CHARS:+MAX_TOOL_RESULT_CHARS=${MAX_TOOL_RESULT_CHARS}}
${WEEKLY_MESSAGE_LIMIT:+WEEKLY_MESSAGE_LIMIT=${WEEKLY_MESSAGE_LIMIT}}

# ── Bot platforms (Chat SDK) ──────────────────────────────────────────────────
${BOT_NAME:+BOT_NAME=${BOT_NAME}}
${BOT_CONTEXT_WINDOW:+BOT_CONTEXT_WINDOW=${BOT_CONTEXT_WINDOW}}
${BOT_GROUP_CONVERSATION:+BOT_GROUP_CONVERSATION=${BOT_GROUP_CONVERSATION}}
${TELEGRAM_BOT_TOKEN:+TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}}
${TELEGRAM_GROUPS_ENABLED:+TELEGRAM_GROUPS_ENABLED=${TELEGRAM_GROUPS_ENABLED}}
${TELEGRAM_BOT_USERNAME:+TELEGRAM_BOT_USERNAME=${TELEGRAM_BOT_USERNAME}}
${WHATSAPP_PHONE_NUMBER_ID:+WHATSAPP_PHONE_NUMBER_ID=${WHATSAPP_PHONE_NUMBER_ID}}
${WHATSAPP_APP_SECRET:+WHATSAPP_APP_SECRET=${WHATSAPP_APP_SECRET}}
${WHATSAPP_ACCESS_TOKEN:+WHATSAPP_ACCESS_TOKEN=${WHATSAPP_ACCESS_TOKEN}}
${WHATSAPP_WEBHOOK_VERIFY_TOKEN:+WHATSAPP_WEBHOOK_VERIFY_TOKEN=${WHATSAPP_WEBHOOK_VERIFY_TOKEN}}
${WHATSAPP_WABA_ID:+WHATSAPP_WABA_ID=${WHATSAPP_WABA_ID}}
${WHATSAPP_NUMBER:+WHATSAPP_NUMBER=${WHATSAPP_NUMBER}}
${SLACK_BOT_TOKEN:+SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}}
${SLACK_SIGNING_SECRET:+SLACK_SIGNING_SECRET=${SLACK_SIGNING_SECRET}}
${TEAMS_APP_ID:+TEAMS_APP_ID=${TEAMS_APP_ID}}
${TEAMS_APP_PASSWORD:+TEAMS_APP_PASSWORD=${TEAMS_APP_PASSWORD}}
${GCHAT_SERVICE_ACCOUNT_KEY:+GCHAT_SERVICE_ACCOUNT_KEY=${GCHAT_SERVICE_ACCOUNT_KEY}}
${DISCORD_BOT_TOKEN:+DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}}
${DISCORD_PUBLIC_KEY:+DISCORD_PUBLIC_KEY=${DISCORD_PUBLIC_KEY}}
${DISCORD_APPLICATION_ID:+DISCORD_APPLICATION_ID=${DISCORD_APPLICATION_ID}}
${GITHUB_APP_ID:+GITHUB_APP_ID=${GITHUB_APP_ID}}
${GITHUB_PRIVATE_KEY:+GITHUB_PRIVATE_KEY=${GITHUB_PRIVATE_KEY}}
${GITHUB_WEBHOOK_SECRET:+GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET}}
${LINEAR_API_KEY:+LINEAR_API_KEY=${LINEAR_API_KEY}}
${LINEAR_WEBHOOK_SECRET:+LINEAR_WEBHOOK_SECRET=${LINEAR_WEBHOOK_SECRET}}

# ── Analytics ─────────────────────────────────────────────────────────────────
${GTM_ID:+NEXT_PUBLIC_GTM_ID=${GTM_ID}}
EOF

	chmod 600 "$INSTALL_DIR/.env"
	success ".env written (chmod 600)"
}

# ── docker-compose.yml ────────────────────────────────────────────────────────
write_docker_compose() {
	if [[ "$DB_CHOICE" == "local-postgres" ]]; then
		cat >"$INSTALL_DIR/docker-compose.yml" <<'EOF'
services:
  app:
    build: .
    restart: unless-stopped
    expose:
      - "3000"
    env_file: .env
    environment:
      NODE_ENV: production
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: app_db
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d app_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - app

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot

volumes:
  db_data:
EOF

	elif [[ "$DB_CHOICE" == "local-mysql" ]]; then
		cat >"$INSTALL_DIR/docker-compose.yml" <<'EOF'
services:
  app:
    build: .
    restart: unless-stopped
    expose:
      - "3000"
    env_file: .env
    environment:
      NODE_ENV: production
    depends_on:
      db:
        condition: service_healthy

  db:
    image: mysql:8
    restart: unless-stopped
    environment:
      MYSQL_USER: app
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      MYSQL_DATABASE: app_db
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
    volumes:
      - db_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "app", "--password=${MYSQL_PASSWORD}"]
      interval: 5s
      timeout: 10s
      retries: 15

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - app

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot

volumes:
  db_data:
EOF

	else
		# External DB — no local db container or volume
		cat >"$INSTALL_DIR/docker-compose.yml" <<'EOF'
services:
  app:
    build: .
    restart: unless-stopped
    expose:
      - "3000"
    env_file: .env
    environment:
      NODE_ENV: production

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - app

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
EOF
	fi

	# When using pre-built GHCR image, replace build directive with image reference
	if [[ "$USE_PREBUILT" == "true" ]]; then
		sed -i "s|    build: \.|    image: ${APP_IMAGE}|g" "$INSTALL_DIR/docker-compose.yml"
	fi

	success "docker-compose.yml written"
}

# ── Nginx config ──────────────────────────────────────────────────────────────
write_nginx_http() {
	mkdir -p "$INSTALL_DIR/nginx/conf.d" "$INSTALL_DIR/certbot/conf" "$INSTALL_DIR/certbot/www"

	if [[ "$CLOUDFLARE_PROXY" == "true" ]]; then
		# Cloudflare terminates SSL — origin only needs to serve HTTP
		cat >"$INSTALL_DIR/nginx/conf.d/app.conf" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    # Real visitor IP from Cloudflare header
    real_ip_header    CF-Connecting-IP;

    location / {
        proxy_pass         http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$http_cf_connecting_ip;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
        proxy_cache_bypass \$http_upgrade;
        proxy_buffering    off;
        proxy_read_timeout 300s;
    }
}
EOF
		success "Nginx config written (Cloudflare proxy mode — HTTP only)"
	else
		# Direct — HTTP only initially for ACME challenge; HTTPS written after cert
		cat >"$INSTALL_DIR/nginx/conf.d/app.conf" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF
		success "Nginx HTTP config written"
	fi
}

write_nginx_https() {
	cat >"$INSTALL_DIR/nginx/conf.d/app.conf" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass         http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_buffering    off;
        proxy_read_timeout 300s;
    }
}
EOF
	success "Nginx HTTPS config written"
}

# ── Build & start ─────────────────────────────────────────────────────────────
build_app() {
	cd "$INSTALL_DIR"
	if [[ "$USE_PREBUILT" == "true" ]]; then
		info "Pulling app image from GHCR (${APP_IMAGE})..."
		docker compose pull app
		success "App image pulled"
		return
	fi
	if [[ "$VERBOSE" == "true" ]]; then
		docker compose build app
	else
		local logfile
		logfile=$(mktemp /tmp/chat-build-XXXXXX.log)
		TMPFILES+=("$logfile")
		info "Building app image (use --verbose for full output)..."
		if ! docker compose build app >"$logfile" 2>&1; then
			echo -e "\n${RED}── Docker build output ──────────────────────────────${NC}"
			cat "$logfile"
			error "Docker build failed. See output above."
		fi
	fi
	success "App image built"
}

start_db() {
	[[ "$DB_CHOICE" == "external" ]] && { success "External DB — skipping local container"; return; }

	cd "$INSTALL_DIR"
	docker compose up -d db

	if [[ "$DB_CHOICE" == "local-mysql" ]]; then
		info "Waiting for MySQL to be ready..."
		local retries=0
		until docker compose exec -T db mysqladmin ping -h localhost -u app "--password=${MYSQL_PASSWORD}" &>/dev/null; do
			retries=$((retries + 1))
			[[ $retries -ge 40 ]] && error "MySQL did not become ready. Check: docker compose logs db"
			sleep 3
		done
		success "MySQL ready"
	else
		info "Waiting for PostgreSQL to be ready..."
		local retries=0
		until docker compose exec -T db pg_isready -U app -d app_db &>/dev/null; do
			retries=$((retries + 1))
			[[ $retries -ge 30 ]] && error "PostgreSQL did not become ready. Check: docker compose logs db"
			sleep 3
		done
		success "PostgreSQL ready"
	fi
}

run_migrations() {
	cd "$INSTALL_DIR"
	docker compose run --rm app npx prisma migrate deploy
	success "Migrations applied"
}

start_app() {
	cd "$INSTALL_DIR"
	docker compose up -d app nginx
	success "Services started"
}

# ── SSL ───────────────────────────────────────────────────────────────────────
obtain_ssl() {
	cd "$INSTALL_DIR"

	# Verify port 80 is reachable before attempting
	info "Verifying HTTP is reachable on ${DOMAIN}..."
	if ! curl -fsSL --max-time 10 "http://${DOMAIN}/.well-known/acme-challenge/test" &>/dev/null; then
		warn "Port 80 on ${DOMAIN} may not be reachable from the internet."
		warn "Ensure DNS is pointing to this server and port 80 is open before continuing."
		read -rp "  Continue anyway? [y/N]: " cont </dev/tty
		[[ "${cont,,}" == "y" ]] || error "Aborted. Fix DNS/firewall then re-run."
	fi

	docker compose run --rm certbot certonly \
		--webroot --webroot-path /var/www/certbot \
		--email "$SSL_EMAIL" \
		--agree-tos --no-eff-email \
		-d "$DOMAIN"

	# Download nginx SSL recommended params (once)
	docker compose exec nginx sh -c "
		curl -fsSL https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
			> /etc/letsencrypt/options-ssl-nginx.conf 2>/dev/null || true
		[ -f /etc/letsencrypt/ssl-dhparams.pem ] || \
			openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048 2>/dev/null
	"

	success "SSL certificate obtained"
}

reload_nginx() {
	cd "$INSTALL_DIR"
	docker compose exec nginx nginx -s reload
	success "Nginx reloaded with HTTPS config"
}

setup_cert_renewal() {
	local job="0 3 1,15 * * cd ${INSTALL_DIR} && docker compose run --rm certbot renew --quiet && docker compose exec nginx nginx -s reload"
	(crontab -l 2>/dev/null | grep -qF "certbot renew") \
		|| (crontab -l 2>/dev/null; echo "$job") | crontab -
	success "SSL auto-renewal cron added (1st + 15th of month at 03:00)"
}

# ── Post-install health check ─────────────────────────────────────────────────
verify_app() {
	local url
	if [[ "$CLOUDFLARE_PROXY" == "true" ]]; then
		url="http://${DOMAIN}"
	else
		url="https://${DOMAIN}"
	fi
	info "Waiting for app to respond at ${url} ..."
	local retries=0
	until curl -fsSL --max-time 10 "${url}" &>/dev/null; do
		retries=$((retries + 1))
		if [[ $retries -ge 12 ]]; then
			warn "App did not respond after 60s — it may still be starting up."
			warn "Check logs: docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f app"
			return
		fi
		sleep 5
	done
	success "App is responding at ${url}"
}

# ── Summary ───────────────────────────────────────────────────────────────────
print_summary() {
	echo ""
	echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
	echo -e "${BOLD}${GREEN}  Installation complete!${NC}"
	echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
	echo ""
	echo -e "  ${BOLD}URL${NC}             https://${DOMAIN}"
	echo -e "  ${BOLD}Install dir${NC}     ${INSTALL_DIR}"
	echo -e "  ${BOLD}LLM provider${NC}    ${LLM_PROVIDER}"
	echo ""
	echo -e "  ${BOLD}Useful commands:${NC}"
	echo -e "    docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f app"
	echo -e "    docker compose -f ${INSTALL_DIR}/docker-compose.yml restart app"
	echo ""
	echo -e "  ${BOLD}To update:${NC}"
	echo -e "    cd ${INSTALL_DIR}"
	if [[ "$USE_PREBUILT" == "true" ]]; then
	echo -e "    docker compose pull app"
	echo -e "    docker compose up -d app"
	else
	echo -e "    git pull"
	echo -e "    docker compose up -d --build app"
	fi
	echo -e "    docker compose run --rm app npx prisma migrate deploy  # if schema changed"
	echo ""
	echo -e "  ${BOLD}Deploy Trigger.dev tasks${NC} (run from your local machine after code changes):"
	echo -e "    npx trigger.dev@latest deploy"
	echo ""
	if [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]]; then
		echo -e "  ${BOLD}Telegram webhook:${NC} register with"
		echo -e "    bash ${INSTALL_DIR}/scripts/setup-telegram-webhook.sh"
		echo ""
	fi
	if [[ -n "${WHATSAPP_ACCESS_TOKEN:-}" ]]; then
		echo -e "  ${BOLD}WhatsApp webhook:${NC} subscribe WABA and test with"
		echo -e "    bash ${INSTALL_DIR}/scripts/setup-whatsapp-webhook.sh"
		echo ""
	fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
	echo -e "${BOLD}${BLUE}"
	echo "  ╔════════════════════════════════════════╗"
	echo "  ║           Chat — Installer             ║"
	echo "  ║   https://github.com/repaera/chat      ║"
	echo "  ╚════════════════════════════════════════╝"
	echo -e "${NC}"

	check_root

	# ── Step 1: Docker ────────────────────────────────────────────────────────
	# Preliminary total (adjusted after config reveals CLOUDFLARE_PROXY)
	TOTAL_STEPS=13
	step "Check & install Docker"
	install_docker

	# ── Step 2: Configuration ────────────────────────────────────────────────
	step "Collect configuration"
	if [[ "$NON_INTERACTIVE" == "true" ]]; then
		collect_config_silent
	else
		collect_config_interactive
	fi

	# Finalise step count now that CLOUDFLARE_PROXY and DB_CHOICE are known:
	#   Base:        secrets, clone, write-files, build, migrate, start, verify = 7
	#   Local DB:    +1 (start database)
	#   Direct SSL:  +3 (ssl, configure-https, cert-renewal)
	local db_steps=1
	[[ "$DB_CHOICE" == "external" ]] && db_steps=0
	if [[ "$CLOUDFLARE_PROXY" == "true" ]]; then
		TOTAL_STEPS=$((STEP + 7 + db_steps))
	else
		TOTAL_STEPS=$((STEP + 10 + db_steps))
	fi

	# ── Step 3: Secrets ───────────────────────────────────────────────────────
	step "Generate secrets"
	generate_secrets

	# ── Step 4: Clone ─────────────────────────────────────────────────────────
	step "Clone repository"
	clone_repo

	# ── Step 5: Write configuration files ────────────────────────────────────
	step "Write configuration files"
	write_env
	write_docker_compose
	write_nginx_http

	# ── Step 6: Build ─────────────────────────────────────────────────────────
	step "Build app image"
	build_app

	# ── Step 7: Database ──────────────────────────────────────────────────────
	step "Start database"
	start_db

	# ── Step 8: Migrations ────────────────────────────────────────────────────
	step "Run database migrations"
	run_migrations

	# ── Step 9: Start services ────────────────────────────────────────────────
	step "Start services"
	start_app

	if [[ "$CLOUDFLARE_PROXY" == "true" ]]; then
		success "Skipping certbot — SSL is handled by Cloudflare"
	else
		# ── Step 10: SSL ──────────────────────────────────────────────────────
		step "Obtain SSL certificate"
		obtain_ssl

		# ── Step 11: Configure HTTPS ──────────────────────────────────────────
		step "Configure HTTPS"
		write_nginx_https
		reload_nginx

		# ── Step 12: SSL auto-renewal ─────────────────────────────────────────
		step "Set up SSL auto-renewal"
		setup_cert_renewal
	fi

	# ── Final step: Verify ────────────────────────────────────────────────────
	step "Verify installation"
	verify_app

	print_summary
}

main "$@"
