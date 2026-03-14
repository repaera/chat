"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

/**
 * Resets Radix UI / Vaul body styles that leak during client-side navigation.
 *
 * Radix dialogs, dropdowns, and Vaul drawers apply styles like
 * `overflow: hidden`, `touch-action: none`, and `data-scroll-locked` to the
 * body/html when open. If the component tree unmounts mid-animation (e.g.
 * during a Next.js route change), the cleanup callback never fires and those
 * styles persist on the new page — causing a mobile touch freeze.
 *
 * useLayoutEffect fires synchronously after DOM updates but before paint, so
 * the styles are cleared before the user can interact with the new page.
 */
export function NavigationReset() {
	const pathname = usePathname();

	useLayoutEffect(() => {
		document.body.removeAttribute("data-scroll-locked");
		document.body.style.removeProperty("overflow");
		document.body.style.removeProperty("touch-action");
		document.body.style.removeProperty("pointer-events");
		document.documentElement.style.removeProperty("overflow");
		document.documentElement.style.removeProperty("touch-action");
	}, [pathname]);

	return null;
}
