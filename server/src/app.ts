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
import { errorMiddleware } from "./middleware/error.js";

function isOriginAllowed(origin: string): boolean
{
  return CORS_ALLOWED_ORIGINS.includes(origin);
}

export function createApp()
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, "../../client/dist");

  const app = express();
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

  app.use("/api/auth", authRouter);
  app.use("/api/classes", classesRouter);
  app.use("/api/players", playersRouter);
  app.use("/api/tournaments", tournamentsRouter);

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

  app.use((req, res) =>
  {
    res.status(404).json({ error: "Nicht gefunden" });
  });

  app.use(errorMiddleware);

  return app;
}
