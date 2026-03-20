// src/app/api/webhooks/[platform]/route.ts
// Single dynamic route for all Chat SDK platform webhooks.
// Delegates to bot.webhooks.<platform>(request) — the SDK handles verification,
// parsing, deduplication, and routing for each adapter.

import { after } from "next/server";
import { bot } from "@/lib/bot";

type Params = { params: Promise<{ platform: string }> };

function getHandler(platform: string) {
	if (!bot) return null;
	const webhooks = bot.webhooks as Record<string, ((req: Request, opts?: { waitUntil?: (p: Promise<unknown>) => void }) => Promise<Response>) | undefined>;
	return webhooks[platform] ?? null;
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
	const { platform } = await params;
	const handler = getHandler(platform);
	if (!handler) return new Response("Not found", { status: 404 });
	return handler(request, { waitUntil: (task) => after(() => task) });
}

// Some platforms (WhatsApp, Discord, Google Chat) send GET requests for webhook verification.
export async function GET(request: Request, { params }: Params): Promise<Response> {
	const { platform } = await params;
	const handler = getHandler(platform);
	if (!handler) return new Response("Not found", { status: 404 });
	return handler(request);
}
