"use client";

import { useState } from "react";
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
import { ArrowLeft } from "lucide-react";

type Section = "profile" | "security" | "account";

type Props = {
  user: { id: string; name: string; email: string; image: string | null; locale?: string | null };
  retentionDays: number;
  emailEnabled: boolean;
};

export default function SettingsClient({ user, retentionDays, emailEnabled }: Props) {
  const { t } = useLocale();
  const s = t.settings;

  const router = useRouter();
  const [section, setSection] = useState<Section>("profile");
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [locale, setLocale] = useState(user.locale ?? "");
  const [savingLocale, setSavingLocale] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await authClient.updateUser({ name });
      toast.success(s.toasts.profileSaved);
    } catch {
      toast.error(s.toasts.profileError);
    } finally { setSavingProfile(false); }
  };

  const handleChangeEmail = async () => {
    if (email === user.email) return;
    setSavingEmail(true);
    try {
      await authClient.changeEmail({ newEmail: email, callbackURL: "/settings" });
      setEmailSent(true);
      toast.success(s.profileCard.emailSent);
    } catch {
      toast.error(s.toasts.profileError);
    } finally { setSavingEmail(false); }
  };

  const handleSaveLocale = async (value: string) => {
    setLocale(value);
    setSavingLocale(true);
    try {
      await authClient.updateUser({ locale: value } as Parameters<typeof authClient.updateUser>[0]);
      // router.refresh() triggers server re-render of layout.tsx —
      // LocaleProvider will pick up the new locale from the DB without a full page reload
      router.refresh();
    } catch {
      toast.error(s.toasts.localeError);
    } finally { setSavingLocale(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) { toast.error(s.securityCard.errors.tooShort); return; }
    setSavingPassword(true);
    try {
      await authClient.changePassword({ currentPassword, newPassword });
      toast.success(s.securityCard.success);
      setCurrentPassword(""); setNewPassword("");
    } catch {
      toast.error(s.securityCard.errors.wrongPassword);
    } finally { setSavingPassword(false); }
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
              <Button onClick={handleSaveProfile} disabled={savingProfile || name === user.name}>
                {savingProfile ? t.common.saving : s.profileCard.saveNameButton}
              </Button>
            </div>

            {emailEnabled && (
              <>
                <Separator />

                {/* Email */}
                <div className="space-y-3 max-w-sm">
                  <div className="space-y-1.5">
                    <Label>{s.profileCard.emailLabel}</Label>
                    <Input value={email} onChange={(e) => { setEmail(e.target.value); setEmailSent(false); }} disabled={savingEmail} />
                    {emailSent && <p className="text-xs text-emerald-600">{s.profileCard.emailSent}</p>}
                  </div>
                  <Button onClick={handleChangeEmail} disabled={savingEmail || email === user.email || emailSent} variant="outline">
                    {savingEmail ? s.profileCard.changingEmail : s.profileCard.changeEmailButton}
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
                  disabled={savingLocale}
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
                {savingLocale && <span className="text-xs text-muted-foreground shrink-0">{t.common.saving}</span>}
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
              <Button onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword}>
                {savingPassword ? s.securityCard.submittingButton : s.securityCard.submitButton}
              </Button>
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