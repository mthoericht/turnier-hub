import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile =
  process.env.NODE_ENV === "test" ? ".env.test" : ".env";
loadEnv({ path: path.join(here, "..", envFile) });

export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me";
export const INVITE_CODE = process.env.INVITE_CODE ?? "ballspiele2026";
export const PORT = Number(process.env.PORT ?? 3001);
