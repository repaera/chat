import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";

// Resend is only initialized if an API key exists in env.
// If absent, email verification & reset password are automatically disabled.
const resend = process.env.RESEND_API_KEY
	? new Resend(process.env.RESEND_API_KEY)
	: null;

const FROM = process.env.RESEND_FROM ?? "noreply@localhost";

export const auth = betterAuth({
	// ── Database ──────────────────────────────────────────────────
	database: prismaAdapter(db, {
		provider: (process.env.DATABASE_PROVIDER ?? "sqlite") as
			| "sqlite"
			| "postgresql"
			| "mysql",
	}),

	// ── ID generation ─────────────────────────────────────────────
	// v1.4+: advanced.generateId removed, use advanced.database.generateId
	// Docs: https://better-auth.com/blog/1-4
	advanced: {
		database: {
			generateId: newId, // UUID v7 — time-ordered, sortable
		},
	},

	// ── Email & Password ──────────────────────────────────────────
	// sendResetPassword is inside emailAndPassword (not top-level emailPasswordReset)
	// resetPasswordTokenExpiresIn is also here, not in emailPasswordReset
	// Docs: https://better-auth.com/docs/authentication/email-password
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		maxPasswordLength: 128,
		requireEmailVerification: !!resend,

		// Reset password — only active if Resend is configured
		...(resend && {
			sendResetPassword: async ({
				user,
				url,
			}: {
				user: { name?: string; email: string };
				url: string;
			}) => {
				// void: do not await — better-auth docs recommend this
				// to prevent timing attacks and avoid holding the response
				void resend.emails.send({
					from: FROM,
					to: user.email,
					subject: "Reset password — Chat",
					html: `
            <p>Halo ${user.name ?? ""},</p>
            <p>click link below to reset password:</p>
            <a href="${url}">${url}</a>
            <p>link valid for 1 hour.</p>
            <p>ignore this email if you did not request a password reset.</p>
          `,
				});
			},
			resetPasswordTokenExpiresIn: 60 * 60, // 1 hour (in seconds)
		}),
	},

	// ── Email Verification ────────────────────────────────────────
	// emailVerification is a top-level key, separate from emailAndPassword
	// Docs: https://better-auth.com/docs/concepts/email
	emailVerification: resend
		? {
				sendVerificationEmail: async ({
					user,
					url,
				}: {
					user: { name?: string; email: string };
					url: string;
				}) => {
					// void: do not await — prevent timing attacks
					void resend.emails.send({
						from: FROM,
						to: user.email,
						subject: "Verify your email — Chat",
						html: `
              <p>Hello ${user.name ?? ""},</p>
              <p>Click the link below to verify your email:</p>
              <a href="${url}">${url}</a>
              <p>Link valid for 1 hour.</p>
            `,
					});
				},
				// Send automatically on sign in if the email is not yet verified
				sendOnSignIn: true,
				// Verification token duration (seconds)
				expiresIn: 60 * 60,
			}
		: undefined,

	// ── Social Providers ──────────────────────────────────────────
	// Google OAuth — only active if both env vars are set
	// Docs: https://better-auth.com/docs/authentication/google
	...(process.env.GOOGLE_CLIENT_ID &&
		process.env.GOOGLE_CLIENT_SECRET && {
			socialProviders: {
				google: {
					clientId: process.env.GOOGLE_CLIENT_ID,
					clientSecret: process.env.GOOGLE_CLIENT_SECRET,
					// Always show account picker — better UX for multi-account
					prompt: "select_account" as const,
				},
			},
		}),

	// ── Session ───────────────────────────────────────────────────
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // refresh every 1 day
		cookieCache: {
			enabled: true,
			maxAge: 60 * 5, // cache session in cookie for 5 minutes
		},
	},

	user: {
		deleteUser: {
			enabled: true,
		},
		// Expose locale field to session — set during registration via geo/Accept-Language.
		// User can override in Settings via authClient.updateUser({ locale }).
		// Docs: https://better-auth.com/docs/concepts/database#extending-core-schema
		additionalFields: {
			locale: {
				type: "string",
				required: false,
				defaultValue: null,
				input: true, // can be set during signUp and updateUser
			},
		},
		// changeEmail requires emailVerification.sendVerificationEmail to send a verification link to the new email. Only enabled if Resend is configured.
		// If Resend is not present, change email feature is unavailable.
		// Docs: https://better-auth.com/docs/concepts/users-accounts#change-email
		...(resend && {
			changeEmail: {
				enabled: true,
				// sendChangeEmailConfirmation (optional) — send a notification to the OLD email
				// before the verification link is sent to the new email.
				// The verification link to the new email is sent via emailVerification.sendVerificationEmail.
				sendChangeEmailConfirmation: async ({
					user,
					newEmail,
					url,
				}: {
					user: { name?: string; email: string };
					newEmail: string;
					url: string;
				}) => {
					void resend.emails.send({
						from: FROM,
						to: user.email,
						subject: "Confirm email change — Chat",
						html: `
              <p>Hello ${user.name ?? ""},</p>
              <p>There is a request to change your account's email to <strong>${newEmail}</strong>.</p>
              <p>Click the link below to confirm:</p>
              <a href="${url}">${url}</a>
              <p>Link valid for 1 hour.</p>
              <p>Ignore this email if you did not request an email change.</p>
            `,
					});
				},
			},
		}),
	},
});

// Type exports for use in server components and API routes
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
