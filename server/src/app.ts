import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CORS_ALLOWED_ORIGINS,
  JSON_BODY_LIMIT,
  TRUST_PROXY,
} from "./config.js";
import authRouter from "./routes/auth.js";
import classesRouter from "./routes/classes.js";
import playersRouter from "./routes/players.js";
import tournamentsRouter from "./routes/tournaments/index.js";
import adminRouter from "./routes/admin.js";
import { errorMiddleware } from "./middleware/error.js";
import { recordHttpSecurityStatus } from "./security/monitoring.js";
import { MemoryEventBus } from "./realtime/eventBus.js";
import type { RealtimeEventBus } from "./realtime/eventBus.js";
import { setRealtimeEventBus } from "./realtime/notify.js";
import { createSseHandler } from "./realtime/sseEndpoint.js";

/**
 * Checks whether an incoming browser origin is allowed by the configured CORS allowlist.
 */
function isOriginAllowed(origin: string): boolean
{
  return CORS_ALLOWED_ORIGINS.includes(origin);
}

export type CreateAppOptions = {
  /**
   * Realtime event bus used by `notify*` helpers and the SSE endpoint.
   * Defaults to a fresh `MemoryEventBus`. Tests may pass a custom bus to
   * inspect publishes or replace with a mock.
   */
  eventBus?: RealtimeEventBus;
};

/**
 * Creates and configures the Express application.
 *
 * Includes security middleware, API routes, the realtime SSE endpoint,
 * static SPA serving, and global error handling.
 */
export function createApp(options: CreateAppOptions = {})
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, "../../client/dist");

  const eventBus = options.eventBus ?? new MemoryEventBus();
  setRealtimeEventBus(eventBus);

  const app = express();

  app.set("trust proxy", TRUST_PROXY);
  app.use(helmet());
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

  // Passive structured logging for auth-related HTTP status codes; CloudWatch
  // metric filters aggregate these into spike alarms in production.
  app.use((req, res, next) =>
  {
    res.on("finish", () =>
    {
      if (!req.path.startsWith("/api"))
      {
        return;
      }
      recordHttpSecurityStatus(res.statusCode);
    });
    next();
  });

  // Realtime SSE endpoint — must be mounted before generic /api routers so it
  // is not caught by the catch-all 404 handler.
  app.get("/api/sse", createSseHandler(eventBus));

  // API routes.
  app.use("/api/auth", authRouter);
  app.use("/api/classes", classesRouter);
  app.use("/api/players", playersRouter);
  app.use("/api/tournaments", tournamentsRouter);
  app.use("/api/admin", adminRouter);

  // SPA static assets + fallback routing for non-API paths.
  // Note: in the AWS deployment, S3 + CloudFront serve the SPA directly and
  // these handlers will never be reached. They remain for local development
  // and the legacy single-VM Ansible deployment.
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
