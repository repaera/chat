// src/app/api/link/status/route.ts
// Returns which bot platforms are currently linked for the authenticated user.

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { BotPlatform } from "@/lib/bot/user";
import { db } from "@/lib/db";

const PLATFORM_PROVIDERS: BotPlatform[] = [
	"telegram",
	"whatsapp",
	"slack",
	"teams",
	"gchat",
	"discord",
	"github",
	"linear",
];

export async function GET(): Promise<Response> {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

	const accounts = await db.account.findMany({
		where: {
			userId: session.user.id,
			providerId: { in: PLATFORM_PROVIDERS },
		},
		select: { providerId: true, accountId: true },
	});

	const links: Record<string, { linked: boolean; handle: string }> = {};
	for (const platform of PLATFORM_PROVIDERS) {
		const acct = accounts.find((a) => a.providerId === platform);
		links[platform] = { linked: !!acct, handle: acct?.accountId ?? "" };
	}

	return Response.json({ links });
}
