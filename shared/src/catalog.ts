/** Class shape nested under players in API responses. */
export type PlayerSchoolClass = {
  id: string;
  name: string;
};

/** Player as returned by the HTTP API. */
export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  schoolClass: PlayerSchoolClass | null;
};

/** School class row from `/api/classes`. */
export type SchoolClass = {
  id: string;
  name: string;
};

export function formatPlayerName(player: Pick<Player, "firstName" | "lastName">): string
{
  return `${player.firstName} ${player.lastName}`.trim();
}
