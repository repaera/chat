# SKILLS.md — Reusable Patterns & Solutions

Practical code patterns, solved problems, and idioms specific to this codebase. Reference before implementing anything that sounds familiar.

---

## Pattern: Adding a new API route

```ts
// src/app/api/example/route.ts
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { z } from "zod";

const inputSchema = z.object({
  someId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid request body." }, { status: 400 });

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input.", details: parsed.error.flatten() }, { status: 400 });

  // ... business logic
  return Response.json({ ok: true });
}
```

---

## Pattern: Adding a new locale string

Add to ALL 4 files with the same key path. TypeScript enforces the shape via the return type of `resolveUserLocale`.

```ts
// src/locales/en.ts — inside the appropriate section
toasts: {
  existingKey: "...",
  yourNewKey: "Your new message.",   // ← add here
},

// src/locales/id.ts — same path
  yourNewKey: "Pesan baru Anda.",

// src/locales/kr.ts
  yourNewKey: "새 메시지입니다.",

// src/locales/jp.ts
  yourNewKey: "新しいメッセージです。",
```

---

## Pattern: Adding a system prompt instruction

```ts
// src/locales/en.ts — under system:
system: {
  // existing entries...
  yourInstruction: "Do something specific when X happens.",
},

// All other locale files — same path + translated version

// src/app/api/chat/route.ts — in the system array:
system: [
  t.system.persona(session.user.name ?? "user"),
  // ... existing entries
  t.system.yourInstruction,           // ← add here
  ...(timezone ? [t.system.timezone(timezone)] : []),
].join("\n"),
```

---

## Pattern: Reading locale strings in a server component (page)

```ts
// src/app/some-page/page.tsx (Server Component)
import { resolveUserLocale } from "@/lib/locale";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function SomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const userRecord = await db.user.findUnique({
    where: { id: session?.user.id },
    select: { locale: true },
  });
  const { t } = await resolveUserLocale(userRecord?.locale);

  return <SomeClient cc={t.ui.someSection} />;
}
```

---

## Pattern: Conditional system prompt sections

Only include prompt sections when they are actually relevant:

```ts
system: [
  t.system.persona(session.user.name ?? "user"),
  t.system.tone,
  // Only include image instructions if this conversation has images:
  ...(conversationHasImages ? [
    t.system.imageUrlTag,
    t.system.imageUrlUsage,
    t.system.analyseImage,
  ] : []),
  // Only include time context when provided:
  ...(timezone ? [t.system.timezone(timezone)] : []),
  ...(currentTime ? [t.system.currentTime(currentTime)] : []),
].join("\n"),
```

---

## Pattern: DB query scoped to current user

Always include `userId` in queries to prevent cross-user data access:

```ts
// ✓ Correct — scoped to user
const conv = await db.conversation.findFirst({
  where: { id: conversationId, userId: session.user.id },
});

// ✗ Wrong — trusts client-supplied ID without ownership check
const conv = await db.conversation.findUnique({
  where: { id: conversationId },
});
```

---

## Pattern: Handling Prisma unique constraint violations gracefully

Used when saving messages that might already exist (duplicate submit):

```ts
await db.message.create({ data: { ... } }).catch((err: unknown) => {
  const isPrismaUniqueViolation =
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002";
  if (!isPrismaUniqueViolation) throw err;
});
```

---

## Pattern: In-memory rate limiting

```ts
import { checkRateLimit } from "@/lib/rate-limit";

const result = checkRateLimit(`user:${userId}`, {
  limit: 20,
  windowMs: 60_000, // 1 minute
});
if (!result.success) {
  return Response.json(
    { error: "Too many requests." },
    { status: 429, headers: { "Retry-After": "60" } }
  );
}
```

Note: in-memory — resets on server restart, not safe for multi-instance deployments. For persistent limits, use DB-backed counting (see `docs/weekly-message-limit.md`).

---

## Pattern: DB-backed weekly quota

```ts
const weeklyLimit = process.env.WEEKLY_MESSAGE_LIMIT
  ? parseInt(process.env.WEEKLY_MESSAGE_LIMIT, 10)
  : 0;

if (weeklyLimit > 0) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const count = await db.message.count({
    where: { role: "user", conversation: { userId }, createdAt: { gte: since } },
  });
  if (count >= weeklyLimit) {
    return Response.json({ error: "Weekly limit reached." }, { status: 429 });
  }
}
```

