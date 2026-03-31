"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/lib/app-config";
import { requestPasswordReset } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
	const { t } = useLocale();
	const fp = t.forgotPassword;

	const schema = z.object({
		email: z
			.string()
			.min(1, fp.errors.emailRequired)
			.pipe(z.email(fp.errors.emailInvalid)),
	});
	type FormValues = z.infer<typeof schema>;

	const {
		register,
		handleSubmit,
		formState: { errors },
		watch,
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		mode: "onTouched",
	});

	const email = watch("email", "");
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);

	const onSubmit = async (data: FormValues) => {
		setLoading(true);
		const { error } = await requestPasswordReset({
			email: data.email,
			redirectTo: "/reset-password",
		});
		setLoading(false);
		if (error) {
			toast.error(fp.errors.genericError);
			return;
		}
		setSent(true);
	};

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center space-y-2">
					<div className="inline-flex items-center justify-center size-12">
						<img
							src={appConfig.iconSvg ?? "/icon.svg"}
							alt=""
							className="size-12"
						/>
					</div>
					<h1 className="text-xl font-semibold">{fp.pageTitle}</h1>
					<p className="text-sm text-muted-foreground">
						{sent ? fp.pageSubtitleSent : fp.pageSubtitleDefault}
					</p>
				</div>

				<Card>
					<CardHeader className="pb-4">
						<CardTitle className="text-base">{fp.cardTitle}</CardTitle>
						<CardDescription className="text-xs">
							{sent ? fp.cardDescriptionSent : fp.cardDescriptionDefault}
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-4">
						{!sent ? (
							<form
								onSubmit={handleSubmit(onSubmit)}
								noValidate
								className="space-y-4"
							>
								<div className="space-y-1.5">
									<Label htmlFor="email" className="text-xs">
										{fp.emailLabel}
									</Label>
									<Input
										id="email"
										type="email"
										{...register("email")}
										placeholder="you@email.com"
										autoComplete="email"
										autoFocus
										disabled={loading}
										aria-describedby={errors.email ? "email-error" : undefined}
										aria-invalid={!!errors.email}
										className={
											errors.email
												? "border-red-500 focus-visible:ring-red-500"
												: ""
										}
									/>
									{errors.email && (
										<p
											id="email-error"
											role="alert"
											className="text-xs text-red-500"
										>
											{errors.email.message}
										</p>
									)}
								</div>

								<Button
									type="submit"
									disabled={loading || !email}
									className="w-full font-medium"
								>
									{loading ? (
										<span className="flex items-center gap-2">
											<span className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
											{fp.submittingButton}
										</span>
									) : (
										fp.submitButton
									)}
								</Button>
							</form>
						) : (
							<div className="space-y-3">
								<div className="text-center py-2">
									<MailCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
									<p className="text-sm text-muted-foreground">
										{fp.sentTo}{" "}
										<span className="text-foreground font-medium">{email}</span>
									</p>
								</div>
								<Button
									variant="outline"
									className="w-full"
									onClick={() => setSent(false)}
									disabled={loading}
								>
									{fp.sendToAnother}
								</Button>
							</div>
						)}

						<p className="text-center text-xs">
							<Link
								href="/login"
								className="text-muted-foreground hover:text-foreground transition-colors"
							>
								{fp.backToLogin}
							</Link>
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
