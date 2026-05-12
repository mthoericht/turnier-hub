import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockWebSocket
{
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string)
  {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(payload: string): void
  {
    this.sent.push(payload);
  }

  close(): void
  {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  open(): void
  {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  message(data: unknown): void
  {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  rawMessage(data: string): void
  {
    this.onmessage?.({ data });
  }
}

async function flushMicrotasks(rounds = 3): Promise<void>
{
  for (let i = 0; i < rounds; i++)
  {
    await Promise.resolve();
  }
}

describe("realtimeClient", () =>
{
  beforeEach(() =>
  {
    vi.useFakeTimers();
    MockWebSocket.instances = [];

    vi.stubGlobal("window", {
      location: {
        protocol: "http:",
        host: "localhost:5173",
      },
    });
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    mod.setRealtimeDispatchForTests(null);
    mod.setRealtimeSessionActive(false);
    mod.disconnectRealtime();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("connects without JWT and flushes queued subscriptions on open", async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    mod.setRealtimeSessionActive(true);
    mod.subscribeTournamentRealtime("t1");
    mod.connectRealtime();

    expect(MockWebSocket.instances).toHaveLength(1);
    const ws = MockWebSocket.instances[0]!;
    expect(ws.url).toBe("ws://localhost:5173/api/ws");
    expect(ws.sent).toEqual([]);

    ws.open();
    expect(ws.sent).toContain(
      JSON.stringify({ type: "subscribe", tournamentId: "t1" })
    );
  });

  it("does not connect when session is inactive", async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    mod.setRealtimeSessionActive(false);
    mod.connectRealtime();
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("does not open duplicate socket while already connecting/open", async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    mod.setRealtimeSessionActive(true);
    mod.connectRealtime();
    expect(MockWebSocket.instances).toHaveLength(1);

    mod.connectRealtime();
    expect(MockWebSocket.instances).toHaveLength(1);

    const ws = MockWebSocket.instances[0]!;
    ws.open();
    mod.connectRealtime();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("sends subscribe/unsubscribe immediately when socket is open", async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    mod.setRealtimeSessionActive(true);
    mod.connectRealtime();
    const ws = MockWebSocket.instances[0]!;
    ws.open();

    mod.subscribeTournamentRealtime("t1");
    mod.unsubscribeTournamentRealtime("t1");

    expect(ws.sent).toContain(
      JSON.stringify({ type: "subscribe", tournamentId: "t1" })
    );
    expect(ws.sent).toContain(
      JSON.stringify({ type: "unsubscribe", tournamentId: "t1" })
    );
  });

  it("forwards valid websocket messages to dispatch hook and ignores malformed/unknown", async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    const dispatchSpy = vi.fn();
    mod.setRealtimeDispatchForTests(dispatchSpy);
    mod.setRealtimeSessionActive(true);
    mod.connectRealtime();
    const ws = MockWebSocket.instances[0]!;
    ws.open();

    ws.message({ type: "tournamentChanged", tournamentId: "t-1" });
    ws.message({ type: "catalogChanged", kinds: ["players", "classes"] });
    ws.message({ type: "tournamentsChanged" });
    ws.message({ type: "unknown" });
    ws.rawMessage("{not-json}");
    await flushMicrotasks(8);

    expect(dispatchSpy).toHaveBeenCalledTimes(3);
    expect(dispatchSpy).toHaveBeenNthCalledWith(
      1,
      { type: "tournamentChanged", tournamentId: "t-1" }
    );
    expect(dispatchSpy).toHaveBeenNthCalledWith(
      2,
      { type: "catalogChanged", kinds: ["players", "classes"] }
    );
    expect(dispatchSpy).toHaveBeenNthCalledWith(
      3,
      { type: "tournamentsChanged" }
    );
  });

  it("disconnect clears subscriptions and closes active socket", async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    mod.setRealtimeSessionActive(true);
    mod.subscribeTournamentRealtime("t1");
    mod.connectRealtime();
    const ws = MockWebSocket.instances[0]!;
    ws.open();
    expect(ws.sent).toContain(
      JSON.stringify({ type: "subscribe", tournamentId: "t1" })
    );

    mod.disconnectRealtime();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);

    const previousCount = MockWebSocket.instances.length;
    mod.setRealtimeSessionActive(true);
    mod.connectRealtime();
    const next = MockWebSocket.instances[MockWebSocket.instances.length - 1]!;
    next.open();
    expect(MockWebSocket.instances.length).toBe(previousCount + 1);
    expect(next.sent).not.toContain(
      JSON.stringify({ type: "subscribe", tournamentId: "t1" })
    );
  });
});
