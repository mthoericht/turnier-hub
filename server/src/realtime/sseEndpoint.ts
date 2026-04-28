import type { Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { JWT_SECRET } from "../config.js";
import type { AuthPayload } from "../auth/token.js";
import { prisma } from "../db.js";
import type { RealtimeEvent, RealtimeEventBus } from "./eventBus.js";

const SSE_HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_TOURNAMENT_SUBS_PER_CLIENT = 50;

const querySchema = z.object({
  token: z.string().min(1),
  tournaments: z.string().optional(),
});

/**
 * Verifies the JWT delivered as a query parameter and confirms the user still
 * exists with a matching `tokenVersion`. Returns the user id on success.
 *
 * EventSource cannot send `Authorization` headers, so the token must travel as
 * a query parameter — same approach as the legacy WebSocket upgrade.
 */
async function authenticate(token: string): Promise<string | null>
{
  try
  {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, tokenVersion: true },
    });
    if (!user) return null;
    if ((decoded.tv ?? 0) !== user.tokenVersion) return null;
    return user.id;
  }
  catch
  {
    return null;
  }
}

/**
 * Parses a comma-separated list of tournament ids from the SSE query string.
 *
 * Caps at `MAX_TOURNAMENT_SUBS_PER_CLIENT` to bound work per connection.
 */
function parseTournamentIds(raw: string | undefined): ReadonlySet<string>
{
  if (!raw)
  {
    return new Set();
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length > MAX_TOURNAMENT_SUBS_PER_CLIENT)
  {
    return new Set(parts.slice(0, MAX_TOURNAMENT_SUBS_PER_CLIENT));
  }
  return new Set(parts);
}

/**
 * Writes one SSE frame for a realtime event using its `type` as the SSE event
 * name and serialised payload as data. The blank line terminates the frame.
 */
function writeSseFrame(res: Response, event: RealtimeEvent): void
{
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Builds the Express handler for `GET /api/sse`.
 *
 * On connect: validates JWT, parses subscriptions from `?tournaments=`,
 * sets SSE response headers, and registers a listener with the realtime bus
 * that streams matching events to the client until the request closes.
 */
export function createSseHandler(bus: RealtimeEventBus): RequestHandler
{
  return async function sseHandler(req: Request, res: Response): Promise<void>
  {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success)
    {
      res.status(400).end();
      return;
    }

    const userId = await authenticate(parsed.data.token);
    if (!userId)
    {
      res.status(401).end();
      return;
    }

    const tournamentIds = parseTournamentIds(parsed.data.tournaments);

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // Disables proxy buffering on Nginx-like proxies; CloudFront ignores it
    // but keeps SSE working through it as long as compression is disabled.
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    // Initial comment so the EventSource client transitions to OPEN even when
    // no realtime events have happened yet.
    res.write(": connected\n\n");

    const unsubscribe = bus.subscribe(
      { tournamentIds },
      (event) =>
      {
        writeSseFrame(res, event);
      }
    );

    const heartbeat = setInterval(() =>
    {
      // SSE comments keep intermediate proxies from idling-out the connection.
      res.write(": heartbeat\n\n");
    }, SSE_HEARTBEAT_INTERVAL_MS);
    if (typeof heartbeat.unref === "function")
    {
      heartbeat.unref();
    }

    let cleanedUp = false;
    const cleanup = (): void =>
    {
      if (cleanedUp) return;
      cleanedUp = true;
      clearInterval(heartbeat);
      unsubscribe();
    };

    req.on("close", cleanup);
    req.on("error", cleanup);
    res.on("close", cleanup);
    res.on("error", cleanup);
  };
}
