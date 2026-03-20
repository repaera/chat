// src/app/api/link/[platform]/route.ts
// Unlinks a bot platform account from the authenticated user.

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ platform: string }> },
): Promise<Response> {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

	const { platform } = await params;

	await db.account.deleteMany({
		where: { userId: session.user.id, providerId: platform },
	});

	return new Response(null, { status: 204 });
}
