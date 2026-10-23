import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CORS_ALLOWED_ORIGINS,
  JSON_BODY_LIMIT,
  SECURITY_HTTP_STATUS_THRESHOLD,
  SECURITY_HTTP_STATUS_WINDOW_MS,
  TRUST_PROXY,
} from "./config.js";
import classesRouter from "./routes/classes.js";
import playersRouter from "./routes/players.js";
import tournamentsRouter from "./routes/tournaments/index.js";
import { errorMiddleware } from "./middleware/error.js";
import { recordHttpSecurityStatus } from "./security/monitoring.js";

/**
 * Checks whether an incoming browser origin is allowed by the configured CORS allowlist.
 */
function isOriginAllowed(origin: string): boolean
{
  return CORS_ALLOWED_ORIGINS.includes(origin);
}

/**
 * Creates and configures the Express application.
 *
 * Includes security middleware, API routes, static SPA serving, and global error handling.
 */
export function createApp(options: { clientDist?: string; localDesktop?: boolean } = {})
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = options.clientDist ?? path.resolve(__dirname, "../../client/dist");

  const app = express();

  // Security baseline: trust proxy, headers, CORS and request payload limits.
  app.set("trust proxy", TRUST_PROXY);
  app.use(helmet(options.localDesktop ? {
    contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
    strictTransportSecurity: false,
  } : {}));
  app.use(
    cors({
      origin: (origin, callback) =>
      {
        if (!origin || isOriginAllowed(origin))
        {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
    })
  );

  // Explicitly reject preflight from disallowed origins.
  app.options("/api/*", (req, res) =>
  {
    res.sendStatus(403);
  });

  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  // Shared LAN editing is account-free. Reject browser requests from unrelated
  // sites explicitly; CORS response headers alone do not stop simple writes.
  app.use("/api", (req, res, next) =>
  {
    const origin = req.headers.origin;
    const allowedHosts = CORS_ALLOWED_ORIGINS.map((value) => new URL(value).host);
    if ((origin && !isOriginAllowed(origin))
      || (options.localDesktop && !allowedHosts.includes(req.headers.host ?? "")))
    {
      res.status(403).json({ error: "Netzwerkadresse nicht erlaubt" });
      return;
    }
    next();
  });

  // Passive telemetry for auth-related HTTP status spikes.
  app.use((req, res, next) =>
  {
    res.on("finish", () =>
    {
      if (!req.path.startsWith("/api"))
      {
        return;
      }
      recordHttpSecurityStatus(res.statusCode, {
        windowMs: SECURITY_HTTP_STATUS_WINDOW_MS,
        thresholdPerWindow: SECURITY_HTTP_STATUS_THRESHOLD,
      });
    });
    next();
  });

  // API routes.
  app.use("/api/classes", classesRouter);
  app.use("/api/players", playersRouter);
  app.use("/api/tournaments", tournamentsRouter);

  // SPA static assets + fallback routing for non-API paths.
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) =>
  {
    if (req.path.startsWith("/api"))
    {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });

  // API not-found handler and global error mapper.
  app.use((req, res) =>
  {
    res.status(404).json({ error: "Nicht gefunden" });
  });

  app.use(errorMiddleware);

  return app;
}
