// src/app/settings/page.tsx

import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SettingsClient from "@/components/settings/SettingsClient";
import { auth } from "@/lib/auth";

const RETENTION_DAYS = 30;

export const metadata: Metadata = { title: "Settings" };

// Determine which bot platforms are configured (ENV-driven, evaluated server-side).
const PLATFORM_ENV_CHECK: Record<string, () => boolean> = {
	telegram: () => !!process.env.TELEGRAM_BOT_TOKEN,
	whatsapp: () =>
		!!(
			process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN
		),
	slack: () =>
		!!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET),
	teams: () => !!(process.env.TEAMS_APP_ID && process.env.TEAMS_APP_PASSWORD),
	gchat: () => !!process.env.GCHAT_SERVICE_ACCOUNT_KEY,
	discord: () =>
		!!(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_PUBLIC_KEY),
	github: () => !!(process.env.GITHUB_APP_ID && process.env.GITHUB_PRIVATE_KEY),
	linear: () =>
		!!(process.env.LINEAR_API_KEY && process.env.LINEAR_WEBHOOK_SECRET),
};

export default async function SettingsPage() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) redirect("/login");

	const availablePlatforms = Object.entries(PLATFORM_ENV_CHECK)
		.filter(([, check]) => check())
		.map(([platform]) => platform);

	const botHandles: Record<string, string> = {};
	if (process.env.TELEGRAM_BOT_USERNAME) {
		botHandles.telegram = `@${process.env.TELEGRAM_BOT_USERNAME}`;
	}
	if (process.env.WHATSAPP_NUMBER) {
		botHandles.whatsapp = process.env.WHATSAPP_NUMBER;
	}

	return (
		<SettingsClient
			user={{
				id: session.user.id,
				name: session.user.name ?? "",
				email: session.user.email,
				image: session.user.image ?? null,
				locale: (session.user as { locale?: string | null }).locale ?? null,
			}}
			retentionDays={RETENTION_DAYS}
			emailEnabled={!!process.env.RESEND_API_KEY}
			availablePlatforms={availablePlatforms}
			botHandles={botHandles}
		/>
	);
}
