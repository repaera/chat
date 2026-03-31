// src/app/manifest.ts
import type { MetadataRoute } from "next";
import { appConfig } from "@/lib/app-config";

export default function manifest(): MetadataRoute.Manifest {
	const icons: MetadataRoute.Manifest["icons"] = [];

	if (appConfig.icon192) {
		icons.push({ src: appConfig.icon192, sizes: "192x192", type: "image/png" });
	}
	if (appConfig.icon512) {
		icons.push({
			src: appConfig.icon512,
			sizes: "512x512",
			type: "image/png",
			purpose: "maskable",
		});
	}
	// Fallback if there's no env icon — use default path in public/
	if (icons.length === 0) {
		icons.push(
			{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
			{
				src: "/icon-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		);
	}

	return {
		name: appConfig.name,
		short_name: appConfig.shortName,
		description: appConfig.description,
		start_url: "/",
		display: "standalone",
		orientation: "portrait",
		background_color: appConfig.bgColor,
		theme_color: appConfig.themeColor,
		icons,
	};
}
