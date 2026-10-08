import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import path from "node:path";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth/auth.js";
import { sessionMiddleware } from "./auth/session-middleware.js";
import { cvsRouter } from "./modules/cvs/cvs.routes.js";
import { HttpError } from "./core/http.js";
import { logger } from "./core/logger.js";
import { env, isProduction } from "./config/env.js";

export function createApp(): express.Express {
  const app = express();

  app.use(
    helmet({
      // The live PDF preview (client/src/features/cvs/CvPdfPreview.tsx) does two things that
      // need CSP room beyond helmet's strict defaults, found by actually loading the feature in
      // a browser and reading the CSP violations in the console rather than guessing up front:
      // (1) react-pdf (generating the PDF) compiles a WebAssembly module loaded from a `data:`
      //     URI — needs 'wasm-unsafe-eval' (the narrow, WASM-only alternative to 'unsafe-eval',
      //     which this does NOT grant — arbitrary eval() of JS strings is still blocked) and
      //     `data:` in connect-src.
      // (2) pdf.js (rendering it to canvas) insists on parsing/decoding in a Worker — needs its
      //     same-origin worker script allowed, which 'self' alone doesn't reliably cover for
      //     worker-src across browsers (it's a separate fetch directive, distinct from the
      //     script-src used for ordinary <script> tags).
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "script-src": ["'self'", "'wasm-unsafe-eval'"],
          "connect-src": ["'self'", "data:"],
          "worker-src": ["'self'"],
        },
      },
    }),
  );
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));

  // better-auth's own handler needs the raw request (it parses the body itself) — mounted
  // BEFORE express.json() so the global JSON parser never consumes it first.
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json({ limit: "1mb" }));
  app.use(sessionMiddleware);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/cvs", cvsRouter);

  // 404 for any other /api/* route.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Central error handler — never leaks stack traces or raw error messages for anything that
  // isn't an explicitly-thrown HttpError (those are already written to be user-safe).
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.message });
      return;
    }
    logger.error({ err, path: req.path }, "Unhandled error");
    res.status(500).json({ error: "Internal server error" });
  });

  if (isProduction) {
    // The client build is served from this same process in prod (one container, per the "no
    // deployment, docker compose up" constraint) — see Dockerfile.
    const clientDist = path.join(import.meta.dirname, "../../client/dist");
    app.use(express.static(clientDist));
    app.get("/*splat", (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  return app;
}
