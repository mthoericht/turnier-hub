/** User summary as embedded in API payloads (creator of a resource). */
export type CreatedBy = {
  id: string;
  username: string | null;
  email: string;
};

/** Logged-in user from `GET /api/auth/me` (same shape as {@link CreatedBy}). */
export type AuthUser = {
  id: string;
  username: string | null;
  email: string;
  schoolName: string;
  role: "admin" | "user";
};

export type UserRole = AuthUser["role"];

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
  createdBy: CreatedBy;
};

/** School class row from `/api/classes`. */
export type SchoolClass = {
  id: string;
  name: string;
  createdBy: CreatedBy;
};

export function formatCreator(c: CreatedBy): string
{
  if (c.username) return `@${c.username}`;
  return c.email;
}

export function formatPlayerName(player: Pick<Player, "firstName" | "lastName">): string
{
  return `${player.firstName} ${player.lastName}`.trim();
}
