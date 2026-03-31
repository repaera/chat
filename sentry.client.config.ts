import * as Sentry from "@sentry/nextjs";

// Sentry is disabled if NEXT_PUBLIC_SENTRY_DSN is not set
// This ensures the dev environment can run without Sentry configuration
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
	Sentry.init({
		dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
		environment: process.env.NODE_ENV,

		// Only send 10% of traces in production to avoid exceeding quota
		tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

		// Enable session replays only in production
		replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
		replaysOnErrorSampleRate: 1.0,

		integrations: [Sentry.replayIntegration()],

		// Disable console logging in production
		debug: process.env.NODE_ENV === "development",
	});
}
