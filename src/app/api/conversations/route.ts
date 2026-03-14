import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { createConversationSchema } from "@/lib/schemas";

const PAGE_SIZE = 10;

// ── GET /api/conversations ────────────────────────────────────
// List conversations for the current user, ordered by most recently updated.
// Supports cursor-based pagination: pass ?cursor=<updatedAt ISO> to get the next page.
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");

  const raw = await db.conversation.findMany({
    where: {
      userId: session.user.id,
      ...(cursor ? { updatedAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: PAGE_SIZE,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  const conversations = raw.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    preview: c.messages[0]?.content ?? null,
  }));

  return Response.json({ conversations, hasMore: raw.length === PAGE_SIZE });
}

// ── POST /api/conversations ───────────────────────────────────
// Create a new conversation explicitly (optional — a conversation
// can also be created automatically by /api/chat when conversationId is not provided).
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Input is not valid.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const conversation = await db.conversation.create({
    data: {
      id: newId(), // UUID v7 — time-ordered
      userId: session.user.id,
      title: parsed.data.title ?? null,
    },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });

  return Response.json({ conversation }, { status: 201 });
}