---

## Pattern: Leaflet map (SSR-safe)

Leaflet accesses `window` on import — always use dynamic import:

```tsx
import dynamic from "next/dynamic";

const LeafletMapInner = dynamic(
  () => import("@/components/chat/LeafletMapInner"),
  { ssr: false, loading: () => <div className="h-full bg-zinc-800 animate-pulse rounded-lg" /> }
);
```

Inside `LeafletMapInner.tsx`, the map instance is guarded with a `useEffect` + `mapRef` to prevent the double-init race condition:

```tsx
const mapRef = useRef<L.Map | null>(null);
useEffect(() => {
  if (!containerRef.current || mapRef.current) return;
  mapRef.current = L.map(containerRef.current, { ... });
  return () => { mapRef.current?.remove(); mapRef.current = null; };
}, []);
```

---

## Pattern: New ID generation

```ts
import { newId } from "@/lib/id";

const id = newId(); // UUID v7 — time-ordered, sortable
```

Never use `crypto.randomUUID()` directly — it generates UUID v4 which is not time-ordered.

---

## Pattern: Sentry error capture in API routes

```ts
import * as Sentry from "@sentry/nextjs";

try {
  await someOperation();
} catch (err) {
  Sentry.captureException(err, {
    tags: { source: "your-route:context" },
    extra: { userId, conversationId },
  });
}
```

---

## Pattern: Pre-processing custom message parts before LLM

Custom part types (`location`, `commute`) are not understood by the AI SDK. Convert them to text before `convertToModelMessages`:

```ts
const messagesForLLM = messages.map((msg) => {
  const parts = (msg.parts ?? []) as any[];
  const newParts = parts.flatMap((p: any) => {
    if (p.type === "location") return [{ type: "text" as const, text: formatLocationForLLM(p) }];
    if (p.type === "commute")  return [{ type: "text" as const, text: formatCommuteForLLM(p) }];
    if (p.type === "text" || p.type === "file") return [p];
    return []; // strip unknown types
  });
  if (newParts.length === 0) return { ...msg, parts: [{ type: "text" as const, text: "" }] };
  return { ...msg, parts: newParts };
});
```

---

## Pattern: Rendering a new part type in MessageList

`MessageList.tsx` renders parts in this order: location/commute bubbles → images (file parts) → text → tool parts.

To add a new visual part type:

```tsx
{/* Inside the message parts rendering section */}
{(m.parts ?? [])
  .filter((p) => (p as any).type === "your-type")
  .map((part, i) => (
    <YourComponent key={`yt-${i}`} part={part as YourPartType} />
  ))}
```

Add it before the main bubble `<div>` if it should render outside the bubble (like location bubbles), or inside if it should appear within the message bubble.

---

## Pattern: Handling 410/429 errors from the chat API in ChatClient

The `handleSubmit` catch block checks `err.status`:

```ts
} catch (err: unknown) {
  const errStatus = (err as { status?: number })?.status;
  if (errStatus === 410) {
    toast.error(cc.toasts.imageExpired, { duration: 5000 });
    setPendingImage(null);
  } else if (errStatus === 429) {
    toast.error(cc.toasts.weeklyLimitReached, { duration: 8000 });
  }
}
```

---

## Solved: TypeScript errors after deleting API route files

The Next.js dev server caches route types in `.next/dev/types/validator.ts`. After deleting route files, stale references cause `tsc` errors.

```bash
rm -rf .next
npx tsc --noEmit
```

---

## Solved: `parts: []` causing Zod validation failure

The `chatRequestSchema` requires `parts.min(1)`. If a message somehow ends up with empty parts, the entire request is rejected with a 400.

Guard before every submit:

```ts
const parts = buildParts(); // your parts array
if (parts.length === 0) parts.push({ type: "text", text: "" });
```

---

## Solved: Reasoning tokens causing LLM errors in multi-turn conversations

o-series models (gpt-o1, o3, etc.) include reasoning tokens in their response. If sent back unstripped, the SDK errors because reasoning parts must be followed by a text part.

Solution already in place:
```ts
const modelMessages = pruneMessages({
  messages: normalizedMessages,
  reasoning: "before-last-message",
});
```

Do not remove this call.

