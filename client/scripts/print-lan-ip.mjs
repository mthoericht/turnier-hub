/* global process, console */
import os from "node:os";

function getLanIPv4() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const entries = interfaces[name] ?? [];
    for (const entry of entries) {
      if (!entry) continue;
      if (entry.family !== "IPv4") continue;
      if (entry.internal) continue;
      return entry.address;
    }
  }

  return null;
}

const ip = getLanIPv4();
const port = process.env.VITE_PORT ?? "5173";
const scheme = process.env.DEV_SCHEME ?? "http";
const local = `${scheme}://127.0.0.1:${port}/`;
const lan = ip ? `${scheme}://${ip}:${port}/` : null;

console.log("[dev] URLs:");
console.log(`- local: ${local}`);
if (lan) {
  console.log(`- lan:   ${lan}`);
} else {
  console.log("- lan:   (could not determine non-loopback IPv4)");
}

