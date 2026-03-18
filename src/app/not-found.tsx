"use client";

// not-found.tsx is rendered outside the LocaleProvider by Next.js.
// Same as error.tsx — read html[lang] from the DOM.
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const STRINGS: Record<string, { title: string; description: string; backToChat: string }> = {
  id: {
    title: "Halaman tidak ditemukan",
    description: "Halaman yang kamu cari tidak ada atau sudah dihapus.",
    backToChat: "Kembali ke Chat",
  },
  ko: {
    title: "페이지를 찾을 수 없습니다",
    description: "찾으시는 페이지가 없거나 삭제되었습니다.",
    backToChat: "채팅으로 돌아가기",
  },
  ja: {
    title: "ページが見つかりません",
    description: "お探しのページは存在しないか、削除されました。",
    backToChat: "チャットに戻る",
  },
  en: {
    title: "Page not found",
    description: "The page you're looking for doesn't exist or has been removed.",
    backToChat: "Back to Chat",
  },
};

export default function NotFound() {
  const [s] = useState(() => {
    const lang = document.documentElement.lang?.split("-")[0] ?? "en";
    return STRINGS[lang] ?? STRINGS.en;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center p-4">
      <p className="text-6xl font-bold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">{s.title}</h1>
      <p className="text-sm text-muted-foreground">{s.description}</p>
      <Button asChild variant="outline" className="mt-2">
        <Link href="/">{s.backToChat}</Link>
      </Button>
    </div>
  );
}
