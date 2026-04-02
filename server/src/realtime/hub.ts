import type { Server } from "node:http";
import type { IncomingMessage } from "node:http";
import jwt from "jsonwebtoken";
import { WebSocketServer, WebSocket } from "ws";
import { JWT_SECRET } from "../config.js";
import type { AuthPayload } from "../middleware/auth.js";

const WS_PATH = "/api/ws";

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
};

function parseTokenUserId(req: IncomingMessage): string | null
{
  const host = req.headers.host ?? "127.0.0.1";
  const url = new URL(req.url ?? "", `http://${host}`);
  const token = url.searchParams.get("token");
  if (!token) return null;
  try
  {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    return decoded.sub;
  }
  catch
  {
    return null;
  }
}

export class RealtimeHub
{
  private readonly wss: WebSocketServer;
  private readonly tournamentSubs = new Map<string, Set<WebSocket>>();
  private readonly socketMeta = new WeakMap<WebSocket, SocketMeta>();

  constructor()
  {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on("connection", (ws: WebSocket) =>
    {
      this.onSocketOpen(ws);
    });
  }

  attachToServer(server: Server): void
  {
    server.on("upgrade", (request, socket, head) =>
    {
      const host = request.headers.host ?? "127.0.0.1";
      const url = new URL(request.url ?? "", `http://${host}`);
      if (url.pathname !== WS_PATH)
      {
        socket.destroy();
        return;
      }
      const userId = parseTokenUserId(request);
      if (!userId)
      {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(request, socket, head, (ws) =>
      {
        this.socketMeta.set(ws, { userId, tournamentIds: new Set() });
        this.wss.emit("connection", ws, request);
      });
    });
  }

  private onSocketOpen(ws: WebSocket): void
  {
    ws.on("message", (raw) =>
    {
      const meta = this.socketMeta.get(ws);
      if (!meta) return;
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
      }
      else if (msg.type === "unsubscribe" && typeof msg.tournamentId === "string")
      {
        this.removeTournamentSub(ws, meta, msg.tournamentId);
      }
    });

    ws.on("close", () =>
    {
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

  private addTournamentSub(ws: WebSocket, meta: SocketMeta, tournamentId: string): void
  {
    if (meta.tournamentIds.has(tournamentId)) return;
    meta.tournamentIds.add(tournamentId);
    let set = this.tournamentSubs.get(tournamentId);
    if (!set)
    {
      set = new Set();
      this.tournamentSubs.set(tournamentId, set);
    }
    set.add(ws);
  }

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

  private send(ws: WebSocket, payload: ServerPushMessage): void
  {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }

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

  /** Broadcast to every connected client (shared catalog / tournament list). */
  notifyCatalogChanged(kinds: Array<"players" | "classes">): void
  {
    if (kinds.length === 0) return;
    const payload: ServerPushMessage = { type: "catalogChanged", kinds };
    for (const ws of this.wss.clients) this.send(ws, payload);
  }

  /** Broadcast to every connected client. */
  notifyTournamentsListChanged(): void
  {
    const payload: ServerPushMessage = { type: "tournamentsChanged" };
    for (const ws of this.wss.clients) this.send(ws, payload);
  }
}
