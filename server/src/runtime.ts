import http from "node:http";
import type { Socket } from "node:net";
import { PORT } from "./config.js";
import { createApp } from "./app.js";
import { RealtimeHub } from "./realtime/hub.js";
import { setRealtimeHub } from "./realtime/notify.js";
import { prisma } from "./db.js";

export { inspectDesktopDatabase, snapshotDesktopDatabase, seedDesktopDatabase } from "./desktopData.js";

/** Shared lifecycle for the CLI server and the small desktop prototype. */
export async function startServer(options: { port?: number; host?: string; clientDist?: string; localDesktop?: boolean } = {})
{
  const server = http.createServer(createApp({ clientDist: options.clientDist, localDesktop: options.localDesktop }));
  const sockets = new Set<Socket>();
  server.on("connection", (socket) =>
  {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  const realtimeHub = new RealtimeHub();
  realtimeHub.attachToServer(server);
  setRealtimeHub(realtimeHub);
  let stopping: Promise<void> | undefined;

  const stop = (): Promise<void> =>
  {
    stopping ??= (async () =>
    {
      const httpClosed = new Promise<void>((resolve, reject) =>
      {
        server.close((error) => error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING" ? reject(error) : resolve());
      });
      await realtimeHub.close();
      await httpClosed;
      for (const socket of sockets) socket.destroy();
      setRealtimeHub(null);
      await prisma.$disconnect();
    })();
    return stopping;
  };

  try
  {
    await prisma.$connect();
    await prisma.schoolClass.count();
    await new Promise<void>((resolve, reject) =>
    {
      server.once("error", reject);
      server.listen(options.port ?? PORT, options.host ?? "0.0.0.0", () =>
      {
        server.off("error", reject);
        resolve();
      });
    });
    return { server, stop };
  }
  catch (error)
  {
    await stop();
    throw error;
  }
}
