import { prisma } from "../db.js";
import { DEFAULT_SCHOOL_NAME } from "../config.js";

type SchoolDelegate = {
  upsert: (args: {
    where: { name: string };
    create: { name: string };
    update: Record<string, never>;
    select: { id: true; name: true };
  }) => Promise<{ id: string; name: string }>;
};

export async function ensureDefaultSchool(): Promise<{ id: string; name: string }>
{
  const schoolDelegate = (prisma as unknown as { school: SchoolDelegate }).school;
  return schoolDelegate.upsert({
    where: { name: DEFAULT_SCHOOL_NAME },
    create: { name: DEFAULT_SCHOOL_NAME },
    update: {},
    select: { id: true, name: true },
  });
}
