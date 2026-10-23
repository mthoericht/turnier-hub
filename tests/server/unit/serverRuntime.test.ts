import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { once } from "node:events";
import WebSocket from "ws";
import { startServer } from "../../../server/src/runtime.js";

const disconnect = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("../../../server/src/db.js", () => ({ prisma: {
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: disconnect,
  schoolClass: { count: vi.fn().mockResolvedValue(0) },
} }));

describe("shared server lifecycle", () =>
{
  afterEach(() => vi.clearAllMocks());

  it("stops upgraded sockets, releases HTTP and disconnects Prisma exactly once", async () =>
  {
    const runtime = await startServer({ port: 0, host: "127.0.0.1", localDesktop: true });
    const address = runtime.server.address();
    if (!address || typeof address === "string") throw new Error("Expected listening server");
    const base = `http://127.0.0.1:${address.port}`;
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/ws`);
    try
    {
      await once(socket, "open");
      const closed = once(socket, "close");
      await Promise.all([runtime.stop(), runtime.stop()]);
      await closed;
      expect(runtime.server.listening).toBe(false);
      expect(disconnect).toHaveBeenCalledTimes(1);
      await expect(fetch(base)).rejects.toThrow();
    }
    finally
    {
      socket.terminate();
      await runtime.stop();
    }
  });

  it("reports occupied port and cleans up the failed startup", async () =>
  {
    const occupied = http.createServer();
    await new Promise<void>((resolve) => occupied.listen(0, "127.0.0.1", resolve));
    const address = occupied.address();
    if (!address || typeof address === "string") throw new Error("Expected occupied port");
    try
    {
      await expect(startServer({ port: address.port, host: "127.0.0.1" })).rejects.toMatchObject({ code: "EADDRINUSE" });
      expect(disconnect).toHaveBeenCalledTimes(1);
    }
    finally
    {
      await new Promise<void>((resolve) => occupied.close(() => resolve()));
    }
  });
});
