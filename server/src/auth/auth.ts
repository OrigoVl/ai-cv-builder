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
  rateLimit: {
    window: 10,
    max: 10,
  },

  advanced: {
    // This app has no HTTPS termination anywhere in its "docker compose up, open localhost"
    // deployment (no reverse proxy, no cert) — a `Secure` cookie here would depend on browsers'
    // special-casing of "localhost" as a secure context rather than on anything this app
    // actually provides, so it's left off rather than tying correctness to that behavior.
    useSecureCookies: false,
  },
});

export type Session = typeof auth.$Infer.Session;
