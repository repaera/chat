// src/components/chat/PlaceSearchField.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Suggestion } from "@/hooks/use-place-autocomplete";

type Props = {
	placeholder: string;
	value: string;
	onChange: (val: string) => void;
	onSelect: (s: Suggestion) => void;
	selected: Suggestion | null;
	onClear: () => void;
	loading: boolean;
	suggestions: Suggestion[];
	noResultsLabel: string;
	searchingLabel: string;
};

export function PlaceSearchField({
	placeholder,
	value,
	onChange,
	onSelect,
	selected,
	onClear,
	loading,
	suggestions,
	noResultsLabel,
	searchingLabel,
}: Props) {
	const [open, setOpen] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);

	// Close dropdown on outside click
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	if (selected) {
		return (
			<div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm w-full min-w-0">
				<MapPin className="w-4 h-4 shrink-0 text-neutral-500" />
				<div className="flex-1 min-w-0">
					<p className="font-medium text-neutral-900 truncate">{selected.label}</p>
					{selected.secondLine && (
						<p className="text-xs text-neutral-400 truncate">{selected.secondLine}</p>
					)}
				</div>
				<button
					type="button"
					onClick={onClear}
					className="text-neutral-400 hover:text-neutral-600"
				>
					<X className="w-4 h-4" />
				</button>
			</div>
		);
	}

	return (
		<div ref={wrapRef} className="relative">
			<div className="relative">
				<MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
				<Input
					className="pl-9 pr-4 text-sm"
					placeholder={placeholder}
					value={value}
					onChange={(e) => {
						onChange(e.target.value);
						setOpen(true);
					}}
					onFocus={() => suggestions.length > 0 && setOpen(true)}
					autoComplete="off"
				/>
				{loading && (
					<Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-neutral-400" />
				)}
			</div>

			{open && value.length >= 2 && (
				<div className="absolute z-50 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg max-h-52 overflow-y-auto">
					{loading && (
						<div className="px-3 py-2 text-xs text-neutral-400">{searchingLabel}</div>
					)}
					{!loading && suggestions.length === 0 && value.length >= 2 && (
						<div className="px-3 py-2 text-xs text-neutral-400">{noResultsLabel}</div>
					)}
					{suggestions.map((s) => (
						<button
							key={s.placeId}
							type="button"
							className="w-full text-left px-3 py-2.5 hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-0"
							onClick={() => {
								onSelect(s);
								setOpen(false);
							}}
						>
							<p className="text-sm font-medium text-neutral-900 truncate">{s.label}</p>
							{s.secondLine && (
								<p className="text-xs text-neutral-400 truncate">{s.secondLine}</p>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
