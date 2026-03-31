// src/app/api/quota/route.ts
// Returns the user's weekly message quota usage.
// If WEEKLY_MESSAGE_LIMIT is not set, returns { unlimited: true }.

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const limit = process.env.WEEKLY_MESSAGE_LIMIT
		? parseInt(process.env.WEEKLY_MESSAGE_LIMIT, 10)
		: 0;

	if (limit === 0) {
		return Response.json({ unlimited: true });
	}

	const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	const used = await db.message.count({
		where: {
			role: "user",
			conversation: { userId: session.user.id },
			createdAt: { gte: since },
		},
	});

	return Response.json({
		used,
		limit,
		remaining: Math.max(0, limit - used),
	});
}
