import { describe, expect, it, vi } from "vitest";
import {
  eventMatchesSubscription,
  MemoryEventBus,
  type RealtimeEvent,
} from "../../../server/src/realtime/eventBus.js";

describe("eventMatchesSubscription", () =>
{
  it("delivers tournamentChanged only to subscribers of that tournament", () =>
  {
    const subs = new Set(["t1"]);
    expect(eventMatchesSubscription(
      { type: "tournamentChanged", tournamentId: "t1" },
      subs
    )).toBe(true);
    expect(eventMatchesSubscription(
      { type: "tournamentChanged", tournamentId: "t2" },
      subs
    )).toBe(false);
  });

  it("broadcasts catalogChanged to every subscriber", () =>
  {
    expect(eventMatchesSubscription(
      { type: "catalogChanged", kinds: ["players"] },
      new Set()
    )).toBe(true);
    expect(eventMatchesSubscription(
      { type: "catalogChanged", kinds: ["classes"] },
      new Set(["t1"])
    )).toBe(true);
  });

  it("broadcasts tournamentsChanged to every subscriber", () =>
  {
    expect(eventMatchesSubscription(
      { type: "tournamentsChanged" },
      new Set()
    )).toBe(true);
  });
});

describe("MemoryEventBus", () =>
{
  it("delivers tournamentChanged only to matching subscribers", () =>
  {
    const bus = new MemoryEventBus();
    const a: RealtimeEvent[] = [];
    const b: RealtimeEvent[] = [];

    bus.subscribe({ tournamentIds: new Set(["t1"]) }, (ev) => a.push(ev));
    bus.subscribe({ tournamentIds: new Set(["t2"]) }, (ev) => b.push(ev));

    bus.publish({ type: "tournamentChanged", tournamentId: "t1" });

    expect(a).toEqual([{ type: "tournamentChanged", tournamentId: "t1" }]);
    expect(b).toEqual([]);
  });

  it("broadcasts catalogChanged and tournamentsChanged to all subscribers", () =>
  {
    const bus = new MemoryEventBus();
    const a: RealtimeEvent[] = [];
    const b: RealtimeEvent[] = [];

    bus.subscribe({ tournamentIds: new Set() }, (ev) => a.push(ev));
    bus.subscribe({ tournamentIds: new Set(["t9"]) }, (ev) => b.push(ev));

    bus.publish({ type: "catalogChanged", kinds: ["players"] });
    bus.publish({ type: "tournamentsChanged" });

    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
  });

  it("stops delivering events after unsubscribe", () =>
  {
    const bus = new MemoryEventBus();
    const received: RealtimeEvent[] = [];
    const unsubscribe = bus.subscribe(
      { tournamentIds: new Set(["t1"]) },
      (ev) => received.push(ev)
    );

    bus.publish({ type: "tournamentChanged", tournamentId: "t1" });
    expect(received).toHaveLength(1);

    unsubscribe();
    bus.publish({ type: "tournamentChanged", tournamentId: "t1" });
    bus.publish({ type: "catalogChanged", kinds: ["players"] });

    expect(received).toHaveLength(1);
    expect(bus.subscriberCount()).toBe(0);
  });

  it("isolates listener errors from other listeners", () =>
  {
    const bus = new MemoryEventBus();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const a: RealtimeEvent[] = [];
    const b: RealtimeEvent[] = [];

    bus.subscribe({ tournamentIds: new Set() }, () =>
    {
      throw new Error("boom");
    });
    bus.subscribe({ tournamentIds: new Set() }, (ev) => a.push(ev));
    bus.subscribe({ tournamentIds: new Set() }, (ev) => b.push(ev));

    bus.publish({ type: "tournamentsChanged" });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    errorSpy.mockRestore();
  });
});
