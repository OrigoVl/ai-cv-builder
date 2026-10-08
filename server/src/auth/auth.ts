// The single better-auth instance. Scope is deliberately narrow per the task brief: email +
// password only, no OAuth, no email verification, no password reset (all explicitly out of
// scope). better-auth still gives us httpOnly-cookie sessions, scrypt password hashing, and its
// own brute-force rate limiting on /sign-in and /sign-up for free.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/client.js";
import * as schema from "../db/schema/index.js";
import { env } from "../config/env.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: env.AUTH_SECRET,
  // The client build is served from this same process/port in production (see app.ts), and in
  // dev Vite proxies /api here — either way this process's own port is the right baseURL.
  baseURL: `http://localhost:${env.PORT}`,
  trustedOrigins: [env.CLIENT_ORIGIN],

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },

  // better-auth's built-in brute-force limiter for /sign-in, /sign-up, etc. Single-container app,
  // so in-memory storage (the default) is fine — no second process to share counters with.
  //
  // better-auth also applies its OWN hard-coded rule to the credential endpoints specifically
  // (3 requests per 10s per IP) that the global `max` above does NOT override — found by an e2e
  // run that did a handful of legitimate sign-ups/sign-ins back to back and got rate-limited on
  // nothing but normal flow. `customRules` is what actually overrides it; paths are relative to
  // /api/auth.
  rateLimit: {
    window: 10,
    max: 20,
    customRules: {
      "/sign-in/*": { window: 10, max: 20 },
      "/sign-up/*": { window: 10, max: 20 },
      "/change-password": { window: 10, max: 20 },
      "/update-user": { window: 10, max: 20 },
      "/delete-user": { window: 10, max: 20 },
    },
  },

  advanced: {
    // This app has no HTTPS termination anywhere in its "docker compose up, open localhost"
    // deployment (no reverse proxy, no cert) — a `Secure` cookie here would depend on browsers'
    // special-casing of "localhost" as a secure context rather than on anything this app
    // actually provides, so it's left off rather than tying correctness to that behavior.
    useSecureCookies: false,
  },

  user: {
    // Immediate, no-email-confirmation deletion — consistent with the rest of this app's "no
    // email verification" stance. The settings page (client) always collects the user's current
    // password and sends it as `password`, which better-auth verifies itself before deleting;
    // without a password it would instead require a "fresh" session (logged in within the last
    // freshAge window), which is a worse UX for something this irreversible.
    deleteUser: { enabled: true },
  },
});

export type Session = typeof auth.$Infer.Session;
