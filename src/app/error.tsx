"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { Button } from "@/components/ui/button";

// error.tsx and not-found.tsx are rendered outside the LocaleProvider tree by Next.js.
// Solution: read html[lang] set by the layout, then lookup from a local map.
// No need to import locale files — only the strings needed here.
const STRINGS: Record<string, { title: string; description: string; retry: string }> = {
  id: {
    title: "Terjadi kesalahan",
    description: "Sesuatu yang tidak terduga terjadi. Tim kami sudah diberitahu.",
    retry: "Coba lagi",
  },
  ko: {
    title: "오류가 발생했습니다",
    description: "예기치 않은 오류가 발생했습니다. 팀에 알려졌습니다.",
    retry: "다시 시도",
  },
  ja: {
    title: "エラーが発生しました",
    description: "予期しないエラーが発生しました。チームに通知されました。",
    retry: "もう一度試す",
  },
  en: {
    title: "Something went wrong",
    description: "An unexpected error occurred. Our team has been notified.",
    retry: "Try again",
  },
};

function getStrings() {
  if (typeof document === "undefined") return STRINGS.en;
  const lang = document.documentElement.lang?.split("-")[0] ?? "en";
  return STRINGS[lang] ?? STRINGS.en;
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [s] = useState(getStrings);

  useMountEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  });

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center p-4">
      <p className="text-6xl font-bold text-muted-foreground">500</p>
      <h1 className="text-xl font-semibold">{s.title}</h1>
      <p className="text-sm text-muted-foreground">{s.description}</p>
      {error.digest && (
        <p className="text-xs text-muted-foreground/50 font-mono">Error ID: {error.digest}</p>
      )}
      <Button onClick={reset} variant="outline" className="mt-2">
        {s.retry}
      </Button>
    </div>
  );
}
