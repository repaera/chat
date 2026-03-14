# CLAUDE.md — Project Summary

This file is auto-loaded by Claude Code on every session. Read it fully before touching any code.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| AI | Vercel AI SDK v6, 9 LLM providers (see `src/lib/llm.ts`) |
| Database | Prisma v7, SQLite (dev) / PostgreSQL / MariaDB (prod) |
| Auth | Better Auth v1.5 — email/password + Google OAuth + email verification |
| Storage | Cloudflare R2 via AWS SDK (`@aws-sdk/client-s3`) |
| Jobs | Trigger.dev v3 — scheduled cleanup tasks |
| Linting | Biome — **tabs**, **double quotes** |
| Testing | Vitest + Playwright |
| i18n | Static TypeScript files — `en`, `id`, `kr`, `jp`, `es`, `zh`, `de`, `nl`, `fr`, `it` |

---

## Key File Map

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts              # LLM streaming — system prompt, MCP, rate limit, onFinish persistence
│   │   ├── messages/route.ts          # Cursor-based pagination (20/page), returns UIMessage[]
│   │   ├── conversations/route.ts     # List + create conversations
│   │   ├── conversations/[id]/route.ts# Delete conversation
│   │   ├── upload/route.ts            # R2 image upload, orphan lifecycle start
│   │   ├── upload/heartbeat/route.ts  # Refreshes lastSeenAt to keep orphan alive
│   │   ├── distance/route.ts          # Google Distance Matrix (locationMode v2 only)
│   │   └── user/locale/route.ts       # Save user locale preference
│   └── (pages)/                       # Server components — pass locale strings to client
│
├── components/
│   ├── chat/
│   │   ├── ChatClient.tsx             # Main chat UI — useChat hook, scroll, pagination
│   │   ├── MessageList.tsx            # Renders all message parts (text, file, tool, location, commute)
│   │   ├── TypedText.tsx              # Typed.js wrapper — animates text on new assistant messages + header title
│   │   ├── ChatInput.tsx              # Input bar — text, image, location buttons
│   │   ├── ImageUploadButton.tsx      # Upload to R2, heartbeat loop, attach on submit
│   │   ├── LocationDialog.tsx         # Place search / commute UI (Google Maps v2)
│   │   ├── PlaceSearchField.tsx       # Autocomplete input wrapper
│   │   ├── LocationBubble.tsx         # Renders LocationPart + CommutePart bubbles
│   │   ├── LeafletMapInner.tsx        # Leaflet map (dynamic import, SSR-safe)
│   │   └── location-types.ts          # LocationPart, CommutePart types + formatForLLM helpers
│   ├── layout/
│   │   └── ChatLayout.tsx             # Sidebar + conversation list + sign-out
│   ├── settings/
│   │   └── SettingsClient.tsx         # Profile, security, account deletion
│   └── providers/
│       ├── LocaleProvider.tsx         # React context for locale strings
│       └── gtm.tsx                    # Google Tag Manager (optional)
│
├── lib/
│   ├── app-config.ts                  # All env-var-driven config (branding, AI persona, location mode)
│   ├── auth.ts                        # Better Auth server config
│   ├── auth-client.ts                 # Better Auth browser client
│   ├── db.ts                          # Prisma singleton + adapter factory
│   ├── id.ts                          # newId() — UUID v7 (time-ordered)
│   ├── llm.ts                         # resolveModel() — picks provider from env vars
│   ├── locale.ts                      # resolveUserLocale() — DB → APP_LOCALE → "en"
│   ├── rate-limit.ts                  # In-memory sliding window (NOT multi-replica safe)
│   ├── schemas.ts                     # Zod schemas — chatRequest, upload, heartbeat
│   ├── storage.ts                     # uploadToR2(), deleteFromR2()
│   └── compress-image.ts              # Client-side image compression before upload
│
├── locales/
│   ├── en.ts                          # English — system prompt strings + all UI strings
│   ├── id.ts                          # Bahasa Indonesia
│   ├── kr.ts                          # Korean
│   └── jp.ts                          # Japanese
│
├── hooks/
│   ├── use-image-heartbeat.ts         # Heartbeat ping every 30s while image is pending
│   ├── use-mobile.ts                  # Touch-screen device detection
│   └── use-place-autocomplete.ts      # Google Places autocomplete hook (v2 only)
│
└── trigger/
    ├── cleanup-orphan-images.ts       # Hourly — deletes R2 images with no messageId
    └── cleanup-old-conversations.ts   # Daily — deletes conversations past retention days
