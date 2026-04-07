import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRouter from "./routes/auth.js";
import classesRouter from "./routes/classes.js";
import playersRouter from "./routes/players.js";
import tournamentsRouter from "./routes/tournaments/index.js";
import { errorMiddleware } from "./middleware/error.js";

export function createApp()
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, "../../client/dist");

  const app = express();
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json());

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
