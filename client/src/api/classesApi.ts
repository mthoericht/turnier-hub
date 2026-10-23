import { api } from "./http";
import type { SchoolClass } from "@turnier-hub/shared";


export async function fetchSchoolClasses(): Promise<SchoolClass[]>
{
  return api<SchoolClass[]>("/api/classes");
}

export async function postSchoolClass(body: { name: string }): Promise<SchoolClass>
{
  return api<SchoolClass>("/api/classes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchSchoolClass(
  id: string,
  body: { name: string }
): Promise<SchoolClass>
{
  return api<SchoolClass>(`/api/classes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteSchoolClass(id: string): Promise<void>
{
  await api(`/api/classes/${id}`, { method: "DELETE" });
}
