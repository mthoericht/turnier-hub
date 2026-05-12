import { prisma } from "../db.js";
import { DEFAULT_SCHOOL_NAME } from "../config.js";

let cachedCatalogSchoolId: string | null = null;

/**
 * Resolves the school used for catalog data (classes, players, tournaments).
 *
 * Prefer `DEFAULT_SCHOOL_ID` in production; otherwise the first school named
 * {@link DEFAULT_SCHOOL_NAME} from the seed.
 */
export async function getCatalogSchoolId(): Promise<string>
{
  if (cachedCatalogSchoolId)
  {
    return cachedCatalogSchoolId;
  }
  const envId = process.env.DEFAULT_SCHOOL_ID?.trim();
  if (envId)
  {
    const row = await prisma.school.findUnique({
      where: { id: envId },
      select: { id: true },
    });
    if (!row)
    {
      throw new Error(`DEFAULT_SCHOOL_ID (${envId}) does not match any school`);
    }
    cachedCatalogSchoolId = row.id;
    return row.id;
  }
  const row = await prisma.school.findFirst({
    where: { name: DEFAULT_SCHOOL_NAME },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!row)
  {
    throw new Error(
      `No school found for DEFAULT_SCHOOL_NAME=${DEFAULT_SCHOOL_NAME}; create a school or set DEFAULT_SCHOOL_ID`,
    );
  }
  cachedCatalogSchoolId = row.id;
  return row.id;
}

/** Test helper: catalog school id must be recomputed after DB resets. */
export function resetCatalogSchoolIdCacheForTests(): void
{
  cachedCatalogSchoolId = null;
}
