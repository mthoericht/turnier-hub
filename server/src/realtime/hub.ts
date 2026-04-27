import type { IncomingMessage, Server } from "node:http";
import jwt from "jsonwebtoken";
import { WebSocketServer, WebSocket } from "ws";
import {
  CORS_ALLOWED_ORIGINS,
  JWT_SECRET,
  SECURITY_WS_CONNECTIONS_THRESHOLD,
  SECURITY_WS_CONNECTIONS_WINDOW_MS,
  TRUST_PROXY,
  WS_CONNECT_MAX_PER_IP,
  WS_CONNECT_WINDOW_MS,
  WS_MAX_PAYLOAD_BYTES,
  WS_MAX_SUBSCRIPTIONS_PER_CLIENT,
  WS_MESSAGE_MAX_PER_WINDOW,
  WS_MESSAGE_WINDOW_MS,
} from "../config.js";
import type { AuthPayload } from "../auth/token.js";
import { prisma } from "../db.js";
import {
  onWsConnectionClosed,
  onWsConnectionOpened,
  onWsRateLimitTriggered,
} from "../security/monitoring.js";

const WS_PATH = "/api/ws";
const WS_POLICY_VIOLATION_CODE = 1008;
const WS_REASON_RATE_LIMIT_EXCEEDED = "rate_limit_exceeded";
const WS_REASON_MAX_SUBSCRIPTIONS_EXCEEDED = "max_subscriptions_exceeded";

export type ServerPushMessage =
  | { type: "tournamentChanged"; tournamentId: string }
  | { type: "catalogChanged"; kinds: Array<"players" | "classes"> }
  | { type: "tournamentsChanged" };

type ClientMessage =
  | { type: "subscribe"; tournamentId: string }
  | { type: "unsubscribe"; tournamentId: string };

type SocketMeta = {
  userId: string;
  tournamentIds: Set<string>;
  messageCount: number;
  messageWindowStartedAtMs: number;
  closing: boolean;
};

type Counter = {
  count: number;
  resetAtMs: number;
};

type UpgradeSocket = {
  write: (chunk: string) => boolean;
  destroy: () => void;
};

// --- Upgrade/auth and rate-limit helpers ---

/**
 * Extracts and verifies the JWT from websocket upgrade query params,
 * then confirms the user still exists and tokenVersion matches.
 */
async function parseTokenUserId(req: IncomingMessage): Promise<string | null>
{
  const host = req.headers.host ?? "127.0.0.1";
  const url = new URL(req.url ?? "", `http://${host}`);
  const token = url.searchParams.get("token");
  if (!token) return null;
  try
  {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, tokenVersion: true },
    });
    if (!user) return null;
    if ((decoded.tv ?? 0) !== user.tokenVersion) return null;
    return decoded.sub;
  }
  catch
  {
    return null;
  }
}

/**
 * Resolves the client IP from an upgrade request using the same trust
 * semantics as Express `trust proxy`:
 *
 * - `false` / `0`:  ignore XFF entirely, use socket address.
 * - `true`:         trust the entire chain, take the leftmost entry.
 * - numeric N:      trust the rightmost N proxy hops; the client IP is
 *                   the entry just before the trusted segment.
 * - string/list:    not used for WS; falls back to rightmost-1 for safety.
 */
function getClientIp(req: IncomingMessage): string
{
  const socketIp = req.socket.remoteAddress ?? "unknown";

  if (TRUST_PROXY === false || TRUST_PROXY === 0)
  {
    return socketIp;
  }

  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded !== "string" || !forwarded.trim())
  {
    return socketIp;
  }

  const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0)
  {
    return socketIp;
  }

  if (TRUST_PROXY === true)
  {
    // Trust the whole chain — leftmost entry is the original client.
    return parts[0] ?? socketIp;
  }

  // Numeric hop count: pick the entry just before the trusted segment.
  // E.g. TRUST_PROXY=1 with chain "spoofed, real, proxy" → "real".
  const hops = typeof TRUST_PROXY === "number" ? TRUST_PROXY : 1;
  const idx = parts.length - hops;
  return (idx >= 0 ? parts[idx] : parts[0]) ?? socketIp;
}

/**
 * Converts a counter reset timestamp to `Retry-After` seconds.
 */
function getRemainingSeconds(resetAtMs: number): number
{
  return Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000));
}

/**
 * Increments a windowed counter and rotates it when the window expires.
 */
