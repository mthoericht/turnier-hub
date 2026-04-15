import http from "node:http";
import { PORT } from "./config.js";
import { createApp } from "./app.js";
import { RealtimeHub } from "./realtime/hub.js";
import { setRealtimeHub } from "./realtime/notify.js";
import { ensureDefaultSchool } from "./lib/schools.js";

const app = createApp();
const server = http.createServer(app);
const realtimeHub = new RealtimeHub();
realtimeHub.attachToServer(server);
setRealtimeHub(realtimeHub);

async function startServer(): Promise<void>
{
  await ensureDefaultSchool();

  server.listen(PORT, () =>
  {
    console.log(`API & static: http://localhost:${PORT}`);
  });
}

startServer().catch((error) =>
{
  console.error("Failed to initialize server startup tasks", error);
  process.exit(1);
});
