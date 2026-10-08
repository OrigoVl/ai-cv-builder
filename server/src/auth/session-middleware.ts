import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";

/**
 * Populates `req.userId` from the better-auth session cookie, if present. Does NOT reject
 * unauthenticated requests — that's `core/http.ts`'s `authed()` wrapper, applied per-route, so
 * public routes (health check, auth endpoints themselves) stay unaffected by this middleware.
 */
export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (session) {
      (req as Request & { userId?: string }).userId = session.user.id;
    }
  } catch {
    // No valid session — leave req.userId unset, authed() will reject downstream if required.
  }
  next();
}
