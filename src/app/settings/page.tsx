// src/app/settings/page.tsx

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import SettingsClient from "@/components/settings/SettingsClient";
import type { Metadata } from "next";

const RETENTION_DAYS = 30;

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  return (
    <SettingsClient
      user={{
        id: session.user.id,
        name: session.user.name ?? "",
        email: session.user.email,
        image: session.user.image ?? null,
        locale: (session.user as { locale?: string | null }).locale ?? null,
      }}
      retentionDays={RETENTION_DAYS}
    />
  );
}