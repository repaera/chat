// src/lib/locale.ts
// Utility to detect and resolve user locale.
//
// Priority chain (highest to lowest):
//   1. user.locale in DB  — user has set it (manually or auto-detected at registration)
//   2. APP_LOCALE env     — sysadmin default
//   3. "en"               — hard fallback

import type { Locale } from "@/locales";
import { t as defaultT } from "@/locales";
import en from "@/locales/en";
import id from "@/locales/id";
import kr from "@/locales/kr";
import jp from "@/locales/jp";
import es from "@/locales/es";
import zh from "@/locales/zh";
import de from "@/locales/de";
import nl from "@/locales/nl";
import fr from "@/locales/fr";
import it from "@/locales/it";

// Static map — the bundler needs to know which files may be imported.
// Dynamic import with template literals cannot be tree-shaken by webpack/turbopack.
// Add a new entry here whenever a new locale file is added.
const LOCALE_MAP: Record<string, Locale> = { en, id, kr, jp, es, zh, de, nl, fr, it };

// Map country code ISO 3166-1 alpha-2 → locale key
// Add new entry if there is a new locale file in src/locales/
export const COUNTRY_TO_LOCALE: Record<string, string> = {
  ID: "id", // Indonesia
  KR: "kr", // South Korea
  JP: "jp", // Japan
  CN: "zh", // China
  TW: "zh", // Taiwan
  ES: "es", // Spain
  MX: "es", // Mexico
  AR: "es", // Argentina
  CO: "es", // Colombia
  CL: "es", // Chile
  PE: "es", // Peru
  VE: "es", // Venezuela
  EC: "es", // Ecuador
  BO: "es", // Bolivia
  PY: "es", // Paraguay
  UY: "es", // Uruguay
  CR: "es", // Costa Rica
  PA: "es", // Panama
  HN: "es", // Honduras
  DO: "es", // Dominican Republic
  SV: "es", // El Salvador
  NI: "es", // Nicaragua
  GT: "es", // Guatemala
  CU: "es", // Cuba
  DE: "de", // Germany
  AT: "de", // Austria
  CH: "de", // Switzerland (German-speaking majority)
  NL: "nl", // Netherlands
  BE: "nl", // Belgium (Dutch-speaking majority)
  FR: "fr", // France
  LU: "fr", // Luxembourg
  MC: "fr", // Monaco
  IT: "it", // Italy
  SM: "it", // San Marino
  VA: "it", // Vatican City
  // US, GB, AU, CA, etc → no need to list, will fallback to "en"
};

// Map BCP 47 language tag → locale key (also used by bot platform locale detection)
export const LANG_TO_LOCALE: Record<string, string> = {
  id: "id",
  ko: "kr",
  ja: "jp",
  es: "es",
  zh: "zh",
  de: "de",
  nl: "nl",
  fr: "fr",
  it: "it",
  en: "en",
};

// Map Accept-Language header value → locale key
// Example header: "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
function parseAcceptLanguage(header: string | null): string | null {
  if (!header) return null;
  // Take the first language code (highest priority)
  const primary = header.split(",")[0]?.split(";")[0]?.trim().toLowerCase();
  if (!primary) return null;
  // "id-id" → "id", "ko-kr" → "ko" → "kr" (special mapping)
  const lang = primary.split("-")[0];
  return LANG_TO_LOCALE[lang] ?? null;
}

// Detect locale from IP + Accept-Language header.
// Called during registration — the result is stored to user.locale in the DB.
// Does not throw — always returns a string (fallback to APP_LOCALE / "en").
export async function detectLocaleFromRequest(req: Request): Promise<string> {
  const appLocale = (process.env.APP_LOCALE ?? "en").toLowerCase();

  // Get IP from headers (proxy-aware)
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() ?? realIp ?? null;

  // Skip loopback / local IP (dev environment)
  const isLocalIp = !ip || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.");

  // ── Flow 3: IP Geolocation via IPinfo Lite ───────────────────
  // IPinfo Lite: unlimited, no API key, IPv4 + IPv6, HTTPS, country-level only.
  // Endpoint /country return plain text "ID\n" — very lightweight.
  // Docs: https://ipinfo.io/lite
  if (!isLocalIp && ip) {
    const geoUrl = `https://ipinfo.io/${ip}/country`;
    try {
      const geoRes = await fetch(geoUrl, {
        signal: AbortSignal.timeout(2000),
        headers: { Accept: "text/plain" },
      });

      if (geoRes.ok) {
        const countryCode = (await geoRes.text()).trim().toUpperCase();

        if (countryCode && countryCode.length === 2) {
          const geoLocale = COUNTRY_TO_LOCALE[countryCode];
          if (geoLocale) {
            return geoLocale;
          }
        }
      }
    } catch {
      // Geo failed (timeout, network error) — proceed to Accept-Language fallback
    }
  }

  // ── Flow 4: Accept-Language fallback ─────────────────────────
  const acceptLang = req.headers.get("accept-language");
  const langLocale = parseAcceptLanguage(acceptLang);
  if (langLocale) {
    return langLocale;
  }

  // ── Fallback: APP_LOCALE env ──────────────────────────────────
  return appLocale;
}

// Resolve locale object for the user — used in route.ts and layout.tsx.
// Return { t, locale } — t for strings, locale for the html lang attribute.
export async function resolveUserLocale(
  userLocale: string | null | undefined
): Promise<{ t: Locale; ui: Locale["ui"]; locale: string }> {
  const key = (userLocale ?? process.env.APP_LOCALE ?? "en").toLowerCase();

  // Static map lookup — do not use dynamic import because webpack
  // cannot bundle template literal imports correctly.
  const t = LOCALE_MAP[key] ?? LOCALE_MAP["en"] ?? defaultT;
  const resolvedLocale = LOCALE_MAP[key] ? key : "en";
  // expose ui directly so the caller doesn't need to access t.ui manually
  return { t, ui: t.ui, locale: resolvedLocale };
}
