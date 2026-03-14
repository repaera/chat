import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <div className="flex justify-center mb-2"><Mail className="w-8 h-8 text-muted-foreground" /></div>
          <CardTitle>{ve.title}</CardTitle>
          <CardDescription>{ve.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {ve.noEmail}{" "}
            <span className="text-foreground/70">{ve.resend}</span>.
          </p>
          <Button variant="outline" asChild className="w-full">
            <Link href="/login">{ve.backToLogin}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}