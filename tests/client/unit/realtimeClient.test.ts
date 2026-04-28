import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getTokenMock = vi.fn<() => string | null>();

vi.mock("../../../client/src/api/http", () => ({
  getToken: getTokenMock,
}));

class MockEventSource
{
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: MockEventSource[] = [];

  readonly url: string;
  readyState = MockEventSource.CONNECTING;
  onerror: ((ev: unknown) => void) | null = null;
  private readonly listeners = new Map<string, Array<(ev: { data: string }) => void>>();

  constructor(url: string)
  {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(name: string, handler: (ev: { data: string }) => void): void
  {
    const list = this.listeners.get(name) ?? [];
    list.push(handler);
    this.listeners.set(name, list);
  }

  close(): void
  {
    this.readyState = MockEventSource.CLOSED;
  }

  emit(name: string, data: unknown): void
  {
    const handlers = this.listeners.get(name) ?? [];
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    for (const handler of handlers)
    {
      handler({ data: payload });
    }
  }

  open(): void
  {
    this.readyState = MockEventSource.OPEN;
  }
}

async function flushMicrotasks(rounds = 5): Promise<void>
{
  for (let i = 0; i < rounds; i++)
  {
    await Promise.resolve();
  }
}

describe("realtimeClient (SSE)", () =>
{
  beforeEach(() =>
  {
    MockEventSource.instances = [];
    getTokenMock.mockReset();
    getTokenMock.mockReturnValue("token-123");

    vi.stubGlobal("window", {
      location: {
        protocol: "http:",
        host: "localhost:5173",
      },
    });
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    mod.setRealtimeDispatchForTests(null);
    mod.disconnectRealtime();
    vi.unstubAllGlobals();
  });

  it("opens an EventSource with the current token on connect", async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    mod.connectRealtime();

    expect(MockEventSource.instances).toHaveLength(1);
    const es = MockEventSource.instances[0]!;
    expect(es.url).toContain("/api/sse?");
    expect(es.url).toContain("token=token-123");
    expect(es.url).not.toContain("tournaments=");
  });

  it("does not connect when token is missing", async () =>
  {
    getTokenMock.mockReturnValue(null);
    const mod = await import("../../../client/src/realtime/realtimeClient");
    mod.connectRealtime();
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("does not open a duplicate EventSource while one is open", async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    mod.connectRealtime();
    expect(MockEventSource.instances).toHaveLength(1);

    const es = MockEventSource.instances[0]!;
    es.open();

    mod.connectRealtime();
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("includes pre-connect subscriptions in the SSE URL on connect", async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    mod.subscribeTournamentRealtime("t1");
    mod.subscribeTournamentRealtime("t2");
    mod.connectRealtime();

    const es = MockEventSource.instances[0]!;
    expect(es.url).toContain("tournaments=");
    const params = new URL(es.url).searchParams.get("tournaments")!;
    expect(params.split(",").sort()).toEqual(["t1", "t2"]);
  });

  it("reopens the EventSource when subscriptions change after connect", async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    mod.connectRealtime();
    const first = MockEventSource.instances[0]!;
    first.open();

    mod.subscribeTournamentRealtime("t1");
    await flushMicrotasks();

    expect(MockEventSource.instances).toHaveLength(2);
    expect(first.readyState).toBe(MockEventSource.CLOSED);
    const next = MockEventSource.instances[1]!;
    expect(next.url).toContain("tournaments=t1");
  });

  it("coalesces rapid subscribe/unsubscribe into a single reconnect", async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    mod.connectRealtime();
    MockEventSource.instances[0]!.open();

    mod.subscribeTournamentRealtime("t1");
    mod.subscribeTournamentRealtime("t2");
    mod.unsubscribeTournamentRealtime("t1");
    await flushMicrotasks();

    expect(MockEventSource.instances).toHaveLength(2);
    const next = MockEventSource.instances[1]!;
    expect(next.url).toContain("tournaments=t2");
    expect(next.url).not.toContain("t1");
  });

  it("forwards typed SSE events to the dispatch hook", async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    const dispatchSpy = vi.fn();
    mod.setRealtimeDispatchForTests(dispatchSpy);
    mod.connectRealtime();
    const es = MockEventSource.instances[0]!;
    es.open();

    es.emit("tournamentChanged", { type: "tournamentChanged", tournamentId: "t-1" });
    es.emit("catalogChanged", { type: "catalogChanged", kinds: ["players", "classes"] });
    es.emit("tournamentsChanged", { type: "tournamentsChanged" });
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

  it("ignores malformed SSE payloads without crashing", async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    const dispatchSpy = vi.fn();
    mod.setRealtimeDispatchForTests(dispatchSpy);
    mod.connectRealtime();
    const es = MockEventSource.instances[0]!;
    es.open();

    es.emit("tournamentChanged", "{not-json");
    es.emit("tournamentChanged", { type: "tournamentChanged", tournamentId: "t-2" });
    await flushMicrotasks(5);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: "tournamentChanged",
      tournamentId: "t-2",
    });
  });

  it("disconnect clears subscriptions and closes the active stream", async () =>
  {
    const mod = await import("../../../client/src/realtime/realtimeClient");
    mod.subscribeTournamentRealtime("t1");
    mod.connectRealtime();
    const first = MockEventSource.instances[0]!;
    first.open();
    expect(first.url).toContain("tournaments=t1");

    mod.disconnectRealtime();
    expect(first.readyState).toBe(MockEventSource.CLOSED);

    mod.connectRealtime();
    const next = MockEventSource.instances[MockEventSource.instances.length - 1]!;
    expect(MockEventSource.instances).toHaveLength(2);
    expect(next.url).not.toContain("tournaments=");
  });
});
