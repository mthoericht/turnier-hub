/* global process, console */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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

function whichMkcert() {
  try {
    execSync("mkcert -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");

const certDir = path.resolve(clientRoot, ".certs");
const keyPath = path.resolve(certDir, "dev-key.pem");
const certPath = path.resolve(certDir, "dev-cert.pem");

if (!whichMkcert()) {
  console.error(
    "mkcert ist nicht installiert. Bitte installiere es (z.B. via brew) und starte dann erneut:",
  );
  console.error("  brew install mkcert");
  console.error("  mkcert -install");
  process.exit(1);
}

const ip = getLanIPv4();
const hosts = ["localhost", "127.0.0.1", ...(ip ? [ip] : [])];

fs.mkdirSync(certDir, { recursive: true });

// Install local CA (trust store for the dev machine).
execSync("mkcert -install", { stdio: "inherit" });

// Generate certs into our repo-local .certs folder.
const args = [
  "-cert-file",
  certPath,
  "-key-file",
  keyPath,
  ...hosts,
].join(" ");

execSync(`mkcert ${args}`, { stdio: "inherit" });

let caroot = "";
try {
  caroot = execSync("mkcert -CAROOT").toString().trim();
} catch {
  caroot = "";
}

console.log("\n[dev:https] Zertifikate erzeugt:");
console.log(`- cert: ${certPath}`);
console.log(`- key:  ${keyPath}`);

if (caroot) {
  console.log("\n[dev:https] CA Root (für Smartphone/Browser Vertrauen):");
  console.log(`- rootCA.pem: ${path.resolve(caroot, "rootCA.pem")}`);
  console.log(
    "- Bitte rootCA.pem auf das Smartphone kopieren und als vertrauenswürdige Benutzer-CA installieren.",
  );
}

