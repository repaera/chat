"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { ArrowLeft, Copy, Check, Unlink } from "lucide-react";

type Section = "profile" | "security" | "account" | "links";

type LinkStatus = { linked: boolean; handle: string };

type Props = {
  user: { id: string; name: string; email: string; image: string | null; locale?: string | null };
  retentionDays: number;
  emailEnabled: boolean;
  availablePlatforms: string[];
  botHandles: Record<string, string>;
};

export default function SettingsClient({ user, retentionDays, emailEnabled, availablePlatforms, botHandles }: Props) {
  const { t } = useLocale();
  const s = t.settings;

  const router = useRouter();
  const [section, setSection] = useState<Section>("profile");
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState<null | "profile" | "email" | "locale" | "password">(null);
  const [emailSent, setEmailSent] = useState(false);
  const [locale, setLocale] = useState(user.locale ?? "");

  // Links tab state
  const [linksStatus, setLinksStatus] = useState<Record<string, LinkStatus> | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<Record<string, { code: string; expiresAt: string }>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (section === "links" && !linksStatus) {
      fetch("/api/link/status")
        .then((r) => r.json())
        .then((data: { links: Record<string, LinkStatus> }) => setLinksStatus(data.links))
        .catch(() => {});
    }
  }, [section, linksStatus]);

  const handleGenerateCode = async (platform: string) => {
    setGenerating(platform);
    try {
      const res = await fetch("/api/link/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as { code: string; expiresAt: string };
      setGeneratedCodes((prev) => ({ ...prev, [platform]: data }));
      toast.success(s.linksCard.toasts.generated);
    } catch {
      toast.error(s.linksCard.toasts.error);
    } finally {
      setGenerating(null);
    }
  };

  const handleCopyCode = (platform: string, code: string) => {
    navigator.clipboard.writeText(`/link ${code}`).then(() => {
      setCopied(platform);
      toast.success(s.linksCard.toasts.copied);
      setTimeout(() => setCopied((p) => (p === platform ? null : p)), 2000);
    }).catch(() => {});
  };

  const handleUnlink = async (platform: string) => {
    setUnlinking(platform);
    try {
      await fetch(`/api/link/${platform}`, { method: "DELETE" });
      setLinksStatus((prev) => prev ? { ...prev, [platform]: { linked: false, handle: "" } } : prev);
      setGeneratedCodes((prev) => { const next = { ...prev }; delete next[platform]; return next; });
      toast.success(s.linksCard.toasts.unlinked);
    } catch {
      toast.error(s.linksCard.toasts.error);
    } finally {
      setUnlinking(null);
    }
  };

  const handleSaveProfile = async () => {
    setSaving("profile");
    try {
      await authClient.updateUser({ name });
      toast.success(s.toasts.profileSaved);
    } catch {
      toast.error(s.toasts.profileError);
    } finally { setSaving(null); }
  };

  const handleChangeEmail = async () => {
    if (email === user.email) return;
    setSaving("email");
    try {
      await authClient.changeEmail({ newEmail: email, callbackURL: "/settings" });
      setEmailSent(true);
      toast.success(s.profileCard.emailSent);
    } catch {
      toast.error(s.toasts.profileError);
    } finally { setSaving(null); }
  };

  const handleSaveLocale = async (value: string) => {
    setLocale(value);
    setSaving("locale");
    try {
      await authClient.updateUser({ locale: value } as Parameters<typeof authClient.updateUser>[0]);
      // router.refresh() triggers server re-render of layout.tsx —
      // LocaleProvider will pick up the new locale from the DB without a full page reload
      router.refresh();
    } catch {
      toast.error(s.toasts.localeError);
    } finally { setSaving(null); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) { toast.error(s.securityCard.errors.tooShort); return; }
    setSaving("password");
    try {
      await authClient.changePassword({ currentPassword, newPassword });
      toast.success(s.securityCard.success);
      setCurrentPassword(""); setNewPassword("");
    } catch {
      toast.error(s.securityCard.errors.wrongPassword);
    } finally { setSaving(null); }
  };

  const handleDeleteAccount = async () => {
    try {
      await authClient.deleteUser();
      router.push("/login");
    } catch {
      toast.error(s.dangerCard.error);
    }
  };

  const navItems: { key: Section; label: string; danger?: boolean }[] = [
    { key: "profile", label: s.tabProfile },
    { key: "security", label: s.tabSecurity },
    { key: "account", label: s.tabAccount, danger: false },
    ...(availablePlatforms.length > 0 ? [{ key: "links" as const, label: s.tabLinks }] : []),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col sm:flex-row">

      {/* Left nav */}
      <nav className="sm:w-56 shrink-0 sm:border-r sm:min-h-screen sm:py-8 px-4 py-4 sm:px-4">
        {/* Back link + heading */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3 h-3" />
            {s.backLink}
          </Link>
          <h1 className="text-xl font-semibold mt-2">{s.pageTitle}</h1>
        </div>

        {/* Nav items */}
        <ul className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0">
          {navItems.map(({ key, label, danger }) => (
            <li key={key} className="shrink-0 sm:shrink sm:w-full">
              <Button
                variant="ghost"
                onClick={() => setSection(key)}
                className={[
                  "w-full justify-start text-sm whitespace-nowrap",
                  section === key
                    ? danger
                      ? "bg-accent text-red-600 font-medium"
                      : "bg-accent text-accent-foreground font-medium"
                    : danger
                      ? "text-red-500"
                      : "text-muted-foreground",
                ].join(" ")}
              >
                {label}
              </Button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content panel */}
      <main className="flex-1 px-4 py-6 sm:px-10 sm:py-8 max-w-2xl">

        {section === "profile" && (
          <div className="space-y-8">
            {/* Section header */}
            <div>
              <h2 className="text-base font-semibold">{s.profileCard.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{s.profileCard.description}</p>
            </div>

            <Separator />

            {/* Name */}
            <div className="space-y-3 max-w-sm">
              <div className="space-y-1.5">
                <Label>{s.profileCard.nameLabel}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <Button onClick={handleSaveProfile} disabled={saving === "profile" || name === user.name}>
                {saving === "profile" ? t.common.saving : s.profileCard.saveNameButton}
              </Button>
            </div>

            {emailEnabled && (
              <>
                <Separator />

                {/* Email */}
                <div className="space-y-3 max-w-sm">
                  <div className="space-y-1.5">
                    <Label>{s.profileCard.emailLabel}</Label>
                    <Input value={email} onChange={(e) => { setEmail(e.target.value); setEmailSent(false); }} disabled={saving === "email"} />
                    {emailSent && <p className="text-xs text-emerald-600">{s.profileCard.emailSent}</p>}
                  </div>
                  <Button onClick={handleChangeEmail} disabled={saving === "email" || email === user.email || emailSent} variant="outline">
                    {saving === "email" ? s.profileCard.changingEmail : s.profileCard.changeEmailButton}
                  </Button>
                </div>
              </>
            )}

            <Separator />

            {/* Language */}
            <div className="space-y-1.5 max-w-sm">
              <Label>{s.profileCard.localeLabel}</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={locale || "__auto__"}
                  onValueChange={(v) => handleSaveLocale(v === "__auto__" ? "" : v)}
                  disabled={saving === "locale"}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">{s.profileCard.localeAuto}</SelectItem>
                    {(Object.entries(s.profileCard.localeOptions) as [string, string][]).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {saving === "locale" && <span className="text-xs text-muted-foreground shrink-0">{t.common.saving}</span>}
              </div>
              <p className="text-xs text-muted-foreground">{s.profileCard.localeHint}</p>
            </div>
          </div>
        )}

        {section === "security" && (
          <div className="space-y-8">
            {/* Section header */}
            <div>
              <h2 className="text-base font-semibold">{s.securityCard.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{s.securityCard.description}</p>
            </div>

            <Separator />

            <div className="space-y-4 max-w-sm">
              <div className="space-y-1.5">
                <Label>{s.securityCard.currentPasswordLabel}</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{s.securityCard.newPasswordLabel}</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <Button onClick={handleChangePassword} disabled={saving === "password" || !currentPassword || !newPassword}>
                {saving === "password" ? s.securityCard.submittingButton : s.securityCard.submitButton}
              </Button>
            </div>
          </div>
        )}

        {section === "links" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-base font-semibold">{s.linksCard.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{s.linksCard.description}</p>
            </div>

            <Separator />

            <div className="space-y-4">
              {availablePlatforms.map((platform) => {
                const status = linksStatus?.[platform];
                const codeEntry = generatedCodes[platform];
                const platformLabel = (s.linksCard.platforms as Record<string, string>)[platform] ?? platform;

                return (
                  <div key={platform} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{platformLabel}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {status?.linked
                            ? `${s.linksCard.linkedAs} ${status.handle}`
                            : s.linksCard.notLinked}
                        </p>
                      </div>
                      {status?.linked ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={unlinking === platform}>
                              <Unlink className="w-3 h-3 mr-1" />
                              {s.linksCard.unlink}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{s.linksCard.unlinkConfirmTitle}</AlertDialogTitle>
                              <AlertDialogDescription>{s.linksCard.unlinkConfirmDescription}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{s.linksCard.unlinkConfirmCancel}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleUnlink(platform)}>{s.linksCard.unlinkConfirmDelete}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateCode(platform)}
                          disabled={generating === platform}
                        >
                          {generating === platform ? t.common.loading : s.linksCard.generateCode}
                        </Button>
                      )}
                    </div>

                    {codeEntry && !status?.linked && (
                      <div className="bg-muted rounded-md p-3 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {s.linksCard.instruction}
                          {botHandles[platform] && (
                            <span className="ml-1 font-medium text-foreground">{botHandles[platform]}</span>
                          )}
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm font-mono bg-background border rounded px-2 py-1">
                            /link {codeEntry.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyCode(platform, codeEntry.code)}
                          >
                            {copied === platform ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span className="ml-1 text-xs">{s.linksCard.copyCode}</span>
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">{s.linksCard.codeExpiry}</p>
                        <p className="text-xs text-muted-foreground/70">{s.linksCard.refreshHint}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {section === "account" && (
          <div className="space-y-8">
            {/* Section header */}
            <div>
              <h2 className="text-base font-semibold">{s.tabAccount}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{s.retentionNotice.replace("{days}", String(retentionDays))}</p>
            </div>

            <Separator />

            <div className="space-y-3 max-w-sm">
              <div>
                <p className="text-sm font-medium text-red-600">{s.dangerCard.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.dangerCard.description}</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">{s.dangerCard.deleteButton}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{s.dangerCard.confirmTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{s.dangerCard.confirmDescription}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{s.dangerCard.confirmCancel}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700 text-white">{s.dangerCard.confirmDelete}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}