// src/hooks/use-place-autocomplete.ts

import { useCallback, useRef, useState } from "react";

export type Suggestion = {
	placeId: string;
	label: string;
	secondLine?: string;
};

export function usePlaceAutocomplete() {
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [loading, setLoading] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const search = useCallback((query: string) => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		if (!query.trim() || query.length < 2) {
			setSuggestions([]);
			return;
		}

		debounceRef.current = setTimeout(async () => {
			setLoading(true);
			try {
				// @ts-expect-error — Google Maps JS API loaded via script tag
				const { AutocompleteSessionToken, AutocompleteSuggestion } = await (
					window as any
				).google.maps.importLibrary("places");

				const token = new AutocompleteSessionToken();
				const { suggestions: raw } =
					await AutocompleteSuggestion.fetchAutocompleteSuggestions({
						input: query,
						sessionToken: token,
					});

				setSuggestions(
					(raw as any[]).map((s: any) => ({
						placeId: s.placePrediction.placeId,
						label:
							s.placePrediction.mainText?.toString() ??
							s.placePrediction.text.toString(),
						secondLine: s.placePrediction.secondaryText?.toString(),
					})),
				);
			} catch {
				setSuggestions([]);
			} finally {
				setLoading(false);
			}
		}, 350);
	}, []);

	const clear = useCallback(() => setSuggestions([]), []);

	return { suggestions, loading, search, clear };
}
