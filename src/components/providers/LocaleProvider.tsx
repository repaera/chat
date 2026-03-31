// src/components/providers/LocaleProvider.tsx
// Context provider for UI locale strings.
// The root layout fetches the locale from DB/env (server), then passes it here.
// Client components use useLocale() — no prop drilling required.
//
// Usage:
//   const { t } = useLocale();
//   <h1>{t.register.pageTitle}</h1>

"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { UILocale } from "@/locales";

type LocaleContextValue = {
	t: UILocale;
	locale: string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
	children,
	t,
	locale,
}: {
	children: ReactNode;
	t: UILocale;
	locale: string;
}) {
	return (
		<LocaleContext.Provider value={{ t, locale }}>
			{children}
		</LocaleContext.Provider>
	);
}

export function useLocale(): LocaleContextValue {
	const ctx = useContext(LocaleContext);
	if (!ctx) {
		throw new Error("useLocale() must be used inside <LocaleProvider>");
	}
	return ctx;
}
