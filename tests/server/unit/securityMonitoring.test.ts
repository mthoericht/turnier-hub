import { afterEach, describe, expect, it, vi } from "vitest";
import {
  onWsConnectionClosed,
  onWsConnectionOpened,
  onWsRateLimitTriggered,
  recordHttpSecurityStatus,
  resetSecurityMonitoringForTests,
} from "../../../server/src/security/monitoring.js";

function parseWarnPayload(spy: ReturnType<typeof vi.spyOn>, callIndex = 0): Record<string, unknown>
{
  const arg = spy.mock.calls[callIndex]?.[0];
  expect(typeof arg).toBe("string");
  return JSON.parse(String(arg)) as Record<string, unknown>;
}

function getWarnPayloads(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown>[]
{
  return spy.mock.calls.flatMap((call) =>
  {
    const [arg] = call;
    if (typeof arg !== "string")
    {
      return [];
    }

    try
    {
      return [JSON.parse(arg) as Record<string, unknown>];
    }
    catch
    {
      return [];
    }
  });
}

describe("security monitoring helpers", () =>
{
  afterEach(() =>
  {
    resetSecurityMonitoringForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("emits HTTP spike event exactly at configured threshold", async () =>
  {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    recordHttpSecurityStatus(401, { windowMs: 60_000, thresholdPerWindow: 2 });
    expect(warnSpy).not.toHaveBeenCalled();

    recordHttpSecurityStatus(401, { windowMs: 60_000, thresholdPerWindow: 2 });
    expect(warnSpy).toHaveBeenCalledTimes(1);

    recordHttpSecurityStatus(401, { windowMs: 60_000, thresholdPerWindow: 2 });
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const payload = parseWarnPayload(warnSpy);
    expect(payload.type).toBe("http_auth_status_spike");
    expect(payload.category).toBe("security");
    expect(payload.level).toBe("warn");
  });

  it("ignores non-tracked HTTP status codes", () =>
  {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    recordHttpSecurityStatus(200, { windowMs: 60_000, thresholdPerWindow: 1 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("emits websocket connection spike and resets after window rollover", () =>
  {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    onWsConnectionOpened({ windowMs: 10_000, thresholdPeakConnections: 2 });
    expect(warnSpy).not.toHaveBeenCalled();

    onWsConnectionOpened({ windowMs: 10_000, thresholdPeakConnections: 2 });
    const firstWindowSpikes = getWarnPayloads(warnSpy)
      .filter((payload) => payload.type === "ws_connections_spike");
    expect(firstWindowSpikes).toHaveLength(1);

    onWsConnectionClosed();
    onWsConnectionClosed();
    vi.setSystemTime(new Date("2026-01-01T00:00:11.000Z"));
    onWsConnectionOpened({ windowMs: 10_000, thresholdPeakConnections: 2 });

    onWsConnectionOpened({ windowMs: 10_000, thresholdPeakConnections: 2 });
    const allWindowSpikes = getWarnPayloads(warnSpy)
      .filter((payload) => payload.type === "ws_connections_spike");
    expect(allWindowSpikes.length).toBeGreaterThanOrEqual(2);

    const payload = allWindowSpikes[1];
    expect(payload).toBeTruthy();
    expect(payload.type).toBe("ws_connections_spike");
  });

  it("keeps websocket connection count non-negative on repeated closes", () =>
  {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    onWsConnectionClosed();
    onWsConnectionClosed();
    onWsConnectionOpened({ windowMs: 60_000, thresholdPeakConnections: 1 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("emits websocket rate-limit trigger payload with reason", () =>
  {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    onWsRateLimitTriggered("message");
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const payload = parseWarnPayload(warnSpy);
    expect(payload.type).toBe("ws_rate_limit_triggered");
    expect(payload.details).toEqual({ reason: "message" });
  });
});
