import http from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../server/src/app.js";
import { signToken } from "../../../server/src/auth/token.js";
import { MemoryEventBus } from "../../../server/src/realtime/eventBus.js";

/**
 * Mock Prisma so SSE token lookups resolve without a real database.
 */
const mockFindUnique = vi.fn().mockImplementation(
  ({ where }: { where: { id: string } }) =>
    Promise.resolve({ id: where.id, tokenVersion: 0 })
);

vi.mock("../../../server/src/db.js", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

type ParsedFrame = {
  event: string;
  data: string;
};

/**
 * Parses SSE frames from accumulated text. Comment frames (lines starting
 * with `:`) are ignored.
 */
function parseSseFrames(text: string): ParsedFrame[]
{
  const frames: ParsedFrame[] = [];
  for (const block of text.split("\n\n"))
  {
    if (!block.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n"))
    {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:"))
      {
        event = line.slice("event:".length).trim();
        continue;
      }
      if (line.startsWith("data:"))
      {
        dataLines.push(line.slice("data:".length).trim());
      }
    }
    if (dataLines.length > 0)
    {
      frames.push({ event, data: dataLines.join("\n") });
    }
  }
  return frames;
}

describe("SSE endpoint /api/sse", () =>
{
  let server: http.Server;
  let baseUrl: string;
  let bus: MemoryEventBus;

  beforeAll(async () =>
  {
    bus = new MemoryEventBus();
    const app = createApp({ eventBus: bus });
    server = http.createServer(app);
    await new Promise<void>((resolve) =>
    {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () =>
  {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  afterEach(() =>
  {
    vi.restoreAllMocks();
    mockFindUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve({ id: where.id, tokenVersion: 0 })
    );
  });

  it("rejects connection without token (400)", async () =>
  {
    const res = await fetch(`${baseUrl}/api/sse`);
    expect(res.status).toBe(400);
    res.body?.cancel().catch(() => {});
  });

  it("rejects token for deleted user (401)", async () =>
  {
    mockFindUnique.mockResolvedValueOnce(null);
    const token = signToken("user-deleted", 0);
    const res = await fetch(`${baseUrl}/api/sse?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(401);
    res.body?.cancel().catch(() => {});
  });

  it("rejects token with mismatched tokenVersion (401)", async () =>
  {
    mockFindUnique.mockResolvedValueOnce({ id: "user-revoked", tokenVersion: 1 });
    const token = signToken("user-revoked", 0);
    const res = await fetch(`${baseUrl}/api/sse?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(401);
    res.body?.cancel().catch(() => {});
  });

  it("streams matching tournamentChanged events to subscribers only", async () =>
  {
    const tokenA = signToken("user-a");
    const controllerA = new AbortController();
    const resA = await fetch(
      `${baseUrl}/api/sse?token=${encodeURIComponent(tokenA)}&tournaments=t1`,
      { signal: controllerA.signal }
    );
    expect(resA.status).toBe(200);
    expect(resA.headers.get("content-type")).toContain("text/event-stream");

    const readerA = resA.body!.getReader();
    const decoder = new TextDecoder();
    let bufferA = "";

    // Wait until the initial ": connected" comment is flushed so the listener
    // is definitely registered before we publish.
    while (!bufferA.includes(": connected"))
    {
      const { value, done } = await readerA.read();
      if (done) break;
      bufferA += decoder.decode(value, { stream: true });
    }

    bus.publish({ type: "tournamentChanged", tournamentId: "t1" });
    bus.publish({ type: "tournamentChanged", tournamentId: "t-other" });
    bus.publish({ type: "catalogChanged", kinds: ["players"] });

    while (!bufferA.includes("catalogChanged"))
    {
      const { value, done } = await readerA.read();
      if (done) break;
      bufferA += decoder.decode(value, { stream: true });
    }

    const frames = parseSseFrames(bufferA);
    const eventNames = frames.map((f) => f.event);
    expect(eventNames).toContain("tournamentChanged");
    expect(eventNames).toContain("catalogChanged");
    // The non-subscribed tournament must not appear for this client.
    const tournamentChangedIds = frames
      .filter((f) => f.event === "tournamentChanged")
      .map((f) => (JSON.parse(f.data) as { tournamentId: string }).tournamentId);
    expect(tournamentChangedIds).toEqual(["t1"]);

    controllerA.abort();
    await readerA.cancel().catch(() => {});
  });

  it("releases the bus subscription when the client disconnects", async () =>
  {
    const localBus = new MemoryEventBus();
    const localApp = createApp({ eventBus: localBus });
    const localServer = http.createServer(localApp);
    await new Promise<void>((resolve) =>
    {
      localServer.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = localServer.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    const url = `http://127.0.0.1:${port}/api/sse?token=${encodeURIComponent(signToken("user-x"))}`;

    const controller = new AbortController();
    const res = await fetch(url, { signal: controller.signal });
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!buffer.includes(": connected"))
    {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    expect(localBus.subscriberCount()).toBe(1);

    controller.abort();
    await reader.cancel().catch(() => {});

    // Allow the close-event handler to run.
    await new Promise((r) => setTimeout(r, 50));
    expect(localBus.subscriberCount()).toBe(0);

    await new Promise<void>((resolve) => localServer.close(() => resolve()));
  });
});
