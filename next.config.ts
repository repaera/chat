import { withSentryConfig } from "@sentry/nextjs";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// next.config.ts runs before Next.js loads .env.local,
// so we load it manually so `process.env` is available here.
// override: false — do not overwrite env vars that are already set (e.g. from CI/CD)
loadEnv({ path: ".env.local", override: false });

// ALLOWED_DEV_ORIGINS: comma-separated list in .env.local
// Example: ALLOWED_DEV_ORIGINS=https://xxxx.ngrok-free.app,https://yyyy.ngrok-free.app
const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
	? process.env.ALLOWED_DEV_ORIGINS.split(",")
			.map((s) => s.trim())
			.filter(Boolean)
	: [];

// experimental.instrumentationHook removed — it's stable since Next.js 15.
// `instrumentation.ts` is recognized automatically without any flags.
// Docs: https://nextjs.org/blog/next-15#instrumentationjs-stable
const nextConfig: NextConfig = {
	output: "standalone",
	...(allowedDevOrigins.length > 0 && { allowedDevOrigins }),

	// Chat SDK adapter packages are server-only and use require() conditionally.
	// Marking them external prevents Turbopack from trying to bundle them at build
	// time — they are resolved by Node.js at runtime instead.
	serverExternalPackages: [
		"chat",
		"@chat-adapter/telegram",
		"@chat-adapter/whatsapp",
		"@chat-adapter/slack",
		"@chat-adapter/teams",
		"@chat-adapter/gchat",
		"@chat-adapter/discord",
		"@chat-adapter/github",
		"@chat-adapter/linear",
		"@chat-adapter/state-memory",
		"@chat-adapter/state-redis",
	],

	experimental: {
		serverComponentsHmrCache: true,
	},
};

// Sentry only wraps the build if NEXT_PUBLIC_SENTRY_DSN is present
export default process.env.NEXT_PUBLIC_SENTRY_DSN
	? withSentryConfig(nextConfig, {
			org: process.env.SENTRY_ORG,
			project: process.env.SENTRY_PROJECT,
			silent: true,
			widenClientFileUpload: true,
			sourcemaps: { disable: true },
			disableLogger: true,
		})
	: nextConfig;
