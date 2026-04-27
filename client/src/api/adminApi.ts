import { api } from "./http";
import type { UserRole } from "@turnier-hub/shared";

export type AdminSchool = {
  id: string;
  name: string;
  userCount: number;
};

export type AdminUser = {
  id: string;
  username: string | null;
  email: string;
  role: UserRole;
  school: {
    id: string;
    name: string;
  };
};

export type AdminAuditLog = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  actor: {
    id: string;
    username: string | null;
    email: string;
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

export async function fetchAdminUsers(): Promise<AdminUser[]>
{
  return api<AdminUser[]>("/api/admin/users");
}

export async function fetchAdminAuditLogs(limit = 100): Promise<AdminAuditLog[]>
{
  return api<AdminAuditLog[]>(`/api/admin/audit-logs?limit=${limit}`);
}

export async function patchAdminUserRole(id: string, role: UserRole): Promise<AdminUser>
{
  return api<AdminUser>(`/api/admin/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function patchAdminUserSchool(id: string, schoolId: string): Promise<AdminUser>
{
  return api<AdminUser>(`/api/admin/users/${id}/school`, {
    method: "PATCH",
    body: JSON.stringify({ schoolId }),
  });
}