```

---

## Database Models

```
User          → id (UUID v7), name, email, locale, emailVerified
Session       → Better Auth managed
Account       → OAuth provider links
Verification  → Email verification tokens
Conversation  → id, userId, title, updatedAt, createdAt
Message       → id, conversationId, role, content, customParts (JSON), createdAt
Image         → id, userId, messageId (nullable), url, key (R2), mimeType, lastSeenAt, attachedAt
```

Cascade: `User → Conversations → Messages → Images`
`Image.messageId = null` = orphan (not yet attached or expired)

---

## LLM Pipeline Flow (`src/app/api/chat/route.ts`)

1. Verify session (Better Auth)
2. Per-minute rate limit — 20 msgs/min, in-memory (`rate-limit.ts`)
3. Parse + validate body (`chatRequestSchema`)
4. Validate uploaded image still exists as orphan in DB
5. Resolve/create conversation
6. Save last user message to DB; auto-title if first message
7. Connect MCP clients (`MCP_URL`, `MCP_APPS_URL`) — JWT auth via `MCP_JWT_SECRET`
8. Pre-process messages: convert `location`/`commute` parts → text via `formatLocationForLLM`
9. `convertToModelMessages` → UIMessage[] to ModelMessage[]
10. Azure provider: fetch images as base64 Uint8Array; all providers: inject `[image_url: url]` hint
11. `pruneMessages` — strips reasoning tokens from old messages
12. `streamText` — system prompt, tools, `stopWhen: stepCountIs(5)`
13. `toUIMessageStreamResponse` → `onFinish`: save assistant message, attach images to user message

---

## System Prompt Structure

```ts
t.system.persona(name)           // "You are a helpful personal AI assistant for {name}."
appConfig.personaContext          // optional domain specialization
t.system.helpWithTools
t.system.tone                     // responds in user's locale language
t.system.proactiveTools
t.system.imageUrlTag              // always included — see token-efficiency.md for fix
t.system.imageUrlUsage
t.system.imageUrlToolHint
t.system.analyseImage
t.system.timezone(tz)             // optional
t.system.currentTime(dt)          // optional
```

---

## Image Upload Lifecycle

```
User selects image
  → client compress-image.ts
  → POST /api/upload → saved to R2, Image row (messageId=null, lastSeenAt=now)
  → ImageUploadButton starts heartbeat interval → POST /api/upload/heartbeat every 30s
  → user hits Send → ChatClient attaches {type:"file", mediaType, url} to message
  → route.ts validates orphan exists → onFinish attaches Image to user message (messageId set)
  → cleanup job skips attached images
