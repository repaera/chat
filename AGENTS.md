# AGENTS.md — Working Instructions for AI Agents

Instructions for any AI agent (Claude Code or otherwise) working on this codebase. Read `CLAUDE.md` first for full project context.

---

## Before You Write Any Code

1. **Read `CLAUDE.md`** — full project map, stack, and gotchas
2. **Read the target file** before editing — never modify a file you haven't read
3. **Run `npm run check`** after edits to catch Biome lint/format issues

---

## Code Style Rules (Biome enforced)

- **Indentation**: tabs (not spaces)
- **Quotes**: double quotes `"` (not single)
- **No semicolons** beyond what TypeScript requires
- **No unused variables** — Biome will flag them
- **Imports**: no barrel `index.ts` re-exports unless already present
- Run `npm run check` before considering any task done

---

## TypeScript Conventions

- **All IDs**: use `newId()` from `src/lib/id.ts` — never `crypto.randomUUID()` (UUID v7 required)
- **Zod UUID**: use regex `/^[0-9a-f]{8}-...-[0-9a-f]{12}$/i` not `z.string().uuid()` (v4 only)
- **UIMessage parts**: `parts` must have at least 1 element — the schema enforces `min(1)`
- **Server-only imports**: `import "server-only"` at top of any lib used only in API routes
- **Type casts over `as any`**: prefer `as unknown as TargetType` for SDK type incompatibilities

---

## API Route Conventions

- Always verify session first: `auth.api.getSession({ headers: await headers() })`
- Return `Response.json({ error: "..." }, { status: N })` for all errors — never throw
- Validate all input with Zod before using any value
- Use `db.conversation.findFirst({ where: { id, userId } })` pattern — never trust client-supplied IDs without a userId check
- 401 = unauthenticated, 403 = unauthorized, 404 = not found, 410 = expired resource, 429 = rate limited

---

## Database (Prisma)

- **Never** call `db.user.findUnique` then write in two separate queries without a transaction where race conditions matter
- **Cascade deletes** are configured at DB level (`onDelete: Cascade`) — deleting a User deletes everything
- **Orphan images**: `Image.messageId = null` means not yet attached. Don't touch these unless you're the cleanup job or the `onFinish` handler
- **Migrations**: after schema changes run `npm run db:migrate` — never edit the migration files manually
- After deleting API route files, always `rm -rf .next` to clear the TypeScript validator cache

---

## Locale System

**Adding a new UI string:**
1. Add to `src/locales/en.ts` under the appropriate `ui.*` key
2. Mirror the same key in all other locale files (`id.ts`, `kr.ts`, `jp.ts`, `es.ts`, `zh.ts`, `de.ts`, `nl.ts`, `fr.ts`, `it.ts`) with translations
3. The key path must match exactly across all 10 files — TypeScript will error if it doesn't

**Adding a new system prompt string:**
1. Add to `src/locales/en.ts` under `system.*`
2. Mirror in all other locale files
3. Reference in `route.ts` as `t.system.yourKey`

Chat hint and suggestion strings live in the locale files (`ui.emptyHint`, `ui.suggestions`) — there are no env var overrides for these.

---

## LLM / Chat Pipeline

**Do not change these without understanding the full chain:**

- `messagesForLLM` pre-processes custom parts (`location`, `commute`) → text
- `convertToModelMessages` must run on the pre-processed array, not the raw client messages
- `pruneMessages({ reasoning: "before-last-message" })` is required for o-series models
- `onFinish` saves the assistant message AND attaches user images — both must succeed
- `stopWhen: stepCountIs(5)` limits agentic loops to 5 steps

**Changing the system prompt:** add/remove entries from the array in `streamText({ system: [...].join("\n") })`. Always use `t.system.*` keys, never hardcode English strings there.

---

## Image Upload Flow

Any change to the upload flow must preserve this invariant:

> An `Image` row with `messageId=null` is an orphan and will be deleted by the hourly cleanup job. It must be attached (messageId set) in `onFinish` before the job runs.

- Upload → `Image.messageId = null`, `lastSeenAt = now`
- Heartbeat → refreshes `lastSeenAt` every 30s while user is composing
- Submit → `route.ts` validates orphan exists → `onFinish` sets `messageId`
- Never set `messageId` before `onFinish` — the user might cancel
- Attached images are deleted from R2 when the conversation is deleted (manual or auto-cleanup), **unless `PRESERVE_IMAGES=true`** — set this when an external MCP server stores R2 image URLs in its own DB

---

## Location Features

- `locationMode: "v1"` — browser geolocation only, no external API
- `locationMode: "v2"` — requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (client, Places autocomplete) + `GOOGLE_MAPS_API_KEY` (server, Distance Matrix proxy)
- Custom parts (`LocationPart`, `CommutePart`) flow: stored in `Message.customParts` as JSON → loaded back in `messages/route.ts` → converted to text in `route.ts` before LLM sees them
- `LeafletMapInner.tsx` must always be `dynamic(() => ..., { ssr: false })` — Leaflet breaks SSR

---

## MCP Tools

- Only **one** MCP endpoint is active at a time — `MCP_URL` OR `MCP_APPS_URL`, never both
- Setting both returns a `500` misconfiguration error before any LLM call is made
- MCP clients are closed in both `onError` and `onFinish` — always close in both
- If a client fails to connect, log to Sentry and continue (chat works without tools)
- JWT auth: if `MCP_JWT_SECRET` is set, a 30s JWT is injected as `X-User-Token` for user identity propagation

---

## Testing

- Unit tests: `npm run test:run` (Vitest)
- E2E: `npm run test:e2e` (Playwright)
- TypeScript check only: `npx tsc --noEmit`
- After deleting files or renaming exports: `rm -rf .next && npx tsc --noEmit`

---

## Adding a New Feature Checklist

- [ ] Read all files you will touch
- [ ] Check `docs/` for relevant existing guides
- [ ] Locale strings added to all 10 locale files with matching keys
- [ ] Zod validation for any new API input
- [ ] Session verified at top of any new API route
- [ ] Error responses use correct HTTP status codes
- [ ] New DB fields have a migration (`npm run db:migrate`)
- [ ] `npm run check` passes
- [ ] `npx tsc --noEmit` passes

---

## What NOT to Do

- **Never run any git commands** — no `git add`, `git commit`, `git push`, `git reset`, `git checkout`, `git merge`, or any other git operation. All version control is managed by the user.
- Do not add `console.log` in production paths — use `Sentry.captureException` for errors
- Do not hardcode English strings in the system prompt — use `t.system.*` locale keys
- Do not add markdown rendering to `MessageList.tsx` text parts — current design uses plain text + `Linkify` intentionally
- Do not add new icon libraries beyond `lucide-react` — the project uses lucide-react for all icons
- Do not create barrel `index.ts` files
- Do not add `// eslint-disable` comments — use Biome ignore syntax if truly needed
- Do not skip `npm run check` before calling a task done
