import type { SchoolClass } from "@prisma/client";
import type { CreatedBy, Player, SchoolClass as SchoolClassApi } from "@turnier-hub/shared";

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

export function toCreatedBy(user: CreatedByUser): CreatedBy {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
  };
}

/** Include für API-Antworten mit Spieler + Ersteller + optionaler Klasse */
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

export function playerToApi(p: PlayerApiRow): Player {
  return {
    id: p.id,
    name: p.name,
    schoolClass: p.schoolClass,
    createdBy: toCreatedBy(p.user),
  };
}

export type SchoolClassWithUser = SchoolClass & { user: CreatedByUser };

export function schoolClassToApi(row: SchoolClassWithUser): SchoolClassApi {
  const { user, userId, ...rest } = row;
  return {
    id: rest.id,
    name: rest.name,
    createdBy: toCreatedBy(user),
  };
}

export function parseListScope(q: unknown): "own" | "all" {
  return q === "own" ? "own" : "all";
}
