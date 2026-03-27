import http from "node:http";
import { PORT } from "./config.js";
import { createApp } from "./app.js";
import { RealtimeHub } from "./realtime/hub.js";
import { setRealtimeHub } from "./realtime/notify.js";

const app = createApp();
const server = http.createServer(app);
const realtimeHub = new RealtimeHub();
realtimeHub.attachToServer(server);
setRealtimeHub(realtimeHub);

server.listen(PORT, () => {
  console.log(`API & static: http://localhost:${PORT}`);
});
