// src/components/chat/LocationBubble.tsx
"use client";

import { ArrowRightLeft, MapPin, Navigation } from "lucide-react";
import dynamic from "next/dynamic";
import type {
	CommutePart,
	LocationPart,
} from "@/components/chat/location-types";
import { useLocale } from "@/components/providers/LocaleProvider";

// Dynamic import — Leaflet requires window, cannot be server-side rendered
const LeafletMapInner = dynamic(
	() => import("@/components/chat/LeafletMapInner"),
	{
		ssr: false,
		loading: () => (
			<div className="w-full aspect-square rounded-lg border border-neutral-200 bg-neutral-100 animate-pulse" />
		),
	},
);

// ── Location Bubble ───────────────────────────────────────────────────────────

export function LocationBubble({ part }: { part: LocationPart }) {
	const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${part.lat},${part.lng}`;
	return (
		<div className="mt-1 flex flex-col gap-1.5">
			<a
				href={gmapsUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="block w-full hover:opacity-90 transition-opacity"
			>
				<LeafletMapInner
					center={[part.lat, part.lng]}
					zoom={15}
					markers={[
						{ lat: part.lat, lng: part.lng, label: part.label, color: "blue" },
					]}
				/>
			</a>
			<div className="flex items-start gap-1.5">
				<MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-400" />
				<p className="text-xs text-neutral-500 leading-snug">{part.label}</p>
			</div>
		</div>
	);
}

// ── Commute Bubble ────────────────────────────────────────────────────────────

export function CommuteBubble({ part }: { part: CommutePart }) {
	const { t } = useLocale();
	const { distanceLabel, durationLabel } = t.chatClient.locationDialog;

	const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${part.origin.lat},${part.origin.lng}&destination=${part.destination.lat},${part.destination.lng}&travelmode=driving`;

	// Center map at the midpoint between origin and destination
	const centerLat = (part.origin.lat + part.destination.lat) / 2;
	const centerLng = (part.origin.lng + part.destination.lng) / 2;

	return (
		<div className="mt-1 flex flex-col gap-1.5">
			<a
				href={gmapsUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="block w-full hover:opacity-90 transition-opacity"
			>
				<LeafletMapInner
					center={[centerLat, centerLng]}
					zoom={12}
					markers={[
						{
							lat: part.origin.lat,
							lng: part.origin.lng,
							label: part.origin.label,
							color: "green",
						},
						{
							lat: part.destination.lat,
							lng: part.destination.lng,
							label: part.destination.label,
							color: "red",
						},
					]}
					fitBounds
				/>
			</a>
			<div className="flex flex-col gap-0.5">
				<div className="flex items-start gap-1.5">
					<div className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-1" />
					<p className="text-xs text-neutral-500 leading-snug truncate">
						{part.origin.label}
					</p>
				</div>
				<div className="flex items-start gap-1.5">
					<div className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1" />
					<p className="text-xs text-neutral-500 leading-snug truncate">
						{part.destination.label}
					</p>
				</div>
			</div>
			<div className="flex items-center gap-3 text-xs text-neutral-400">
				<span className="flex items-center gap-1">
					<ArrowRightLeft className="w-3 h-3" />
					{distanceLabel}: {part.distanceKm.toFixed(1)} km
				</span>
				<span className="flex items-center gap-1">
					<Navigation className="w-3 h-3" />
					{durationLabel}: {part.durationMin} min
				</span>
			</div>
		</div>
	);
}
