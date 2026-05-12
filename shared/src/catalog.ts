/** Creator attribution (Authelia `Remote-User` / subject string, display-only). */
export type CreatedBy = {
  subject: string;
};

/** Current browser session from `GET /api/session` (forwarded identity + optional Authelia logout URL). */
export type SessionUser = {
  subject: string;
  role: "admin" | "user";
  /** When set, navigate here to end the Authelia session (clears SSO cookie). */
  logoutUrl: string | null;
};

export type UserRole = SessionUser["role"];

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
  return c.subject;
}

export function formatPlayerName(player: Pick<Player, "firstName" | "lastName">): string
{
  return `${player.firstName} ${player.lastName}`.trim();
}
