// src/components/chat/TypedText.tsx
"use client";

import { useEffect, useRef } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import Typed from "typed.js";

type Props = {
	text: string;
	animate?: boolean;
	typeSpeed?: number;
	className?: string;
	onComplete?: () => void;
};

export function TypedText({ text, animate = true, typeSpeed = 20, className, onComplete }: Props) {
	const elRef = useRef<HTMLSpanElement>(null);
	const typedRef = useRef<Typed | null>(null);
	const onCompleteRef = useRef(onComplete);
	onCompleteRef.current = onComplete;

	// Skip to completion when the user returns to the tab — browsers throttle
	// setTimeout/setInterval in background tabs, stalling the animation.
	useMountEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible" && typedRef.current) {
				typedRef.current.destroy();
				typedRef.current = null;
				onCompleteRef.current?.();
			}
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
	});

	useEffect(() => {
		if (!animate || !elRef.current || !text) return;

		typedRef.current?.destroy();
		typedRef.current = new Typed(elRef.current, {
			strings: [text],
			typeSpeed,
			showCursor: true,
			cursorChar: "▌",
			contentType: "null",
			onComplete(self) {
				self.cursor?.remove();
				typedRef.current = null;
				onCompleteRef.current?.();
			},
		});

		return () => {
			typedRef.current?.destroy();
			typedRef.current = null;
		};
	}, [animate, text, typeSpeed]);

	if (!animate) return <span className={className}>{text}</span>;

	return <span ref={elRef} className={className} />;
}
