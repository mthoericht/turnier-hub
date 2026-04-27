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
import authRouter from "./routes/auth.js";
import classesRouter from "./routes/classes.js";
import playersRouter from "./routes/players.js";
import tournamentsRouter from "./routes/tournaments/index.js";
import adminRouter from "./routes/admin.js";
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
export function createApp()
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, "../../client/dist");

  const app = express();

  // Security baseline: trust proxy, headers, CORS and request payload limits.
  app.set("trust proxy", TRUST_PROXY);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) =>
      {
        // Allow non-browser requests that have no Origin header.
        if (!origin)
        {
          callback(null, true);
          return;
        }

        if (isOriginAllowed(origin))
        {
          callback(null, true);
          return;
        }

        callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

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
  app.use("/api/auth", authRouter);
  app.use("/api/classes", classesRouter);
  app.use("/api/players", playersRouter);
  app.use("/api/tournaments", tournamentsRouter);
  app.use("/api/admin", adminRouter);

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
