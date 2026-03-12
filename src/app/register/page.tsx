"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signUp, signIn } from "@/lib/auth-client";
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

// ─── Icons ────────────────────────────────────────────────────

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

// ─── Password strength ────────────────────────────────────────

type StrengthScore = 0 | 1 | 2 | 3 | 4;

function getPasswordScore(password: string): StrengthScore {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4) as StrengthScore;
}

function PasswordStrengthBar({ password }: { password: string }) {
  const { t } = useLocale();
  const score = getPasswordScore(password);
  if (!password || score === 0) return null;

  const meta = t.register.passwordStrength[score as 1 | 2 | 3 | 4];

  return (
    <div className="space-y-1.5" aria-label={meta.label}>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? meta.color : "bg-neutral-700"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${score <= 2 ? "text-red-400" : score === 3 ? "text-yellow-400" : "text-green-400"}`}>
        {meta.label}
      </p>
    </div>
  );
}

// ─── Main form ───────────────────────────────────────────────

function RegisterForm() {
  const { t } = useLocale();
  const r = t.register;
  const auth = t.auth;

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOAuth, setLoadingOAuth] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validate = () => {
    const errors: typeof fieldErrors = {};
    if (!name.trim()) errors.name = r.errors.nameRequired;
    else if (name.trim().length < 2) errors.name = r.errors.nameTooShort;
    if (!email) errors.email = r.errors.emailRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = r.errors.emailInvalid;
    if (!password) errors.password = r.errors.passwordRequired;
    else if (password.length < 8) errors.password = r.errors.passwordTooShort;
    else if (getPasswordScore(password) < 2) errors.password = r.errors.passwordTooWeak;
    if (!confirmPassword) errors.confirmPassword = r.errors.confirmRequired;
    else if (confirmPassword !== password) errors.confirmPassword = r.errors.confirmMismatch;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await signUp.email({ name: name.trim(), email, password });
      if (result.error) {
        if (result.error.code === "USER_ALREADY_EXISTS") {
          setFieldErrors((p) => ({ ...p, email: r.errors.emailTaken }));
        } else {
          toast.error(r.errors.genericError);
        }
        return;
      }
      void fetch("/api/user/locale", { method: "POST" });
      const needsVerification = !result.data?.token && !result.data?.user?.emailVerified;
      if (needsVerification) {
        router.push("/verify-email");
      } else {
        toast.success(r.success);
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      toast.error(r.errors.genericError);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoadingOAuth(true);
    try {
      await signIn.social({ provider: "google", callbackURL: redirectTo });
    } catch {
      toast.error(r.errors.oauthError);
      setLoadingOAuth(false);
    }
  };

  const isGoogleEnabled = !!process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED;
  const busy = loading || loadingOAuth;
  const score = getPasswordScore(password);

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo + heading */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-neutral-800 text-2xl">
            ✓
          </div>
          <h1 className="text-xl font-semibold text-neutral-100">{r.pageTitle}</h1>
          <p className="text-sm text-neutral-500">{r.pageSubtitle}</p>
        </div>

        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-neutral-100 text-base">{r.cardTitle}</CardTitle>
            <CardDescription className="text-neutral-500 text-xs">
              {r.cardDescription}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            {/* Google OAuth */}
            {isGoogleEnabled && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleRegister}
                  disabled={busy}
                  className="w-full border-neutral-700 bg-neutral-800 text-neutral-200 hover:bg-neutral-700 hover:text-neutral-100 gap-2"
                >
                  {loadingOAuth ? (
                    <span className="w-4 h-4 border-2 border-neutral-500 border-t-neutral-200 rounded-full animate-spin" />
                  ) : (
                    <GoogleIcon />
                  )}
                  {r.googleButton}
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-neutral-800" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-neutral-900 px-2 text-neutral-600">{auth.orWithEmail}</span>
                  </div>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-neutral-400 text-xs">{r.nameLabel}</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined })); }}
                  placeholder={r.namePlaceholder}
                  autoComplete="name"
                  autoFocus
                  disabled={busy}
                  aria-invalid={!!fieldErrors.name}
                  className={`bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-600 focus-visible:ring-neutral-500 ${fieldErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {fieldErrors.name && <p role="alert" className="text-xs text-red-400">{fieldErrors.name}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-neutral-400 text-xs">{r.emailLabel}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined })); }}
                  placeholder={r.emailPlaceholder}
                  autoComplete="email"
                  disabled={busy}
                  aria-invalid={!!fieldErrors.email}
                  className={`bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-600 focus-visible:ring-neutral-500 ${fieldErrors.email ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {fieldErrors.email && <p role="alert" className="text-xs text-red-400">{fieldErrors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-neutral-400 text-xs">{r.passwordLabel}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined })); }}
                    placeholder={r.passwordPlaceholder}
                    autoComplete="new-password"
                    disabled={busy}
                    aria-invalid={!!fieldErrors.password}
                    className={`bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-600 focus-visible:ring-neutral-500 pr-10 ${fieldErrors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                {password && <PasswordStrengthBar password={password} />}
                {fieldErrors.password && <p role="alert" className="text-xs text-red-400">{fieldErrors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-neutral-400 text-xs">{r.confirmPasswordLabel}</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: undefined })); }}
                    placeholder={r.confirmPasswordPlaceholder}
                    autoComplete="new-password"
                    disabled={busy}
                    aria-invalid={!!fieldErrors.confirmPassword}
                    className={`bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-600 focus-visible:ring-neutral-500 pr-10 ${
                      fieldErrors.confirmPassword
                        ? "border-red-500 focus-visible:ring-red-500"
                        : confirmPassword && confirmPassword === password
                          ? "border-green-600"
                          : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>
                {confirmPassword && !fieldErrors.confirmPassword && (
                  <p className={`text-xs ${confirmPassword === password ? "text-green-400" : "text-red-400"}`}>
                    {confirmPassword === password ? r.passwordMatch : r.passwordNoMatch}
                  </p>
                )}
                {fieldErrors.confirmPassword && <p role="alert" className="text-xs text-red-400">{fieldErrors.confirmPassword}</p>}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={busy || (!!password && score < 2)}
                className="w-full bg-neutral-100 hover:bg-white text-neutral-900 font-medium"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-neutral-900 rounded-full animate-spin" />
                    {r.submittingButton}
                  </span>
                ) : r.submitButton}
              </Button>

              {/* Terms */}
              <p className="text-xs text-neutral-600 text-center leading-relaxed">
                {r.termsPrefix}{" "}
                <Link href="/terms" className="text-neutral-400 hover:text-neutral-200 transition-colors">{r.terms}</Link>
                {" "}{r.termsAnd}{" "}
                <Link href="/privacy" className="text-neutral-400 hover:text-neutral-200 transition-colors">{r.privacy}</Link>
              </p>
            </form>
          </CardContent>

          <CardFooter className="justify-center pt-0">
            <p className="text-xs text-neutral-500">
              {auth.alreadyHaveAccount}{" "}
              <Link
                href={`/login${redirectTo !== "/" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
                className="text-neutral-300 hover:text-neutral-100 transition-colors font-medium"
              >
                {auth.signIn}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}