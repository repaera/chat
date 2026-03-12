import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // baseURL is optional if client and server share the same domain.
  // Still set it to be explicit and not rely on inference.
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});

// Named exports for direct use in components without importing authClient first.
// IMPORTANT: authClient.forgotPassword was renamed to authClient.requestPasswordReset
// since better-auth v1.4 — use requestPasswordReset in forgot-password/page.tsx
// Docs: https://better-auth.com/blog/1-4
export const {
  signIn,
  signOut,
  signUp,
  useSession,
  requestPasswordReset, // v1.4+: replaces removed forgotPassword
  resetPassword,        // used in reset-password/page.tsx
  changePassword,       // used in settings/SettingsClient.tsx
  updateUser,           // used in settings/SettingsClient.tsx
  deleteUser,           // used in settings/SettingsClient.tsx (danger zone)
  sendVerificationEmail,// used in verify-email/page.tsx (resend)
} = authClient;
