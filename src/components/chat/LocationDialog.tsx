// src/components/chat/LocationDialog.tsx
"use client";

import { ArrowRightLeft, Loader2, MapPin } from "lucide-react";
import { useReducer } from "react";
import type {
	CommutePart,
	LocationPart,
	LocationPlace,
} from "@/components/chat/location-types";
import { PlaceSearchField } from "@/components/chat/PlaceSearchField";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Suggestion } from "@/hooks/use-place-autocomplete";
import { usePlaceAutocomplete } from "@/hooks/use-place-autocomplete";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "menu" | "location" | "commute";

type Props = {
	open: boolean;
	onClose: () => void;
	onConfirmLocation: (part: LocationPart) => void;
	onConfirmCommute: (part: CommutePart) => void;
};

type PlaceField = {
	query: string;
	selected: Suggestion | null;
	coords: { lat: number; lng: number } | null;
};

type DialogState = {
	mode: Mode;
	confirming: boolean;
	calcError: string | null;
	loc: PlaceField;
	origin: PlaceField;
	dest: PlaceField;
};

type DialogAction =
	| { type: "SET_MODE"; mode: Mode }
	| { type: "SET_CONFIRMING"; value: boolean }
	| { type: "SET_CALC_ERROR"; error: string | null }
	| { type: "UPDATE_LOC"; patch: Partial<PlaceField> }
	| { type: "UPDATE_ORIGIN"; patch: Partial<PlaceField> }
	| { type: "UPDATE_DEST"; patch: Partial<PlaceField> }
	| { type: "RESET" };

const EMPTY_PLACE: PlaceField = { query: "", selected: null, coords: null };

