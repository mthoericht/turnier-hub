import type { CreatedBy } from "@turnier-hub/shared";

export type {
  CreatedBy,
  Player,
  PlayerSchoolClass,
  SchoolClass,
} from "@turnier-hub/shared";

export { formatCreator } from "@turnier-hub/shared";

/** Logged-in user from `/api/auth/me` (same fields as `CreatedBy`). */
export type AuthUser = CreatedBy;
