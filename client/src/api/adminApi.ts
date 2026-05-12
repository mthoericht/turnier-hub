import { api } from "./http";

export type AdminSchool = {
  id: string;
  name: string;
  catalogCount: number;
};

export type AdminAuditLog = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  actor: {
    subject: string;
  };
  before: unknown;
  after: unknown;
};

export async function fetchAdminSchools(): Promise<AdminSchool[]>
{
  return api<AdminSchool[]>("/api/admin/schools");
}

export async function postAdminSchool(body: { name: string }): Promise<AdminSchool>
{
  return api<AdminSchool>("/api/admin/schools", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchAdminSchool(id: string, body: { name: string }): Promise<AdminSchool>
{
  return api<AdminSchool>(`/api/admin/schools/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteAdminSchool(id: string): Promise<void>
{
  await api<void>(`/api/admin/schools/${id}`, { method: "DELETE" });
}

export async function fetchAdminAuditLogs(limit = 100): Promise<AdminAuditLog[]>
{
  return api<AdminAuditLog[]>(`/api/admin/audit-logs?limit=${limit}`);
}
