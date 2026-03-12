// src/components/chat/LocationDialog.tsx
"use client";

import { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, ArrowRightLeft, Loader2 } from "lucide-react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { usePlaceAutocomplete } from "@/hooks/use-place-autocomplete";
import { PlaceSearchField } from "@/components/chat/PlaceSearchField";
import type { LocationPart, CommutePart, LocationPlace } from "@/components/chat/location-types";
import type { Suggestion } from "@/hooks/use-place-autocomplete";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "menu" | "location" | "commute";

type Props = {
	open: boolean;
	onClose: () => void;
	onConfirmLocation: (part: LocationPart) => void;
	onConfirmCommute: (part: CommutePart) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────

// Resolve placeId → lat/lng via Places API
async function resolvePlaceLatLng(placeId: string): Promise<{ lat: number; lng: number }> {
	// @ts-ignore — Google Maps JS API loaded via script tag
	const { Place } = await (window as any).google.maps.importLibrary("places");
	const place = new Place({ id: placeId });
	await place.fetchFields({ fields: ["location"] });
	return {
		lat: place.location.lat(),
		lng: place.location.lng(),
	};
}

// Fetch distance + duration via server-side proxy /api/distance
// (avoids ApiTargetBlockedMapError — API key stays on server)
async function fetchDistanceMatrix(
	origin: LocationPlace,
	destination: LocationPlace,
): Promise<{ distanceKm: number; durationMin: number }> {
	const res = await fetch("/api/distance", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			originLat: origin.lat,
			originLng: origin.lng,
			destLat: destination.lat,
			destLng: destination.lng,
		}),
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error ?? `Distance API error ${res.status}`);
	}
	return res.json();
}

// ── Main Dialog ───────────────────────────────────────────────────────────

