import type { CreatedBy, Player, SchoolClass as SchoolClassApi } from "@turnier-hub/shared";

/** Fields read from Prisma `SchoolClass` for catalog API mapping. */
export type SchoolClassRow = {
  id: string;
  name: string;
  createdBySubject: string;
};

/**
 * Maps persisted `createdBySubject` (Authelia / `Remote-User`) to the shared API `CreatedBy` DTO.
 */
export function toCreatedBy(createdBySubject: string): CreatedBy
{
  return { subject: createdBySubject };
}

/**
 * Prisma include used for player list/detail API responses with optional class data.
 */
export const playerApiInclude = {
  schoolClass: { select: { id: true, name: true } },
} as const;

export type PlayerApiRow = {
  id: string;
  firstName: string;
  lastName: string;
  createdBySubject: string;
  schoolClass: { id: string; name: string } | null;
};

/**
 * Converts a Prisma player row (including relations) to the shared API `Player` DTO.
 */
export function playerToApi(p: PlayerApiRow): Player
{
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    schoolClass: p.schoolClass,
    createdBy: toCreatedBy(p.createdBySubject),
  };
}

/**
 * Converts a Prisma school class row to the shared API `SchoolClass` DTO.
 */
export function schoolClassToApi(row: SchoolClassRow): SchoolClassApi
{
  return {
    id: row.id,
    name: row.name,
    createdBy: toCreatedBy(row.createdBySubject),
  };
}

/**
 * Parses the catalog list scope query parameter.
 * Defaults to `"all"` for unknown values.
 */
export function parseListScope(q: unknown): "own" | "all"
{
  return q === "own" ? "own" : "all";
}
