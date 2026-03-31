// src/app/api/link/generate/route.ts
// Generate a short-lived verification code for linking a bot platform account.
// The code is stored in the Verification table and consumed by the /link bot command.

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { BotPlatform } from "@/lib/bot/user";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";

const VALID_PLATFORMS: BotPlatform[] = [
	"telegram",
	"whatsapp",
	"slack",
	"teams",
	"gchat",
	"discord",
	"github",
	"linear",
];

export async function POST(request: Request): Promise<Response> {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

	const body = await request.json().catch(() => null);
	const platform = body?.platform as string | undefined;
	if (!platform || !VALID_PLATFORMS.includes(platform as BotPlatform)) {
		return Response.json({ error: "Invalid platform" }, { status: 400 });
	}

	// 6-character uppercase alphanumeric code (avoids ambiguous chars)
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	const code = Array.from(
		{ length: 6 },
		() => chars[Math.floor(Math.random() * chars.length)],
	).join("");

	const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

	// Remove any existing pending codes for this user+platform pair
	await db.verification.deleteMany({
		where: { identifier: `link:${platform}:${session.user.id}` },
	});

	await db.verification.create({
		data: {
			id: newId(),
			identifier: `link:${platform}:${session.user.id}`,
			value: code,
			expiresAt,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});

	return Response.json({ code, expiresAt: expiresAt.toISOString() });
}
