// src/lib/app-config.ts
// Single source of truth for all branding/PWA config.
// All values can be overridden via environment variables.
// NEXT_PUBLIC_* available on client & server.
// Non-NEXT_PUBLIC_* only available on server (for metadata generation).

export const appConfig = {
  // ── Identity ────────────────────────────────────────────────────
  name:        process.env.NEXT_PUBLIC_APP_NAME        ?? "Chat",
  shortName:   process.env.NEXT_PUBLIC_APP_SHORT_NAME  ?? "Chat",
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION ?? "Your personal AI assistant",
  url:         process.env.NEXT_PUBLIC_APP_URL          ?? "http://localhost:3000",

  // ── Branding ────────────────────────────────────────────────────
  // themeColor: browser toolbar color on mobile (PWA header bar)
  themeColor:  process.env.NEXT_PUBLIC_APP_THEME_COLOR  ?? "#ffffff",
  // bgColor: splash screen background on PWA launch
  bgColor:     process.env.NEXT_PUBLIC_APP_BG_COLOR     ?? "#ffffff",

  // ── Icons ───────────────────────────────────────────────────────
  // All icon URLs can be absolute (https://cdn.example.com/icon.png)
  // or relative path (/icon.png — from public/).
  // If not set, Next.js uses files in app/ or public/ automatically.
  favicon:         process.env.APP_FAVICON_URL          ?? null, // /favicon.ico
  iconSvg:         process.env.APP_ICON_SVG_URL         ?? null, // /icon.svg
  icon192:         process.env.APP_ICON_192_URL          ?? null, // /icon-192.png
  icon512:         process.env.APP_ICON_512_URL          ?? null, // /icon-512.png
  appleTouchIcon:  process.env.APP_APPLE_TOUCH_ICON_URL ?? null, // /apple-touch-icon.png

  // ── OG / Social ─────────────────────────────────────────────────
  ogImage:     process.env.APP_OG_IMAGE_URL             ?? null, // /og.png (1200×630)
  twitterCard: (process.env.APP_TWITTER_CARD ?? "summary_large_image") as
    "summary" | "summary_large_image" | "app" | "player",
  twitterSite: process.env.APP_TWITTER_SITE             ?? null, // "@yourhandle"

  // ── AI persona ─────────────────────────────────────────────────
  // Brief domain description injected into the system prompt.
  // e.g. "online food delivery service", "handyman booking platform"
  // Leave empty for a fully generic assistant.
  personaContext: process.env.APP_PERSONA_CONTEXT ?? "",

  // ── Help center ────────────────────────────────────────────────
  // If set, a help button appears in the chat header linking to this URL.
  helpCenterUrl: process.env.NEXT_PUBLIC_APP_HELP_URL ?? null,

  // ── Location sharing ───────────────────────────────────────────
  // "v1" = browser geolocation only (no API key needed)
  // "v2" = Google Places search + commute (requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
  locationMode:   (process.env.NEXT_PUBLIC_LOCATION_MODE ?? "v1") as "v1" | "v2",
  googleMapsKey:  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  // region: ISO 3166-1 alpha-2 country code — biases search results to a country
  // e.g. "ID" for Indonesia, "JP" for Japan, "KR" for Korea, leave empty for global
  googleMapsRegion: process.env.NEXT_PUBLIC_GOOGLE_MAPS_REGION ?? "",
  // Note: Maps language follows user locale automatically (set in layout.tsx)
  // No need to set manually — derived from user's locale preference.
} as const;
