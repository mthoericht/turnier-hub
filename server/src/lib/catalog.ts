import type { Player, SchoolClass } from "@turnier-hub/shared";

export const playerApiInclude = {
  schoolClass: { select: { id: true, name: true } },
} as const;

export function playerToApi(p: Player): Player
{
  return { id: p.id, firstName: p.firstName, lastName: p.lastName, schoolClass: p.schoolClass };
}

export function schoolClassToApi(row: SchoolClass): SchoolClass
{
  return { id: row.id, name: row.name };
}
