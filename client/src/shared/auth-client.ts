import { createAuthClient } from "better-auth/react";

// baseURL is left unset: in dev, Vite's proxy (vite.config.ts) forwards /api to the server; in
// prod, the client is served from the same origin as the API (see server/src/app.ts). Either
// way, "" (same-origin relative) is correct and needs no env var.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
