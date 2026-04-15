import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { createApp } from "../../../server/src/app.js";
import { prisma } from "../../../server/src/db.js";
import { INVITE_CODE } from "../../../server/src/config.js";
import { postAuthLogin, postAuthSignup } from "../../../client/src/api/authApi";
import { fetchPlayers, importPlayersFromRows } from "../../../client/src/api/playersApi";
import { setToken } from "../../../client/src/api/http";
import { resetDatabase } from "../../server/helpers/db.js";

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

function installLocalStorageMock(): void
{
  const map = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
    clear: () => { map.clear(); },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
}

describe("players import/export API integration", () =>
{
  const app = createApp();
  let server: Server | null = null;
  let apiBaseUrl = "";
  const originalFetch = globalThis.fetch;

  beforeAll(async () =>
  {
    installLocalStorageMock();
    await new Promise<void>((resolve) =>
    {
      server = app.listen(0, () => resolve());
    });

    const address = server!.address();
    if (!address || typeof address === "string")
    {
      throw new Error("Could not determine test server port");
    }

    apiBaseUrl = `http://127.0.0.1:${address.port}`;

    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    {
      if (typeof input === "string" && input.startsWith("/"))
      {
        return originalFetch(`${apiBaseUrl}${input}`, init);
      }
      if (input instanceof URL && input.pathname.startsWith("/"))
      {
        return originalFetch(new URL(`${apiBaseUrl}${input.pathname}${input.search}`), init);
      }
      return originalFetch(input as RequestInfo, init);
    }) as typeof fetch;
  });

  beforeEach(async () =>
  {
    await resetDatabase();
    setToken(null);
  });

  afterAll(async () =>
  {
    globalThis.fetch = originalFetch;
    if (server)
    {
      await new Promise<void>((resolve, reject) =>
      {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
    }
    await prisma.$disconnect();
  });

  it("replace_players keeps matching players (and memberships), removes missing ones", async () =>
  {
    const auth = await postAuthSignup({
      username: "ImportCoach",
      email: "import-coach@example.com",
      password: "password123",
      inviteCode: INVITE_CODE,
    });
    setToken(auth.token);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    const schoolClass = await prisma.schoolClass.create({
      data: { name: "10a", userId: user.id },
    });
    const keepPlayer = await prisma.player.create({
      data: {
        firstName: "Anna",
        lastName: "Muster",
        schoolClassId: schoolClass.id,
        userId: user.id,
      },
    });
    await prisma.player.create({
      data: {
        firstName: "Zoe",
        lastName: "Legacy",
        schoolClassId: schoolClass.id,
        userId: user.id,
      },
    });
    const tournament = await prisma.tournament.create({
      data: {
        name: "Roster Preserve",
        sport: "Fußball",
        userId: user.id,
      },
    });
    const team = await prisma.tournamentTeam.create({
      data: {
        tournamentId: tournament.id,
        name: "Team A",
      },
    });
    await prisma.tournamentTeamMember.create({
      data: {
        tournamentId: tournament.id,
        teamId: team.id,
        playerId: keepPlayer.id,
      },
    });

    const result = await importPlayersFromRows(
      [
        { firstName: "Anna", lastName: "Muster", className: "10a" },
        { firstName: "Ben", lastName: "Neu", className: "10a" },
      ],
      "replace_players",
    );

    expect(result.imported).toBe(2);
    const players = await fetchPlayers("all");
    expect(players.map((p) => `${p.firstName} ${p.lastName}`)).toEqual(["Anna Muster", "Ben Neu"]);

    const membership = await prisma.tournamentTeamMember.findFirst({
      where: {
        tournamentId: tournament.id,
        playerId: keepPlayer.id,
      },
    });
    expect(membership).not.toBeNull();
  });

  it("reset_all clears tournaments/classes/players and imports fresh rows", async () =>
  {
    await postAuthSignup({
      username: "ResetCoach",
      email: "reset-coach@example.com",
      password: "password123",
      inviteCode: INVITE_CODE,
    });
    const auth = await postAuthLogin("reset-coach@example.com", "password123");
    setToken(auth.token);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    const schoolClass = await prisma.schoolClass.create({
      data: { name: "9b", userId: user.id },
    });
    await prisma.player.create({
      data: {
        firstName: "Old",
        lastName: "Player",
        schoolClassId: schoolClass.id,
        userId: user.id,
      },
    });
    await prisma.tournament.create({
      data: {
        name: "Old Tournament",
        sport: "Volleyball",
        userId: user.id,
      },
    });

    const result = await importPlayersFromRows(
      [{ firstName: "Nina", lastName: "Neu", className: "11c" }],
      "reset_all",
    );

    expect(result.imported).toBe(1);
    const players = await fetchPlayers("all");
    expect(players).toHaveLength(1);
    expect(players[0]?.firstName).toBe("Nina");
    expect(players[0]?.lastName).toBe("Neu");
    expect(players[0]?.schoolClass?.name).toBe("11c");

    const tournamentCount = await prisma.tournament.count();
    expect(tournamentCount).toBe(0);
  });
});
