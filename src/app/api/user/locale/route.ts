// src/app/api/user/locale/route.ts
// Called once after the user successfully registers.
// Detect locale from IP + Accept-Language, save to user.locale.
// Idempotent — if user.locale is already set, do not override.

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { detectLocaleFromRequest } from "@/lib/locale";

export async function POST(req: Request) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: { locale: true },
	});

	// Sudah punya locale — skip, tidak override
	if (user?.locale) {
		return Response.json({ locale: user.locale, skipped: true });
	}

	const locale = await detectLocaleFromRequest(req);

	await db.user.update({
		where: { id: session.user.id },
		data: { locale },
	});

	return Response.json({ locale });
}
