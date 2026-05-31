import type { PrismaClient } from "@prisma/client";

export class AdminUserServiceError extends Error
{
  constructor(
    message: string,
    readonly code: "NOT_FOUND",
  )
  {
    super(message);
    this.name = "AdminUserServiceError";
  }
}

export type PromotedAdminUser = {
  id: string;
  email: string;
  role: "ADMIN";
  alreadyAdmin: boolean;
};

/** Promote an existing RDS user to ADMIN by e-mail (Postgres-managed roles, Cognito cutover). */
export async function promoteUserToAdminByEmail(
  prisma: PrismaClient,
  email: string,
): Promise<PromotedAdminUser>
{
  const normalized = email.trim();
  if (!normalized)
  {
    throw new AdminUserServiceError("E-Mail darf nicht leer sein", "NOT_FOUND");
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: { id: true, email: true, role: true },
  });
  if (!user)
  {
    throw new AdminUserServiceError(`Kein User mit E-Mail „${normalized}"`, "NOT_FOUND");
  }
  if (user.role === "ADMIN")
  {
    return {
      id: user.id,
      email: user.email,
      role: "ADMIN",
      alreadyAdmin: true,
    };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
    select: { id: true, email: true, role: true },
  });
  return {
    id: updated.id,
    email: updated.email,
    role: "ADMIN",
    alreadyAdmin: false,
  };
}
