import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ServiceError } from "../services/ServiceError.js";

/**
 * Global API error middleware that maps known domain/DB errors to stable HTTP responses.
 */
export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) =>
{
  if (err instanceof ServiceError)
  {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (
    err instanceof Prisma.PrismaClientKnownRequestError
    && err.code === "P2002"
  )
  {
    res.status(409).json({ error: "Konflikt: Datensatz existiert bereits" });
    return;
  }

  // Express body-parser errors carry a numeric `status` (e.g. 413, 400).
  if (typeof (err as { status?: unknown }).status === "number")
  {
    const status = (err as { status: number }).status;
    res.status(status).json({ error: status === 413 ? "Anfrage zu groß" : "Ungültige Anfrage" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Interner Serverfehler" });
};
