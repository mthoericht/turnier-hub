import type { Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { getTokenVerifier } from "../auth/tokenVerifier.js";
import type { RealtimeEvent, RealtimeEventBus } from "./eventBus.js";

export const SSE_HEARTBEAT_INTERVAL_MS = 30_000;
export const MAX_TOURNAMENT_SUBS_PER_CLIENT = 50;

const querySchema = z.object({
  token: z.string().min(1),
  tournaments: z.string().optional(),
});

/**
 * Verifies the token delivered as a query parameter and resolves it to the
 * internal user id via the active {@link getTokenVerifier} (local HS256 or
 * Cognito). Returns the user id on success, `null` otherwise.
 *
 * EventSource cannot send `Authorization` headers, so the token must travel as
 * a query parameter — same approach as the legacy WebSocket upgrade.
 */
export async function authenticateSseToken(token: string): Promise<string | null>
{
  const identity = await getTokenVerifier().verify(token);
  return identity?.userId ?? null;
}

/**
 * Parses a comma-separated list of tournament ids from an SSE query value.
 *
 * Caps at `MAX_TOURNAMENT_SUBS_PER_CLIENT` to bound work per connection.
 */
export function parseTournamentIds(raw: string | undefined): ReadonlySet<string>
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
 * Validates the incoming query string for the SSE endpoint and returns either
 * a parsed value with `token` and (already cropped) `tournamentIds`, or a
 * structured error describing why the request must be rejected.
 */
export function parseSseQuery(query: unknown):
  | { kind: "ok"; token: string; tournamentIds: ReadonlySet<string> }
  | { kind: "invalid" }
{
  const parsed = querySchema.safeParse(query);
  if (!parsed.success)
  {
    return { kind: "invalid" };
  }
  return {
    kind: "ok",
    token: parsed.data.token,
    tournamentIds: parseTournamentIds(parsed.data.tournaments),
  };
}

type StartSseStreamOptions = {
  bus: RealtimeEventBus;
  tournamentIds: ReadonlySet<string>;
  /** Writes a single SSE chunk (including its trailing `\n\n`) to the client. */
  write: (chunk: string) => void;
  /**
   * Registers a callback that runs when the underlying transport closes
   * (HTTP `req.close`, Lambda response stream `close`, etc.). The callback
   * stops the heartbeat and unsubscribes from the bus.
   */
  onClose: (handler: () => void) => void;
};

/**
 * Wires a transport-agnostic SSE stream to the realtime bus.
 *
 * Steps performed:
 *  1. Writes an initial `: connected` comment so an `EventSource` reaches OPEN.
 *  2. Subscribes to the bus and writes `event: <type>` / `data: <json>` frames.
 *  3. Sends a `: heartbeat` comment every `SSE_HEARTBEAT_INTERVAL_MS` to keep
 *     intermediate proxies (CloudFront, Nginx, …) from idling out the stream.
 *  4. Registers a single-shot cleanup with the supplied `onClose` hook.
 *
 * Returns the cleanup function so callers may invoke it explicitly (e.g. in a
 * Lambda handler whose runtime ends the stream after the work is done).
 */
export function startSseStream(options: StartSseStreamOptions): () => void
{
  const { bus, tournamentIds, write, onClose } = options;

  write(": connected\n\n");

  const unsubscribe = bus.subscribe(
    { tournamentIds },
    (event: RealtimeEvent) =>
    {
      write(`event: ${event.type}\n`);
      write(`data: ${JSON.stringify(event)}\n\n`);
    }
  );

  const heartbeat = setInterval(() =>
  {
    write(": heartbeat\n\n");
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

  onClose(cleanup);
  return cleanup;
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
    const parsed = parseSseQuery(req.query);
    if (parsed.kind !== "ok")
    {
      res.status(400).end();
      return;
    }

    const userId = await authenticateSseToken(parsed.token);
    if (!userId)
    {
      res.status(401).end();
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // Disables proxy buffering on Nginx-like proxies; CloudFront ignores it
    // but keeps SSE working through it as long as compression is disabled.
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    startSseStream({
      bus,
      tournamentIds: parsed.tournamentIds,
      write: (chunk) =>
      {
        res.write(chunk);
      },
      onClose: (handler) =>
      {
        req.on("close", handler);
        req.on("error", handler);
        res.on("close", handler);
        res.on("error", handler);
      },
    });
  };
}
