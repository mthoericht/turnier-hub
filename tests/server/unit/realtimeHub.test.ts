import http from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { createApp } from "../../../server/src/app.js";
import { RealtimeHub } from "../../../server/src/realtime/hub.js";
import {
  WS_CONNECT_MAX_PER_IP,
  WS_MAX_PAYLOAD_BYTES,
  WS_MAX_SUBSCRIPTIONS_PER_CLIENT,
  WS_MESSAGE_MAX_PER_WINDOW,
} from "../../../server/src/config.js";

type Push =
  | { type: "tournamentChanged"; tournamentId: string }
  | { type: "catalogChanged"; kinds: Array<"players" | "classes"> }
  | { type: "tournamentsChanged" };

function waitForOpen(ws: WebSocket): Promise<void>
{
  return new Promise((resolve, reject) =>
  {
    ws.on("open", () => resolve());
    ws.on("error", (e) => reject(e));
  });
}

function sleep(ms: number): Promise<void>
{
  return new Promise((r) => setTimeout(r, ms));
}

function waitForClose(ws: WebSocket): Promise<void>
{
  return new Promise((resolve) =>
  {
    ws.on("close", () => resolve());
  });
}

function connectExpectStatus(
  url: string,
  expectedStatus: number,
  options?: WebSocket.ClientOptions
): Promise<http.IncomingMessage>
{
  return new Promise((resolve) =>
  {
    const ws = new WebSocket(url, options);
    ws.on("unexpected-response", (_req, res) =>
    {
      expect(res.statusCode).toBe(expectedStatus);
      resolve(res);
    });
    ws.on("error", () =>
    {
      resolve(undefined as unknown as http.IncomingMessage);
    });
    ws.on("close", () =>
    {
      resolve(undefined as unknown as http.IncomingMessage);
    });
  });
}

function connectExpect401(url: string, options?: WebSocket.ClientOptions): Promise<void>
{
  return connectExpectStatus(url, 401, options).then(() => {});
}

function waitForMessage<T>(ws: WebSocket): Promise<T>
{
  return new Promise((resolve, reject) =>
  {
    ws.on("message", (raw) =>
    {
      try
      {
        resolve(JSON.parse(String(raw)) as T);
      }
      catch (e)
      {
        reject(e);
      }
    });
    ws.on("error", (e) => reject(e));
  });
}

function wsHeaders(remoteUser: string, extra?: Record<string, string>): WebSocket.ClientOptions
{
  return { headers: { "Remote-User": remoteUser, ...extra } };
}

