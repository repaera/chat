// src/locales/index.ts
// Loader for locales based on the APP_LOCALE env variable.
//
// Usage in route.ts:
//   import { t } from "@/locales";
//   system: t.system.persona(name)
//
// How to add a new locale:
//   1. Create file src/locales/xx.ts (follow the en.ts structure)
//   2. Add an entry in the `locales` map below
//   3. Set APP_LOCALE=xx in .env.local
//
// Rails equivalent:
//   config/locales/en.yml  →  src/locales/en.ts
//   I18n.t("system.persona")  →  t.system.persona(name)

import de from "./de";
// src/locales/index.ts
import en from "./en";
import es from "./es";
import fr from "./fr";
import id from "./id";
import it from "./it";
import jp from "./jp";
import kr from "./kr";
import nl from "./nl";
import zh from "./zh";

// Contract for all locale files — TypeScript error if a key is missing
export type Locale = typeof en;

// Specialized type for UI strings — used in LocaleProvider
export type UILocale = Locale["ui"];

const locales: Record<string, Locale> = {
	en,
	id,
	kr,
	jp,
	es,
	zh,
	de,
	nl,
	fr,
	it,
};

const activeLocale = (process.env.APP_LOCALE ?? "en").toLowerCase();

// Server-side default — used in route.ts and layout.tsx
// Fallback to "en" if the locale is not recognized
export const t: Locale = locales[activeLocale] ?? en;
export const locale = activeLocale;

// Loader for dynamic import — used in resolveUserLocale()
export { locales };