function consumeCounter(
  key: string,
  store: Map<string, Counter>,
  windowMs: number
): Counter
{
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAtMs <= now)
  {
    const fresh = { count: 1, resetAtMs: now + windowMs };
    store.set(key, fresh);
    return fresh;
  }

  existing.count += 1;
  return existing;
}

/**
 * Removes expired counters to keep in-memory stores bounded.
 */
function cleanupExpired(store: Map<string, Counter>): void
{
  const now = Date.now();
  for (const [key, counter] of store.entries())
  {
    if (counter.resetAtMs <= now)
    {
      store.delete(key);
    }
  }
}

// --- Realtime hub ---

/**
 * Websocket hub for authenticated realtime push messages and subscriptions.
 */
export class RealtimeHub
{
  private readonly wss: WebSocketServer;
  private readonly tournamentSubs = new Map<string, Set<WebSocket>>();
  private readonly socketMeta = new WeakMap<WebSocket, SocketMeta>();
  private readonly wsConnectCounters = new Map<string, Counter>();

  constructor()
  {
    this.wss = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD_BYTES });
    this.wss.on("connection", (ws: WebSocket) =>
    {
      this.onSocketOpen(ws);
    });
  }

  /**
   * Attaches websocket upgrade handling to an existing HTTP server.
   */
  attachToServer(server: Server): void
  {
    server.on("upgrade", (request, socket, head) =>
    {
      if (!this.isWsUpgradePath(request))
      {
        socket.destroy();
        return;
      }

      if (!this.allowConnectRate(request, socket))
      {
        return;
      }

      if (!this.isOriginAllowed(request, socket))
      {
        return;
      }

      this.authenticateUpgrade(request, socket).then((userId) =>
      {
        if (!userId)
        {
          return;
        }
        this.wss.handleUpgrade(request, socket, head, (ws) =>
        {
          this.socketMeta.set(ws, {
            userId,
            tournamentIds: new Set(),
            messageCount: 0,
            messageWindowStartedAtMs: Date.now(),
            closing: false,
          });
          onWsConnectionOpened({
            windowMs: SECURITY_WS_CONNECTIONS_WINDOW_MS,
            thresholdPeakConnections: SECURITY_WS_CONNECTIONS_THRESHOLD,
          });
          this.wss.emit("connection", ws, request);
        });
      }).catch(() =>
      {
        socket.write("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
        socket.destroy();
      });
    });
  }

  /**
   * Checks whether the incoming upgrade targets the websocket endpoint path.
   */
  private isWsUpgradePath(request: IncomingMessage): boolean
  {
    const host = request.headers.host ?? "127.0.0.1";
    const url = new URL(request.url ?? "", `http://${host}`);
    return url.pathname === WS_PATH;
  }

  /**
   * Enforces per-IP websocket upgrade rate limits.
   */
  private allowConnectRate(request: IncomingMessage, socket: UpgradeSocket): boolean
  {
    cleanupExpired(this.wsConnectCounters);
    const clientIp = getClientIp(request);
    const connectCounter = consumeCounter(
      clientIp,
      this.wsConnectCounters,
      WS_CONNECT_WINDOW_MS
    );
    if (connectCounter.count <= WS_CONNECT_MAX_PER_IP)
    {
      return true;
    }

    onWsRateLimitTriggered("connect");
    socket.write(
      "HTTP/1.1 429 Too Many Requests\r\n"
        + `Retry-After: ${getRemainingSeconds(connectCounter.resetAtMs)}\r\n`
        + "Connection: close\r\n\r\n"
    );
    socket.destroy();
    return false;
  }

  /**
   * Checks whether the upgrade request origin is in the allowlist.
   * Non-browser clients without an Origin header are allowed through.
   */
  private isOriginAllowed(request: IncomingMessage, socket: UpgradeSocket): boolean
  {
    const origin = request.headers.origin;
    if (!origin)
    {
      return true;
    }
    if (CORS_ALLOWED_ORIGINS.length === 0 || CORS_ALLOWED_ORIGINS.includes(origin))
    {
      return true;
    }

    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return false;
  }

  /**
   * Verifies JWT auth during websocket upgrade.
   */
  private async authenticateUpgrade(
    request: IncomingMessage,
    socket: UpgradeSocket
  ): Promise<string | null>
  {
    const userId = await parseTokenUserId(request);
    if (userId)
    {
      return userId;
    }

    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return null;
  }

  /**
   * Registers per-socket message and close handlers.
   */
  private onSocketOpen(ws: WebSocket): void
  {
    ws.on("message", (raw) =>
    {
      const meta = this.socketMeta.get(ws);
      if (!meta) return;
      if (meta.closing)
      {
        return;
      }

      if (!this.allowMessageRate(ws, meta))
      {
        return;
      }

      this.handleClientMessage(ws, meta, raw);
    });

    // Absorb protocol-level errors (e.g. maxPayload exceeded); ws closes automatically.
    ws.on("error", () => {});

    ws.on("close", () =>
    {
      onWsConnectionClosed();
      const meta = this.socketMeta.get(ws);
      if (meta)
      {
        for (const tid of meta.tournamentIds)
        {
          this.removeTournamentSub(ws, meta, tid);
        }
      }
      this.socketMeta.delete(ws);
    });
  }

  /**
   * Enforces per-socket websocket message rate limits.
   */
  private allowMessageRate(ws: WebSocket, meta: SocketMeta): boolean
  {
    const now = Date.now();
    if (now - meta.messageWindowStartedAtMs >= WS_MESSAGE_WINDOW_MS)
    {
      meta.messageWindowStartedAtMs = now;
      meta.messageCount = 0;
    }

    meta.messageCount += 1;
    if (meta.messageCount <= WS_MESSAGE_MAX_PER_WINDOW)
    {
      return true;
    }

    meta.closing = true;
    onWsRateLimitTriggered("message");
    ws.close(WS_POLICY_VIOLATION_CODE, WS_REASON_RATE_LIMIT_EXCEEDED);
    return false;
  }

  /**
   * Parses and dispatches websocket client messages.
   */
  private handleClientMessage(ws: WebSocket, meta: SocketMeta, raw: WebSocket.RawData): void
  {
    let msg: ClientMessage;
    try
    {
      msg = JSON.parse(String(raw)) as ClientMessage;
    }
    catch
    {
      return;
    }

    if (msg.type === "subscribe" && typeof msg.tournamentId === "string")
    {
      this.addTournamentSub(ws, meta, msg.tournamentId);
      return;
    }
    if (msg.type === "unsubscribe" && typeof msg.tournamentId === "string")
    {
      this.removeTournamentSub(ws, meta, msg.tournamentId);
    }
  }

  /**
   * Adds a socket subscription for one tournament ID.
   */
  private addTournamentSub(ws: WebSocket, meta: SocketMeta, tournamentId: string): void
  {
    if (meta.tournamentIds.has(tournamentId)) return;
    if (meta.tournamentIds.size >= WS_MAX_SUBSCRIPTIONS_PER_CLIENT)
    {
      meta.closing = true;
      onWsRateLimitTriggered("subscription");
      ws.close(WS_POLICY_VIOLATION_CODE, WS_REASON_MAX_SUBSCRIPTIONS_EXCEEDED);
      return;
    }
    meta.tournamentIds.add(tournamentId);
    let set = this.tournamentSubs.get(tournamentId);
    if (!set)
    {
      set = new Set();
      this.tournamentSubs.set(tournamentId, set);
    }
    set.add(ws);
  }

  /**
   * Removes a socket subscription for one tournament ID.
   */
  private removeTournamentSub(ws: WebSocket, meta: SocketMeta, tournamentId: string): void
  {
    if (!meta.tournamentIds.has(tournamentId)) return;
    meta.tournamentIds.delete(tournamentId);
    const set = this.tournamentSubs.get(tournamentId);
    if (set)
    {
      set.delete(ws);
      if (set.size === 0) this.tournamentSubs.delete(tournamentId);
    }
  }

  /**
   * Sends one server push payload to a websocket if still open.
   */
  private send(ws: WebSocket, payload: ServerPushMessage): void
  {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }

  /**
   * Pushes a tournament-change notification to subscribers of that tournament.
   */
  notifyTournamentChanged(tournamentId: string): void
  {
    const set = this.tournamentSubs.get(tournamentId);
    if (!set) return;
    const payload: ServerPushMessage = {
      type: "tournamentChanged",
      tournamentId,
    };
    for (const ws of set) this.send(ws, payload);
  }

  /**
   * Broadcasts catalog changes to all connected clients.
   */
  notifyCatalogChanged(kinds: Array<"players" | "classes">): void
  {
    if (kinds.length === 0) return;
    const payload: ServerPushMessage = { type: "catalogChanged", kinds };
    for (const ws of this.wss.clients) this.send(ws, payload);
  }

  /**
   * Broadcasts tournament-list changes to all connected clients.
   */
  notifyTournamentsListChanged(): void
  {
    const payload: ServerPushMessage = { type: "tournamentsChanged" };
    for (const ws of this.wss.clients) this.send(ws, payload);
  }
}