describe("RealtimeHub (WebSocket)", () =>
{
  afterEach(() =>
  {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  let server: http.Server;
  let hub: RealtimeHub;
  let baseUrl: string;

  beforeAll(async () =>
  {
    const app = createApp();
    server = http.createServer(app);
    hub = new RealtimeHub();
    hub.attachToServer(server);

    await new Promise<void>((resolve) =>
    {
      server.listen(0, () => resolve());
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    baseUrl = `ws://127.0.0.1:${port}/api/ws`;
  });

  afterAll(async () =>
  {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("rejects missing Remote-User with 401", async () =>
  {
    // Isolate from shell / host env: dotenv-cli does not override existing DEV_REMOTE_USER.
    vi.stubEnv("DEV_REMOTE_USER", "");
    await connectExpect401(baseUrl);
  });

  it("pushes tournamentChanged only to subscribed clients", async () =>
  {
    const wsA = new WebSocket(baseUrl, wsHeaders("user-a"));
    await waitForOpen(wsA);

    const wsB = new WebSocket(baseUrl, wsHeaders("user-b"));
    await waitForOpen(wsB);
    wsB.on("error", () => {});

    wsA.send(JSON.stringify({ type: "subscribe", tournamentId: "t1" }));
    wsB.send(JSON.stringify({ type: "subscribe", tournamentId: "t2" }));
    await sleep(10);

    hub.notifyTournamentChanged("t1");
    const msgA = await waitForMessage<Push>(wsA);
    expect(msgA).toEqual({ type: "tournamentChanged", tournamentId: "t1" });

    let bReceived = false;
    wsB.on("message", () => (bReceived = true));
    await new Promise((r) => setTimeout(r, 30));
    expect(bReceived).toBe(false);

    wsA.close();
    wsB.close();
    await Promise.all([waitForClose(wsA), waitForClose(wsB)]);
  });

  it("does not push after unsubscribe from tournament", async () =>
  {
    const ws = new WebSocket(baseUrl, wsHeaders("user-a"));
    await waitForOpen(ws);

    ws.send(JSON.stringify({ type: "subscribe", tournamentId: "t1" }));
    await sleep(10);
    ws.send(JSON.stringify({ type: "unsubscribe", tournamentId: "t1" }));
    await sleep(10);

    let received = false;
    ws.on("message", () => (received = true));
    hub.notifyTournamentChanged("t1");
    await sleep(30);
    expect(received).toBe(false);

    ws.close();
    await waitForClose(ws);
  });

  it("ignores malformed client messages without closing socket", async () =>
  {
    const ws = new WebSocket(baseUrl, wsHeaders("user-a"));
    await waitForOpen(ws);

    ws.send("{broken-json");
    ws.send(JSON.stringify({ type: "subscribe", tournamentId: "t1" }));
    await sleep(10);

    hub.notifyTournamentChanged("t1");
    const msg = await waitForMessage<Push>(ws);
    expect(msg).toEqual({ type: "tournamentChanged", tournamentId: "t1" });

    ws.close();
    await waitForClose(ws);
  });

  it("closes socket when max subscriptions per client is exceeded", async () =>
  {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const ws = new WebSocket(baseUrl, wsHeaders("user-limit-subs"));
    await waitForOpen(ws);

    for (let i = 0; i < WS_MAX_SUBSCRIPTIONS_PER_CLIENT; i += 1)
    {
      ws.send(JSON.stringify({ type: "subscribe", tournamentId: `t-${i}` }));
    }
    await sleep(10);

    ws.send(JSON.stringify({ type: "subscribe", tournamentId: "t-overflow" }));
    await waitForClose(ws);
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });

  it("closes socket when message rate limit is exceeded", async () =>
  {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const ws = new WebSocket(baseUrl, wsHeaders("user-msg-limit"));
    await waitForOpen(ws);

    for (let i = 0; i <= WS_MESSAGE_MAX_PER_WINDOW; i += 1)
    {
      ws.send(JSON.stringify({ type: "noop", idx: i }));
    }

    await waitForClose(ws);
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });

  it("pushes catalogChanged to all connected clients", async () =>
  {
    const wsA1 = new WebSocket(baseUrl, wsHeaders("user-a"));
    const wsA2 = new WebSocket(baseUrl, wsHeaders("user-a"));
    await Promise.all([waitForOpen(wsA1), waitForOpen(wsA2)]);

    const wsB = new WebSocket(baseUrl, wsHeaders("user-b"));
    await waitForOpen(wsB);

    hub.notifyCatalogChanged(["players"]);

    const [m1, m2, m3] = await Promise.all([
      waitForMessage<Push>(wsA1),
      waitForMessage<Push>(wsA2),
      waitForMessage<Push>(wsB),
    ]);
    expect(m1).toEqual({ type: "catalogChanged", kinds: ["players"] });
    expect(m2).toEqual({ type: "catalogChanged", kinds: ["players"] });
    expect(m3).toEqual({ type: "catalogChanged", kinds: ["players"] });

    wsA1.close();
    wsA2.close();
    wsB.close();
    await Promise.all([waitForClose(wsA1), waitForClose(wsA2), waitForClose(wsB)]);
  });

  it("pushes tournamentsChanged to all connected clients", async () =>
  {
    const wsA = new WebSocket(baseUrl, wsHeaders("user-a"));
    await waitForOpen(wsA);

    const wsB = new WebSocket(baseUrl, wsHeaders("user-b"));
    await waitForOpen(wsB);

    hub.notifyTournamentsListChanged();
    const [msgA, msgB] = await Promise.all([
      waitForMessage<Push>(wsA),
      waitForMessage<Push>(wsB),
    ]);
    expect(msgA).toEqual({ type: "tournamentsChanged" });
    expect(msgB).toEqual({ type: "tournamentsChanged" });

    wsA.close();
    wsB.close();
    await Promise.all([waitForClose(wsA), waitForClose(wsB)]);
  });

  it("rejects upgrade with disallowed Origin header (403)", async () =>
  {
    await connectExpectStatus(baseUrl, 403, {
      headers: {
        "Remote-User": "user-a",
        Origin: "https://evil.example.com",
      },
    });
  });

  it("disconnects client that sends oversized payload", async () =>
  {
    const ws = new WebSocket(baseUrl, {
      ...wsHeaders("user-big"),
      maxPayload: WS_MAX_PAYLOAD_BYTES * 10,
    });
    await waitForOpen(ws);
    ws.on("error", () => {});

    const oversized = Buffer.alloc(WS_MAX_PAYLOAD_BYTES + 1, 0x41);
    ws.send(oversized);

    await waitForClose(ws);
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });
});

describe("RealtimeHub connect rate limit", () =>
{
  afterEach(() =>
  {
    vi.restoreAllMocks();
  });

  it("returns 429 with Retry-After when connect rate limit is exceeded", async () =>
  {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const app = createApp();
    const srv = http.createServer(app);
    const hub = new RealtimeHub();
    hub.attachToServer(srv);
    await new Promise<void>((resolve) => srv.listen(0, () => resolve()));
    const addr = srv.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    const url = `ws://127.0.0.1:${port}/api/ws`;

    const sockets: WebSocket[] = [];
    for (let i = 0; i < WS_CONNECT_MAX_PER_IP; i += 1)
    {
      const ws = new WebSocket(url, wsHeaders("user-rate"));
      await waitForOpen(ws);
      sockets.push(ws);
    }

    const res = await connectExpectStatus(url, 429, wsHeaders("user-rate"));
    expect(res).toBeTruthy();
    expect(Number(res.headers["retry-after"])).toBeGreaterThanOrEqual(1);

    for (const ws of sockets) ws.close();
    await Promise.all(sockets.map(waitForClose));
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  });
});
