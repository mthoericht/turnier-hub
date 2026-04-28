import http from "node:http";
import { PORT } from "./config.js";
import { createApp } from "./app.js";
import { ensureDefaultSchool } from "./lib/schools.js";

const app = createApp();
const server = http.createServer(app);

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
