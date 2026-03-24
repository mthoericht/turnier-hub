export type AuthUser = {
  id: string;
  username: string | null;
  email: string;
};

export type CreatedBy = {
  id: string;
  username: string | null;
  email: string;
};

/** Klasse wie von der API geliefert (z. B. bei Spielern). */
export type PlayerSchoolClass = {
  id: string;
  name: string;
};

export type Player = {
  id: string;
  name: string;
  schoolClass: PlayerSchoolClass | null;
  createdBy: CreatedBy;
};

/** Verwaltbare Klasse (Liste unter /classes). */
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
