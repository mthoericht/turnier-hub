/* eslint-disable no-console */

import process from "node:process";

type ProbeOptions = {
  baseUrl: string;
  email: string;
  password: string;
  connections: number;
  durationSec: number;
  rampUpMs: number;
  tournaments: string;
  publishUrl?: string;
  publishMethod: "POST" | "PATCH";
  publishBody?: string;
  publishIntervalMs: number;
};

type ConnectionStats = {
  connected: boolean;
  bytes: number;
  eventFrames: number;
  heartbeatFrames: number;
  errors: number;
};

function readInt(name: string, fallback: number): number
{
  const raw = process.env[name];
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readString(name: string, fallback: string): string
{
  const raw = process.env[name]?.trim();
  return raw && raw.length > 0 ? raw : fallback;
}

function loadOptions(): ProbeOptions
{
  const publishMethodRaw = readString("PERF_SSE_PUBLISH_METHOD", "POST").toUpperCase();

  return {
    baseUrl: readString("PERF_BASE_URL", "http://localhost:3001"),
    email: readString("PERF_LOGIN_EMAIL", "seed@turnier-hub.local"),
    password: readString("PERF_LOGIN_PASSWORD", "seedseed12"),
    connections: readInt("PERF_SSE_CONNECTIONS", 100),
    durationSec: readInt("PERF_SSE_DURATION_SEC", 120),
    rampUpMs: readInt("PERF_SSE_RAMP_UP_MS", 10),
    tournaments: readString("PERF_SSE_TOURNAMENTS", ""),
    publishUrl: process.env.PERF_SSE_PUBLISH_URL?.trim() || undefined,
    publishMethod: publishMethodRaw === "PATCH" ? "PATCH" : "POST",
    publishBody: process.env.PERF_SSE_PUBLISH_BODY,
    publishIntervalMs: readInt("PERF_SSE_PUBLISH_INTERVAL_MS", 1_000),
  };
}

async function login(baseUrl: string, email: string, password: string): Promise<string>
{
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok)
  {
    const body = await response.text();
    throw new Error(`Login failed (${response.status}): ${body}`);
  }

  const payload = await response.json() as { token?: string };
  if (!payload.token)
  {
    throw new Error("Login response did not contain token");
  }
  return payload.token;
}

function buildSseUrl(options: ProbeOptions, token: string): string
{
  const url = new URL(`${options.baseUrl}/api/sse`);
  url.searchParams.set("token", token);
  if (options.tournaments)
  {
    url.searchParams.set("tournaments", options.tournaments);
  }
  return url.toString();
}

async function openConnection(
  index: number,
  sseUrl: string,
  controller: AbortController,
  stats: ConnectionStats,
): Promise<void>
{
  try
  {
    const response = await fetch(sseUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "text/event-stream",
      },
    });

    if (!response.ok || !response.body)
    {
      stats.errors += 1;
      return;
    }

    stats.connected = true;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (!controller.signal.aborted)
    {
      const { done, value } = await reader.read();
      if (done)
      {
        break;
      }
      if (!value)
      {
        continue;
      }

      stats.bytes += value.byteLength;
      const chunk = decoder.decode(value, { stream: true });

      const heartbeatMatches = chunk.match(/: heartbeat/g);
      if (heartbeatMatches)
      {
        stats.heartbeatFrames += heartbeatMatches.length;
      }

      const eventMatches = chunk.match(/\nevent: /g);
      if (eventMatches)
      {
        stats.eventFrames += eventMatches.length;
      }
      else if (chunk.startsWith("event: "))
      {
        stats.eventFrames += 1;
      }
    }
  }
  catch (error)
  {
    if (!controller.signal.aborted)
    {
      stats.errors += 1;
      console.error(`[conn ${index}]`, error);
    }
  }
}

function sleep(ms: number): Promise<void>
{
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startPublisher(options: ProbeOptions, token: string, stopAtMs: number): Promise<void>
{
  if (!options.publishUrl)
  {
    return;
  }

  while (Date.now() < stopAtMs)
  {
    try
    {
      await fetch(`${options.baseUrl}${options.publishUrl}`, {
        method: options.publishMethod,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: options.publishBody,
      });
    }
    catch
    {
      // best effort for synthetic publish load.
    }

    await sleep(options.publishIntervalMs);
  }
}

function printSummary(options: ProbeOptions, stats: ConnectionStats[]): void
{
  const connected = stats.filter((s) => s.connected).length;
  const errors = stats.reduce((acc, s) => acc + s.errors, 0);
  const totalBytes = stats.reduce((acc, s) => acc + s.bytes, 0);
  const totalEvents = stats.reduce((acc, s) => acc + s.eventFrames, 0);
  const totalHeartbeats = stats.reduce((acc, s) => acc + s.heartbeatFrames, 0);

  console.log("\n=== SSE Capacity Probe Summary ===");
  console.log(`connections_target=${options.connections}`);
  console.log(`connections_connected=${connected}`);
  console.log(`duration_sec=${options.durationSec}`);
  console.log(`events_total=${totalEvents}`);
  console.log(`heartbeats_total=${totalHeartbeats}`);
  console.log(`bytes_total=${totalBytes}`);
  console.log(`connection_errors=${errors}`);
  console.log("\nNext step: inspect CloudWatch metrics for DynamoDB table consumption:");
  console.log("- AWS/DynamoDB: ConsumedReadCapacityUnits + ConsumedWriteCapacityUnits");
  console.log("- Compare on-demand bill estimate vs provisioned target (1x/s polling * subscribers).");
}

async function main(): Promise<void>
{
  const options = loadOptions();
  console.log("Starting SSE capacity probe with options:", options);

  const token = await login(options.baseUrl, options.email, options.password);
  const sseUrl = buildSseUrl(options, token);

  const stats: ConnectionStats[] = Array.from({ length: options.connections }).map(() => ({
    connected: false,
    bytes: 0,
    eventFrames: 0,
    heartbeatFrames: 0,
    errors: 0,
  }));

  const controllers: AbortController[] = [];
  const workers: Array<Promise<void>> = [];

  for (let i = 0; i < options.connections; i += 1)
  {
    const controller = new AbortController();
    controllers.push(controller);
    workers.push(openConnection(i, sseUrl, controller, stats[i]!));
    if (options.rampUpMs > 0)
    {
      await sleep(options.rampUpMs);
    }
  }

  const stopAtMs = Date.now() + options.durationSec * 1_000;
  const publisher = startPublisher(options, token, stopAtMs);

  await sleep(options.durationSec * 1_000);
  for (const controller of controllers)
  {
    controller.abort();
  }

  await Promise.allSettled(workers);
  await publisher;

  printSummary(options, stats);
}

main().catch((error) =>
{
  console.error("SSE capacity probe failed", error);
  process.exitCode = 1;
});
