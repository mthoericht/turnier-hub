import { PORT } from "./config.js";
import { startServer } from "./runtime.js";

startServer().then(({ stop }) =>
{
  console.log(`API & static: http://localhost:${PORT}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const)
  {
    process.once(signal, () =>
    {
      void stop().then(() => process.exit(0), (error) =>
      {
        console.error("Failed to stop server", error);
        process.exit(1);
      });
    });
  }
}).catch((error) =>
{
  console.error("Failed to initialize server startup tasks", error);
  process.exit(1);
});