const INITIAL_STATE: DialogState = {
	mode: "menu",
	confirming: false,
	calcError: null,
	loc: EMPTY_PLACE,
	origin: EMPTY_PLACE,
	dest: EMPTY_PLACE,
};

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
	switch (action.type) {
		case "SET_MODE":
			return { ...state, mode: action.mode };
		case "SET_CONFIRMING":
			return { ...state, confirming: action.value };
		case "SET_CALC_ERROR":
			return { ...state, calcError: action.error };
		case "UPDATE_LOC":
			return { ...state, loc: { ...state.loc, ...action.patch } };
		case "UPDATE_ORIGIN":
			return { ...state, origin: { ...state.origin, ...action.patch } };
		case "UPDATE_DEST":
			return { ...state, dest: { ...state.dest, ...action.patch } };
		case "RESET":
			return INITIAL_STATE;
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────

// Resolve placeId → lat/lng via Places API
async function resolvePlaceLatLng(
	placeId: string,
): Promise<{ lat: number; lng: number }> {
	// @ts-expect-error — Google Maps JS API loaded via script tag
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

export function LocationDialog({
	open,
	onClose,
	onConfirmLocation,
	onConfirmCommute,
}: Props) {
	const { t } = useLocale();
	const ld = t.chatClient.locationDialog;

	const [state, dispatch] = useReducer(dialogReducer, INITIAL_STATE);
	const { mode, confirming, calcError, loc, origin, dest } = state;

	const locAC = usePlaceAutocomplete();
	const originAC = usePlaceAutocomplete();
	const destAC = usePlaceAutocomplete();

	// ── Confirm Location ─────────────────────────────────────────────────────
	const handleConfirmLocation = async () => {
		if (!loc.selected) return;
		dispatch({ type: "SET_CONFIRMING", value: true });
		try {
			const coords =
				loc.coords ?? (await resolvePlaceLatLng(loc.selected.placeId));
			onConfirmLocation({
				type: "location",
				lat: coords.lat,
				lng: coords.lng,
				label: loc.selected.label,
				placeId: loc.selected.placeId,
			});
			onClose();
		} catch {
			dispatch({ type: "SET_CALC_ERROR", error: ld.calcFailed });
		} finally {
			dispatch({ type: "SET_CONFIRMING", value: false });
		}
	};

	// ── Confirm Commute ──────────────────────────────────────────────────────
	const handleConfirmCommute = async () => {
		if (!origin.selected || !dest.selected) return;
		dispatch({ type: "SET_CONFIRMING", value: true });
		dispatch({ type: "SET_CALC_ERROR", error: null });
		try {
			const [oCoords, dCoords] = await Promise.all([
				origin.coords ?? resolvePlaceLatLng(origin.selected.placeId),
				dest.coords ?? resolvePlaceLatLng(dest.selected.placeId),
			]);

			const originPlace: LocationPlace = {
				...oCoords,
				label: origin.selected.label,
				placeId: origin.selected.placeId,
			};
			const destinationPlace: LocationPlace = {
				...dCoords,
				label: dest.selected.label,
				placeId: dest.selected.placeId,
			};

			const { distanceKm, durationMin } = await fetchDistanceMatrix(
				originPlace,
				destinationPlace,
			);
			onConfirmCommute({
				type: "commute",
				origin: originPlace,
				destination: destinationPlace,
				distanceKm,
				durationMin,
			});
			onClose();
		} catch {
			dispatch({ type: "SET_CALC_ERROR", error: ld.calcFailed });
		} finally {
			dispatch({ type: "SET_CONFIRMING", value: false });
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) {
					onClose();
					setTimeout(() => {
						dispatch({ type: "RESET" });
						locAC.clear();
						originAC.clear();
						destAC.clear();
					}, 200);
				}
			}}
		>
			<DialogContent className="max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-full max-sm:max-w-full max-sm:h-svh max-sm:rounded-none max-sm:content-start max-sm:data-[state=open]:slide-in-from-bottom-full max-sm:data-[state=closed]:slide-out-to-bottom-full max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100 sm:max-w-md">
				<DialogHeader className="text-left">
					<DialogTitle>{ld.dialogTitle}</DialogTitle>
				</DialogHeader>

				{/* ── Menu ── */}
				{mode === "menu" && (
					<div className="flex flex-col gap-3 pt-2 w-full min-w-0">
						<Button
							variant="outline"
							className="h-12 justify-start gap-3 text-sm font-medium"
							onClick={() => dispatch({ type: "SET_MODE", mode: "location" })}
						>
							<MapPin className="w-5 h-5 text-neutral-500" />
							{ld.shareLocationBtn}
						</Button>
						<Button
							variant="outline"
							className="h-12 justify-start gap-3 text-sm font-medium"
							onClick={() => dispatch({ type: "SET_MODE", mode: "commute" })}
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
							value={loc.query}
							onChange={(v) => {
								dispatch({
									type: "UPDATE_LOC",
									patch: { query: v, coords: null },
								});
								locAC.search(v);
							}}
							onSelect={(s) => {
								dispatch({
									type: "UPDATE_LOC",
									patch: { selected: s, query: s.label },
								});
								locAC.clear();
								resolvePlaceLatLng(s.placeId)
									.then((c) =>
										dispatch({ type: "UPDATE_LOC", patch: { coords: c } }),
									)
									.catch(() => {});
							}}
							selected={loc.selected}
							onClear={() =>
								dispatch({ type: "UPDATE_LOC", patch: EMPTY_PLACE })
							}
							loading={locAC.loading}
							suggestions={locAC.suggestions}
							noResultsLabel={ld.noResults}
							searchingLabel={ld.searchingLabel}
						/>

						{calcError && <p className="text-xs text-red-500">{calcError}</p>}
						<Button
							onClick={handleConfirmLocation}
							disabled={!loc.selected || confirming}
							className="w-full"
						>
							{confirming ? (
								<Loader2 className="w-4 h-4 animate-spin mr-2" />
							) : null}
							{confirming ? ld.calculating : ld.confirmBtn}
						</Button>
					</div>
				)}

				{/* ── Commute ── */}
				{mode === "commute" && (
					<div className="flex flex-col gap-3 pt-2 w-full min-w-0">
						<PlaceSearchField
							placeholder={ld.originPlaceholder}
							value={origin.query}
							onChange={(v) => {
								dispatch({
									type: "UPDATE_ORIGIN",
									patch: { query: v, coords: null },
								});
								originAC.search(v);
							}}
							onSelect={(s) => {
								dispatch({
									type: "UPDATE_ORIGIN",
									patch: { selected: s, query: s.label },
								});
								originAC.clear();
								resolvePlaceLatLng(s.placeId)
									.then((c) =>
										dispatch({ type: "UPDATE_ORIGIN", patch: { coords: c } }),
									)
									.catch(() => {});
							}}
							selected={origin.selected}
							onClear={() =>
								dispatch({ type: "UPDATE_ORIGIN", patch: EMPTY_PLACE })
							}
							loading={originAC.loading}
							suggestions={originAC.suggestions}
							noResultsLabel={ld.noResults}
							searchingLabel={ld.searchingLabel}
						/>
						<PlaceSearchField
							placeholder={ld.destinationPlaceholder}
							value={dest.query}
							onChange={(v) => {
								dispatch({
									type: "UPDATE_DEST",
									patch: { query: v, coords: null },
								});
								destAC.search(v);
							}}
							onSelect={(s) => {
								dispatch({
									type: "UPDATE_DEST",
									patch: { selected: s, query: s.label },
								});
								destAC.clear();
								resolvePlaceLatLng(s.placeId)
									.then((c) =>
										dispatch({ type: "UPDATE_DEST", patch: { coords: c } }),
									)
									.catch(() => {});
							}}
							selected={dest.selected}
							onClear={() =>
								dispatch({ type: "UPDATE_DEST", patch: EMPTY_PLACE })
							}
							loading={destAC.loading}
							suggestions={destAC.suggestions}
							noResultsLabel={ld.noResults}
							searchingLabel={ld.searchingLabel}
						/>

						{calcError && <p className="text-xs text-red-500">{calcError}</p>}
						<Button
							onClick={handleConfirmCommute}
							disabled={!origin.selected || !dest.selected || confirming}
							className="w-full"
						>
							{confirming ? (
								<Loader2 className="w-4 h-4 animate-spin mr-2" />
							) : null}
							{confirming ? ld.calculating : ld.confirmBtn}
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
