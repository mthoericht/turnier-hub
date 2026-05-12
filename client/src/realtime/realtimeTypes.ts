export type ServerPushMessage =
  | { type: "tournamentChanged"; tournamentId: string }
  | { type: "catalogChanged"; kinds: Array<"players" | "classes"> }
  | { type: "tournamentsChanged" };
