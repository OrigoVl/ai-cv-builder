import type { NextFunction, Request, RequestHandler, Response } from "express";

/** An error with an HTTP status attached, safe to surface to the client via its `message`. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export const notFound = (message = "Not found") => new HttpError(404, message);
export const badRequest = (message = "Bad request") => new HttpError(400, message);
export const conflict = (message = "Conflict") => new HttpError(409, message);
export const unauthorized = (message = "Unauthorized") => new HttpError(401, message);

/** Wraps an async route handler so rejected promises reach Express's error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export interface AuthedRequest extends Request {
  userId: string;
}

/**
 * Wraps a handler that requires an authenticated session. `req.userId` is populated by the
 * session middleware (see `auth/session-middleware.ts`) before this runs.
 */
export function authed(
  fn: (req: AuthedRequest, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    const userId = (req as Partial<AuthedRequest>).userId;
    if (!userId) {
      next(unauthorized());
      return;
    }
    fn(req as AuthedRequest, res, next).catch(next);
  };
}
