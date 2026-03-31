// src/components/chat/LeafletMapInner.tsx
// Inner Leaflet map — always rendered client-side via dynamic import.
// Uses OpenStreetMap tiles (free, no API key).

"use client";

import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { useRef } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";

type MarkerConfig = {
	lat: number;
	lng: number;
	label: string;
	color?: "blue" | "green" | "red";
};

type Props = {
	center: [number, number];
	zoom: number;
	markers: MarkerConfig[];
	fitBounds?: boolean;
};

// Leaflet icon color via CSS filter trick (no extra assets needed)
const COLOR_FILTER: Record<string, string> = {
	green: "hue-rotate(120deg) saturate(1.5)",
	red: "hue-rotate(0deg) saturate(2)",
	blue: "",
};

export default function LeafletMapInner({
	center,
	zoom,
	markers,
	fitBounds,
}: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<LeafletMap | null>(null);

	useMountEffect(() => {
		if (!containerRef.current || mapRef.current) return;
		let cancelled = false;

		// Dynamic import — Leaflet needs window
		import("leaflet").then((L) => {
			if (cancelled || !containerRef.current || mapRef.current) return;
			// Fix default icon paths (broken by webpack/turbopack asset hashing)
			delete (L.Icon.Default.prototype as any)._getIconUrl;
			L.Icon.Default.mergeOptions({
				iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
				iconRetinaUrl:
					"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
				shadowUrl:
					"https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
			});

			const map = L.map(containerRef.current!, {
				center,
				zoom,
				zoomControl: false,
				attributionControl: false,
				dragging: false,
				scrollWheelZoom: false,
				doubleClickZoom: false,
				touchZoom: false,
				keyboard: false,
			});

			L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
				maxZoom: 19,
			}).addTo(map);

			const leafletMarkers: LeafletMarker[] = [];
			markers.forEach(({ lat, lng, label, color = "blue" }) => {
				const icon = L.divIcon({
					className: "",
					html: `<div style="
            width:25px; height:41px;
            background: url('https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png') no-repeat center/contain;
            filter: ${COLOR_FILTER[color] ?? ""};
          "></div>`,
					iconSize: [25, 41],
					iconAnchor: [12, 41],
				});

				const m = L.marker([lat, lng], { icon })
					.addTo(map)
					.bindTooltip(label, { permanent: false, direction: "top" });
				leafletMarkers.push(m);
			});

			if (fitBounds && leafletMarkers.length >= 2) {
				const group = L.featureGroup(leafletMarkers);
				map.fitBounds(group.getBounds().pad(0.2));
			}

			mapRef.current = map;
		});

		return () => {
			cancelled = true;
			mapRef.current?.remove();
			mapRef.current = null;
		};
	});

	return (
		<>
			{/* Leaflet CSS */}
			<link
				rel="stylesheet"
				href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
			/>
			<div
				ref={containerRef}
				className="w-full aspect-square rounded-lg overflow-hidden border border-neutral-200"
				style={{ minHeight: 0 }}
			/>
		</>
	);
}