```

Orphan cleanup: hourly Trigger.dev job deletes images where `messageId=null AND lastSeenAt < 1h ago`.

---

## Location Sharing

- `locationMode: "v1"` — browser geolocation only, no API key
- `locationMode: "v2"` — Google Places autocomplete + commute via Distance Matrix API
  Requires: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (client, Places), `GOOGLE_MAPS_API_KEY` (server, Distance Matrix)
  Optional: `NEXT_PUBLIC_GOOGLE_MAPS_REGION` (ISO 3166-1 alpha-2, biases results)

Custom parts (`LocationPart`, `CommutePart`) are stored as JSON in `Message.customParts`, converted to text before being sent to the LLM.

---

## i18n

- Locale resolution chain: `user.locale` (DB) → `APP_LOCALE` env → geo-detection → `"en"`
- All UI and system prompt strings live in `src/locales/<lang>.ts`
- Chat hint and suggestion strings are locale-only — customise them in `src/locales/*.ts` (`ui.emptyHint`, `ui.suggestions`). There are no env var overrides.
- `APP_PERSONA_CONTEXT` is server-only and English-only (system prompt only, not user-facing)

---

## LLM Providers (`src/lib/llm.ts`)

Auto-detected by first present API key. Override with `LLM_PROVIDER`.

| Provider | Key var | Model var | Default model |
|---|---|---|---|
| azure-openai | `AZURE_OPENAI_API_KEY` | `AZURE_OPENAI_DEPLOYMENT` | gpt-4o-mini |
| anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` | claude-haiku-4-5-20251001 |
| openai | `OPENAI_API_KEY` | `OPENAI_MODEL` | gpt-4o-mini |
| bedrock | `AWS_ACCESS_KEY_ID` | `BEDROCK_MODEL` | claude-3-5-haiku |
| vertex | `GOOGLE_VERTEX_PROJECT` | `VERTEX_MODEL` | gemini-2.0-flash |
| fireworks | `FIREWORKS_API_KEY` | `FIREWORKS_MODEL` | llama-v3p3-70b |
| xai | `XAI_API_KEY` | `XAI_MODEL` | grok-3-mini |
| azure-foundry | `AZURE_FOUNDRY_API_KEY` | `AZURE_FOUNDRY_MODEL` | gpt-4o-mini |
| openrouter | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` | gemini-2.0-flash-exp:free |

Azure providers require server-side image prefetch (images fetched as base64 before sending to LLM).

---

## MCP Integration

Choose **one** endpoint — setting both `MCP_URL` and `MCP_APPS_URL` is rejected at runtime with a `500` error.

```env
MCP_URL=         # Generic MCP server (Rails, Laravel, Spring, etc.) — tools only
MCP_TOKEN=       # Bearer token for MCP_URL
MCP_APPS_URL=    # TypeScript ext-apps server — tools + embedded UI (MCP Apps)
MCP_APPS_TOKEN=  # Bearer token for MCP_APPS_URL
MCP_JWT_SECRET=  # If set, injects a 30s JWT as X-User-Token header (user identity)
```

Chat continues normally if neither is set.

---

## Rate Limits

- **Per-minute**: `await checkRateLimit("user:{id}", { limit: 20, windowMs: 60_000 })` — async, returns `Promise<RateLimitResult>`
  - No `REDIS_URL`: in-memory sliding window (single-instance only, resets on restart)
  - With `REDIS_URL`: Redis sorted-set sliding window shared across all replicas (`src/lib/redis.ts` — ioredis singleton, any Redis-compatible host)

---

## Commands

```bash
npm run dev          # Dev server (Next.js)
npm run check        # Biome lint + format check
npm run test:run     # Vitest unit tests
npm run test:e2e     # Playwright end-to-end
npm run db:migrate   # Prisma migrate dev
npm run db:studio    # Prisma Studio GUI
```

---

## Git Policy

**Never run any git commands.** No `git add`, `git commit`, `git push`, `git reset`, `git checkout`, `git merge`, or any other git operation. All version control is managed exclusively by the user.

---

## Known Decisions & Gotchas

- **UUID v7** everywhere for PKs — use `newId()` from `src/lib/id.ts`, never `crypto.randomUUID()`
- **`pruneMessages`** strips reasoning tokens from old messages — required for o-series models which error if reasoning parts aren't followed by text
- **`chatRequestSchema`** uses a generic UUID regex (not `z.string().uuid()`) because `.uuid()` only validates v4
- **`parts: []` is invalid** — Zod schema requires `min(1, "at least 1 part required")`; always ensure at least one part before sending
- **`[image_url: url]` injection** runs for ALL historical images on every turn — a known token waste (see `docs/token-efficiency.md`)
- **`rate-limit.ts`** is in-memory only — resets on server restart, not safe for multi-instance deployments
- **Leaflet** must be loaded with `dynamic(() => import(...), { ssr: false })` — has a race condition with the container div; `LeafletMapInner` handles this with a `useEffect` guard
- **`locales/`** file structure: `system.*` = server-only prompt strings, `ui.*` = client-side UI strings. Both live in the same file per locale.
- **`APP_PERSONA_CONTEXT`** injects into system prompt as `"You specialize in: {value}."` — English only, fine since the LLM still responds in user's locale via `t.system.tone`
- **`PRESERVE_IMAGES=true`** skips R2 object deletion in both the manual DELETE route and the daily cleanup job — DB cascade still removes Image rows, but R2 objects remain accessible. Use this when an MCP server stores R2 image URLs in its own DB. Storage grows indefinitely; manage via R2 bucket lifecycle rules.

