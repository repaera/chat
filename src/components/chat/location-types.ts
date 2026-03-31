// src/components/chat/location-types.ts
// Custom UIMessage part types for location and commute.
// Stored as JSON in the Message.content column — no need for a new table.

export type LocationPlace = {
	lat: number;
	lng: number;
	label: string; // human-readable place name / address
	placeId?: string; // Google Place ID — optional
};

export type LocationPart = {
	type: "location";
} & LocationPlace;

export type CommutePart = {
	type: "commute";
	origin: LocationPlace;
	destination: LocationPlace;
	distanceKm: number;
	durationMin: number;
};

export type LocationAttachment = LocationPart | CommutePart;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Format LocationPart into text for the LLM */
export function formatLocationForLLM(part: LocationPart): string {
	return [
		`[LOCATION ATTACHED]`,
		`  Name/Address : ${part.label}`,
		`  Coordinates  : lat=${part.lat.toFixed(4)}, lng=${part.lng.toFixed(4)}`,
		`[/LOCATION ATTACHED]`,
	].join("\n");
}

/** Format CommutePart into text for the LLM */
export function formatCommuteForLLM(part: CommutePart): string {
	return [
		`[COMMUTE ATTACHED]`,
		`  From         : ${part.origin.label}`,
		`  From coords  : lat=${part.origin.lat.toFixed(4)}, lng=${part.origin.lng.toFixed(4)}`,
		`  To           : ${part.destination.label}`,
		`  To coords    : lat=${part.destination.lat.toFixed(4)}, lng=${part.destination.lng.toFixed(4)}`,
		`  Distance     : ${part.distanceKm.toFixed(1)} km`,
		`  Est. duration: ${part.durationMin} min`,
		`[/COMMUTE ATTACHED]`,
	].join("\n");
}
