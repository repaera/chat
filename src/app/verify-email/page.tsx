import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { resolveUserLocale } from "@/lib/locale";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Better Auth redirects here after clicking the verification link
// This page serves only as a confirmation landing page

export default async function VerifyEmailPage() {
  let userLocale: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    userLocale = (session?.user as { locale?: string | null } | undefined)?.locale ?? null;
  } catch { /* halaman publik */ }

  const { ui } = await resolveUserLocale(userLocale);
  const ve = ui.verifyEmail;

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-neutral-900 border-neutral-800 text-center">
        <CardHeader>
          <div className="text-4xl mb-2">✉️</div>
          <CardTitle className="text-neutral-100">{ve.title}</CardTitle>
          <CardDescription className="text-neutral-500">{ve.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-neutral-600">
            {ve.noEmail}{" "}
            <span className="text-neutral-400">{ve.resend}</span>.
          </p>
          <Button variant="outline" asChild className="w-full border-neutral-700 text-neutral-300">
            <Link href="/login">{ve.backToLogin}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}