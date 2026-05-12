import type { SessionUser } from "@turnier-hub/shared";
import { api } from "./http";

export async function fetchSession(): Promise<SessionUser>
{
  return api<SessionUser>("/api/session");
}
