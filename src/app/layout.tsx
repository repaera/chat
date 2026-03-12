// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { GtmScript, GtmNoScript } from "@/components/providers/gtm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { resolveUserLocale } from "@/lib/locale";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { appConfig } from "@/lib/app-config";
import "./globals.css";

// Metadata is generated dynamically based on the server default locale.
// Per-user locale cannot be used in generateMetadata because there is no session
// here without sacrificing static optimization — the server default is sufficient.
export const viewport: Viewport = {
  themeColor: appConfig.themeColor,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,      // <-- Add this
  userScalable: false,  // <-- Add this
};

export async function generateMetadata(): Promise<Metadata> {
  const { ui } = await resolveUserLocale(null); // use APP_LOCALE / "en"
  const description = ui.meta.description;
  const ogImage = appConfig.ogImage ?? `${appConfig.url}/og.png`;

  return {
    title: { default: appConfig.name, template: `%s | ${appConfig.name}` },
    description,
    applicationName: appConfig.name,
    manifest: "/manifest.webmanifest",

    // ── Icons ──────────────────────────────────────────────────────
    icons: {
      ...(appConfig.favicon       && { shortcut: appConfig.favicon }),
      ...(appConfig.iconSvg       && { icon: [{ url: appConfig.iconSvg, type: "image/svg+xml" }] }),
      ...(appConfig.icon192       && { icon: [{ url: appConfig.icon192, sizes: "192x192", type: "image/png" }] }),
      ...(appConfig.appleTouchIcon && { apple: appConfig.appleTouchIcon }),
    },

    // ── Open Graph ─────────────────────────────────────────────────
    openGraph: {
      type: "website",
      url: appConfig.url,
      siteName: appConfig.name,
      title: appConfig.name,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: appConfig.name }],
    },

    // ── Twitter / X ────────────────────────────────────────────────
    twitter: {
      card: appConfig.twitterCard,
      title: appConfig.name,
      description,
      images: [ogImage],
      ...(appConfig.twitterSite && { site: appConfig.twitterSite }),
    },

    // ── Disable Google Translate popup ─────────────────────────────
    other: {
      "google": "notranslate",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get user's locale from session — double try/catch:
  // outer: guard resolveUserLocale, inner: guard getSession.
  // LocaleProvider MUST always be rendered, no matter what.
  let resolved: Awaited<ReturnType<typeof resolveUserLocale>>;
  try {
    let userLocale: string | null = null;
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      userLocale = (session?.user as { locale?: string | null } | undefined)?.locale ?? null;
    } catch {
      // No session (public page) — continue with null
    }
    resolved = await resolveUserLocale(userLocale);
  } catch {
    // resolveUserLocale failed completely — fallback to en
    resolved = await resolveUserLocale(null);
  }

  const mapsKey = appConfig.googleMapsKey;
  // Map app locale → BCP 47 language code for Google Maps API
  const LOCALE_TO_MAPS_LANG: Record<string, string> = {
    en: "en",
    id: "id",
    kr: "ko",
    jp: "ja",
  };
  const mapsLang = LOCALE_TO_MAPS_LANG[resolved.locale] ?? "en";

  return (
    <html lang={resolved.ui.meta.htmlLang} translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        <GtmScript />
        {mapsKey && appConfig.locationMode === "v2" && (
          <script
            async
            src={[
              `https://maps.googleapis.com/maps/api/js?key=${mapsKey}`,
              `&libraries=places,routes&loading=async`,
              appConfig.googleMapsRegion   ? `&region=${appConfig.googleMapsRegion}`   : "",
              mapsLang !== "en" ? `&language=${mapsLang}` : "",
            ].join("")}
          />
        )}
      </head>
      <body className="antialiased overscroll-none">
        <GtmNoScript />
        <NuqsAdapter>
          <LocaleProvider t={resolved.ui} locale={resolved.locale}>
            {children}
            <Toaster position="top-center" richColors theme="light" />
          </LocaleProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
