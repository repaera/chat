"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";

type Props = {
  user: { id: string; name: string; email: string; image: string | null; locale?: string | null };
  retentionDays: number;
};

export default function SettingsClient({ user, retentionDays }: Props) {
  const { t } = useLocale();
  const s = t.settings;

  const router = useRouter();
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

  const initials = user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

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

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="border-b border-neutral-800 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-neutral-400 hover:text-neutral-200 text-sm transition-colors">
          {s.backLink}
        </Link>
        <h1 className="text-sm font-semibold">{s.pageTitle}</h1>
      </div>

      <div className="max-w-xl mx-auto p-4 sm:p-6">
        <p className="text-xs text-neutral-600 mb-4">{s.retentionNotice.replace("{days}", String(retentionDays))}</p>

        <div className="flex items-center gap-4 mb-6">
          <Avatar className="w-14 h-14">
            <AvatarImage src={user.image ?? undefined} />
            <AvatarFallback className="bg-neutral-800 text-neutral-300 text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-neutral-100">{user.name}</p>
            <p className="text-sm text-neutral-500">{user.email}</p>
          </div>
        </div>

        <Tabs defaultValue="profile">
          <TabsList className="bg-neutral-900 border border-neutral-800 w-full mb-6">
            <TabsTrigger value="profile" className="flex-1 data-[state=active]:bg-neutral-800">{s.tabProfile}</TabsTrigger>
            <TabsTrigger value="security" className="flex-1 data-[state=active]:bg-neutral-800">{s.tabSecurity}</TabsTrigger>
            <TabsTrigger value="danger" className="flex-1 data-[state=active]:bg-neutral-800 data-[state=active]:text-red-400">{s.tabAccount}</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-neutral-100 text-base">{s.profileCard.title}</CardTitle>
                <CardDescription className="text-neutral-500">{s.profileCard.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-neutral-400">{s.profileCard.nameLabel}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-neutral-800 border-neutral-700 text-neutral-100" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400">{s.profileCard.emailLabel}</Label>
                  <Input value={email} onChange={(e) => { setEmail(e.target.value); setEmailSent(false); }} className="bg-neutral-800 border-neutral-700 text-neutral-100" disabled={savingEmail} />
                  {emailSent && <p className="text-xs text-emerald-500">{s.profileCard.emailSent}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400">{s.profileCard.localeLabel}</Label>
                  <select
                    value={locale}
                    onChange={(e) => handleSaveLocale(e.target.value)}
                    disabled={savingLocale}
                    className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:opacity-50"
                  >
                    <option value="">{s.profileCard.localeAuto}</option>
                    {(Object.entries(s.profileCard.localeOptions) as [string, string][]).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-neutral-600">{s.profileCard.localeHint}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveProfile} disabled={savingProfile || name === user.name} className="bg-neutral-100 text-neutral-900 hover:bg-white">
                    {savingProfile ? t.common.saving : s.profileCard.saveNameButton}
                  </Button>
                  <Button onClick={handleChangeEmail} disabled={savingEmail || email === user.email || emailSent} variant="outline" className="border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                    {savingEmail ? s.profileCard.changingEmail : s.profileCard.changeEmailButton}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-neutral-100 text-base">{s.securityCard.title}</CardTitle>
                <CardDescription className="text-neutral-500">{s.securityCard.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-neutral-400">{s.securityCard.currentPasswordLabel}</Label>
                  <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="bg-neutral-800 border-neutral-700 text-neutral-100" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400">{s.securityCard.newPasswordLabel}</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-neutral-800 border-neutral-700 text-neutral-100" />
                </div>
                <Button onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword} className="bg-neutral-100 text-neutral-900 hover:bg-white">
                  {savingPassword ? s.securityCard.submittingButton : s.securityCard.submitButton}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="danger">
            <Card className="bg-neutral-900 border-red-900/30">
              <CardHeader>
                <CardTitle className="text-red-400 text-base">{s.dangerCard.title}</CardTitle>
                <CardDescription className="text-neutral-500">{s.dangerCard.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">{s.dangerCard.deleteButton}</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-neutral-900 border-neutral-800">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-neutral-100">{s.dangerCard.confirmTitle}</AlertDialogTitle>
                      <AlertDialogDescription className="text-neutral-500">{s.dangerCard.confirmDescription}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-transparent border-neutral-700 text-neutral-300">{s.dangerCard.confirmCancel}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700 text-white">{s.dangerCard.confirmDelete}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}