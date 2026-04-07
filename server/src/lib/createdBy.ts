import type { SchoolClass } from "@prisma/client";
import type { CreatedBy, Player, SchoolClass as SchoolClassApi } from "@turnier-hub/shared";

/**
 * Reusable Prisma select for the user fields exposed as `createdBy`.
 */
export const createdBySelect = {
  id: true,
  username: true,
  email: true,
} as const;

export type CreatedByUser = {
  id: string;
  username: string | null;
  email: string;
};

/**
 * Maps a database user shape to the shared API `CreatedBy` DTO.
 */
export function toCreatedBy(user: CreatedByUser): CreatedBy {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
  };
}

/**
 * Prisma include used for player list/detail API responses
 * with creator data and optional class data.
 */
export const playerApiInclude = {
  user: { select: createdBySelect },
  schoolClass: { select: { id: true, name: true } },
} as const;

export type PlayerApiRow = {
  id: string;
  name: string;
  user: CreatedByUser;
  schoolClass: { id: string; name: string } | null;
};

/**
 * Converts a Prisma player row (including relations) to the shared API `Player` DTO.
 */
export function playerToApi(p: PlayerApiRow): Player {
  return {
    id: p.id,
    name: p.name,
    schoolClass: p.schoolClass,
    createdBy: toCreatedBy(p.user),
  };
}

export type SchoolClassWithUser = SchoolClass & { user: CreatedByUser };

/**
 * Converts a Prisma school class row to the shared API `SchoolClass` DTO.
 */
export function schoolClassToApi(row: SchoolClassWithUser): SchoolClassApi {
  const { user, userId, ...rest } = row;
  return {
    id: rest.id,
    name: rest.name,
    createdBy: toCreatedBy(user),
  };
}

/**
 * Parses the catalog list scope query parameter.
 * Defaults to `"all"` for unknown values.
 */
export function parseListScope(q: unknown): "own" | "all" {
  return q === "own" ? "own" : "all";
}
