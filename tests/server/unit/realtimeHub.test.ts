import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApp } from "../../../server/src/app.js";
import { RealtimeHub } from "../../../server/src/realtime/hub.js";
import { signToken } from "../../../server/src/middleware/auth.js";

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

function connectExpect401(url: string): Promise<void>
{
  return new Promise((resolve) =>
  {
    const ws = new WebSocket(url);
    // `ws` throws an error for non-101 responses; avoid unhandled rejection.
    ws.on("unexpected-response", (_req, res) =>
    {
      expect(res.statusCode).toBe(401);
      resolve();
    });
    ws.on("error", () =>
    {
      // Some versions only emit `error` with "Unexpected server response: 401".
      resolve();
    });
    ws.on("close", () => resolve());
  });
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

describe("RealtimeHub (WebSocket)", () =>
{
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

  it("rejects missing token with 401", async () =>
  {
    await connectExpect401(baseUrl);
  });

  it("pushes tournamentChanged only to subscribed clients", async () =>
  {
    const tokenA = signToken("user-a");
    const wsA = new WebSocket(`${baseUrl}?token=${encodeURIComponent(tokenA)}`);
    await waitForOpen(wsA);

    const tokenB = signToken("user-b");
    const wsB = new WebSocket(`${baseUrl}?token=${encodeURIComponent(tokenB)}`);
    await waitForOpen(wsB);
    wsB.on("error", () => {});

    wsA.send(JSON.stringify({ type: "subscribe", tournamentId: "t1" }));
    wsB.send(JSON.stringify({ type: "subscribe", tournamentId: "t2" }));
    // Give the server a tick to process subscribe messages.
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
    const token = signToken("user-a");
    const ws = new WebSocket(`${baseUrl}?token=${encodeURIComponent(token)}`);
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
    const token = signToken("user-a");
    const ws = new WebSocket(`${baseUrl}?token=${encodeURIComponent(token)}`);
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

  it("pushes catalogChanged to all connected clients", async () =>
  {
    const tokenA = signToken("user-a");
    const wsA1 = new WebSocket(`${baseUrl}?token=${encodeURIComponent(tokenA)}`);
    const wsA2 = new WebSocket(`${baseUrl}?token=${encodeURIComponent(tokenA)}`);
    await Promise.all([waitForOpen(wsA1), waitForOpen(wsA2)]);

    const tokenB = signToken("user-b");
    const wsB = new WebSocket(`${baseUrl}?token=${encodeURIComponent(tokenB)}`);
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
    const tokenA = signToken("user-a");
    const wsA = new WebSocket(`${baseUrl}?token=${encodeURIComponent(tokenA)}`);
    await waitForOpen(wsA);

    const tokenB = signToken("user-b");
    const wsB = new WebSocket(`${baseUrl}?token=${encodeURIComponent(tokenB)}`);
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
});

