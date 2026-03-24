import { api } from "@/api/http";
import type { SchoolClass } from "@/types";

export type ClassesScope = "all" | "own";

export async function fetchSchoolClasses(
  scope: ClassesScope
): Promise<SchoolClass[]> 
{
  return api<SchoolClass[]>(`/api/classes?scope=${scope}`);
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
