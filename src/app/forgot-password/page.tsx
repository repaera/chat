"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { useLocale } from "@/components/providers/LocaleProvider";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const fp = t.forgotPassword;

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const validate = () => {
    if (!email) { setEmailError(fp.errors.emailRequired); return false; }
    if (!EMAIL_REGEX.test(email)) { setEmailError(fp.errors.emailInvalid); return false; }
    setEmailError("");
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    const { error } = await requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setLoading(false);
    if (error) { toast.error(fp.errors.genericError); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-neutral-800 text-2xl">
            ✓
          </div>
          <h1 className="text-xl font-semibold text-neutral-100">{fp.pageTitle}</h1>
          <p className="text-sm text-neutral-500">
            {sent ? fp.pageSubtitleSent : fp.pageSubtitleDefault}
          </p>
        </div>

        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-neutral-100 text-base">{fp.cardTitle}</CardTitle>
            <CardDescription className="text-neutral-500 text-xs">
              {sent ? fp.cardDescriptionSent : fp.cardDescriptionDefault}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {!sent ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-neutral-400 text-xs">
                    {fp.emailLabel}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="you@email.com"
                    autoComplete="email"
                    autoFocus
                    disabled={loading}
                    aria-describedby={emailError ? "email-error" : undefined}
                    aria-invalid={!!emailError}
                    className={`bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-600 focus-visible:ring-neutral-500 ${
                      emailError ? "border-red-500 focus-visible:ring-red-500" : ""
                    }`}
                  />
                  {emailError && (
                    <p id="email-error" role="alert" className="text-xs text-red-400">
                      {emailError}
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={loading || !email}
                  className="w-full bg-neutral-100 text-neutral-900 hover:bg-white font-medium"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-neutral-900 rounded-full animate-spin" />
                      {fp.submittingButton}
                    </span>
                  ) : fp.submitButton}
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="text-center py-2">
                  <p className="text-2xl mb-2">📬</p>
                  <p className="text-sm text-neutral-400">
                    {fp.sentTo}{" "}
                    <span className="text-neutral-200 font-medium">{email}</span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                  onClick={() => { setSent(false); setEmail(""); }}
                  disabled={loading}
                >
                  {fp.sendToAnother}
                </Button>
              </div>
            )}

            <p className="text-center text-xs text-neutral-600">
              <Link href="/login" className="text-neutral-400 hover:text-neutral-200 transition-colors">
                {fp.backToLogin}
              </Link>
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}