export function LocationDialog({ open, onClose, onConfirmLocation, onConfirmCommute }: Props) {
	const { t } = useLocale();
	const ld = t.chatClient.locationDialog;

	const [mode, setMode] = useState<Mode>("menu");
	const [confirming, setConfirming] = useState(false);
	const [calcError, setCalcError] = useState<string | null>(null);

	// Location mode state
	const [locQuery, setLocQuery] = useState("");
	const [locSelected, setLocSelected] = useState<Suggestion | null>(null);
	const [locCoords, setLocCoords] = useState<{ lat: number; lng: number } | null>(null);

	// Commute mode state
	const [originQuery, setOriginQuery] = useState("");
	const [destQuery, setDestQuery] = useState("");
	const [originSelected, setOriginSel] = useState<Suggestion | null>(null);
	const [destSelected, setDestSel] = useState<Suggestion | null>(null);
	const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
	const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);

	const locAC = usePlaceAutocomplete();
	const originAC = usePlaceAutocomplete();
	const destAC = usePlaceAutocomplete();

	// Reset on close
	useEffect(() => {
		if (!open) {
			setTimeout(() => {
				setMode("menu");
				setLocQuery("");
				setLocSelected(null);
				setLocCoords(null);
				locAC.clear();
				setOriginQuery("");
				setDestQuery("");
				setOriginSel(null);
				setDestSel(null);
				setOriginCoords(null);
				setDestCoords(null);
				originAC.clear();
				destAC.clear();
				setCalcError(null);
				setConfirming(false);
			}, 200);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	// ── Confirm Location ─────────────────────────────────────────────────────
	const handleConfirmLocation = async () => {
		if (!locSelected) return;
		setConfirming(true);
		try {
			const coords = locCoords ?? (await resolvePlaceLatLng(locSelected.placeId));
			onConfirmLocation({
				type: "location",
				lat: coords.lat,
				lng: coords.lng,
				label: locSelected.label,
				placeId: locSelected.placeId,
			});
			onClose();
		} catch {
			setCalcError(ld.calcFailed);
		} finally {
			setConfirming(false);
		}
	};

	// ── Confirm Commute ──────────────────────────────────────────────────────
	const handleConfirmCommute = async () => {
		if (!originSelected || !destSelected) return;
		setConfirming(true);
		setCalcError(null);
		try {
			const [oCoords, dCoords] = await Promise.all([
				originCoords ?? resolvePlaceLatLng(originSelected.placeId),
				destCoords ?? resolvePlaceLatLng(destSelected.placeId),
			]);

			const origin: LocationPlace = {
				...oCoords,
				label: originSelected.label,
				placeId: originSelected.placeId,
			};
			const destination: LocationPlace = {
				...dCoords,
				label: destSelected.label,
				placeId: destSelected.placeId,
			};

			const { distanceKm, durationMin } = await fetchDistanceMatrix(origin, destination);
			onConfirmCommute({ type: "commute", origin, destination, distanceKm, durationMin });
			onClose();
		} catch {
			setCalcError(ld.calcFailed);
		} finally {
			setConfirming(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{ld.dialogTitle}</DialogTitle>
				</DialogHeader>

				{/* ── Menu ── */}
				{mode === "menu" && (
					<div className="flex flex-col gap-3 pt-2 w-full min-w-0">
						<Button
							variant="outline"
							className="h-12 justify-start gap-3 text-sm font-medium"
							onClick={() => setMode("location")}
						>
							<MapPin className="w-5 h-5 text-neutral-500" />
							{ld.shareLocationBtn}
						</Button>
						<Button
							variant="outline"
							className="h-12 justify-start gap-3 text-sm font-medium"
							onClick={() => setMode("commute")}
						>
							<ArrowRightLeft className="w-5 h-5 text-neutral-500" />
							{ld.commuteBtn}
						</Button>
					</div>
				)}

				{/* ── Location search ── */}
				{mode === "location" && (
					<div className="flex flex-col gap-3 pt-2 w-full min-w-0">
						<PlaceSearchField
							placeholder={ld.searchPlaceholder}
							value={locQuery}
							onChange={(v) => {
								setLocQuery(v);
								locAC.search(v);
								setLocCoords(null);
							}}
							onSelect={(s) => {
								setLocSelected(s);
								setLocQuery(s.label);
								locAC.clear();
								// Resolve coordinates immediately on select for map preview
								resolvePlaceLatLng(s.placeId)
									.then((c) => setLocCoords(c))
									.catch(() => {});
							}}
							selected={locSelected}
							onClear={() => {
								setLocSelected(null);
								setLocQuery("");
								setLocCoords(null);
							}}
							loading={locAC.loading}
							suggestions={locAC.suggestions}
							noResultsLabel={ld.noResults}
							searchingLabel={ld.searchingLabel}
						/>

						{calcError && <p className="text-xs text-red-500">{calcError}</p>}
						<Button
							onClick={handleConfirmLocation}
							disabled={!locSelected || confirming}
							className="w-full"
						>
							{confirming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
							{confirming ? ld.calculating : ld.confirmBtn}
						</Button>
					</div>
				)}

				{/* ── Commute ── */}
				{mode === "commute" && (
					<div className="flex flex-col gap-3 pt-2 w-full min-w-0">
						<PlaceSearchField
							placeholder={ld.originPlaceholder}
							value={originQuery}
							onChange={(v) => {
								setOriginQuery(v);
								originAC.search(v);
								setOriginCoords(null);
							}}
							onSelect={(s) => {
								setOriginSel(s);
								setOriginQuery(s.label);
								originAC.clear();
								resolvePlaceLatLng(s.placeId)
									.then((c) => setOriginCoords(c))
									.catch(() => {});
							}}
							selected={originSelected}
							onClear={() => {
								setOriginSel(null);
								setOriginQuery("");
								setOriginCoords(null);
							}}
							loading={originAC.loading}
							suggestions={originAC.suggestions}
							noResultsLabel={ld.noResults}
							searchingLabel={ld.searchingLabel}
						/>
						<PlaceSearchField
							placeholder={ld.destinationPlaceholder}
							value={destQuery}
							onChange={(v) => {
								setDestQuery(v);
								destAC.search(v);
								setDestCoords(null);
							}}
							onSelect={(s) => {
								setDestSel(s);
								setDestQuery(s.label);
								destAC.clear();
								resolvePlaceLatLng(s.placeId)
									.then((c) => setDestCoords(c))
									.catch(() => {});
							}}
							selected={destSelected}
							onClear={() => {
								setDestSel(null);
								setDestQuery("");
								setDestCoords(null);
							}}
							loading={destAC.loading}
							suggestions={destAC.suggestions}
							noResultsLabel={ld.noResults}
							searchingLabel={ld.searchingLabel}
						/>

						{calcError && <p className="text-xs text-red-500">{calcError}</p>}
						<Button
							onClick={handleConfirmCommute}
							disabled={!originSelected || !destSelected || confirming}
							className="w-full"
						>
							{confirming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
							{confirming ? ld.calculating : ld.confirmBtn}
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
