"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Bot } from "lucide-react";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function LoginForm({ emailEnabled }: { emailEnabled: boolean }) {
  const { t } = useLocale();
  const l = t.login;
  const auth = t.auth;

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";
  const errorParam = searchParams.get("error");

  const ERROR_MESSAGES: Record<string, string> = {
    rate_limited: l.errors.rateLimited,
    unauthorized: l.errors.sessionExpired,
    email_not_verified: l.errors.emailNotVerified,
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOAuth, setLoadingOAuth] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errors: typeof fieldErrors = {};
    if (!email) errors.email = l.errors.emailRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = l.errors.emailRequired;
    if (!password) errors.password = l.errors.passwordRequired;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await signIn.email({ email, password, callbackURL: redirectTo });
      if (result.error) {
        toast.error(l.errors.invalidCredentials);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      toast.error(l.errors.genericError);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoadingOAuth(true);
    try {
      await signIn.social({ provider: "google", callbackURL: redirectTo });
    } catch {
      toast.error(l.errors.oauthError);
      setLoadingOAuth(false);
    }
  };

  const isGoogleEnabled = !!process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED;
  const busy = loading || loadingOAuth;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo + heading */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-muted">
            <Bot className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold">{l.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{l.pageSubtitle}</p>
        </div>

        {/* Middleware error banner */}
        {errorParam && ERROR_MESSAGES[errorParam] && (
          <div
            role="alert"
            className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center"
          >
            {ERROR_MESSAGES[errorParam]}
          </div>
        )}

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{l.cardTitle}</CardTitle>
            <CardDescription className="text-xs">
              {l.cardDescription}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            {/* Google OAuth */}
            {isGoogleEnabled && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleLogin}
                  disabled={busy}
                  className="w-full gap-2"
                >
                  {loadingOAuth ? (
                    <span className="w-4 h-4 border-2 border-muted border-t-foreground rounded-full animate-spin" />
                  ) : (
                    <GoogleIcon />
                  )}
                  {l.googleButton}
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2 text-muted-foreground">{auth.orWithEmail}</span>
                  </div>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">{l.emailLabel}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined })); }}
                  placeholder="you@email.com"
                  autoComplete="email"
                  autoFocus
                  disabled={busy}
                  aria-invalid={!!fieldErrors.email}
                  className={fieldErrors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {fieldErrors.email && <p role="alert" className="text-xs text-red-500">{fieldErrors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs">{l.passwordLabel}</Label>
                  {emailEnabled && (
                    <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                      {auth.forgotPassword}
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined })); }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={busy}
                    aria-invalid={!!fieldErrors.password}
                    className={`pr-10 ${fieldErrors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                {fieldErrors.password && <p role="alert" className="text-xs text-red-500">{fieldErrors.password}</p>}
              </div>

              <Button type="submit" disabled={busy} className="w-full font-medium">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                    {l.submittingButton}
                  </span>
                ) : l.submitButton}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center pt-0">
            <p className="text-xs text-muted-foreground">
              {auth.noAccount}{" "}
              <Link
                href={`/register${redirectTo !== "/" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
                className="text-foreground hover:underline transition-colors font-medium"
              >
                {auth.signUp}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
