import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../server/src/app.js";
import { prisma } from "../../../server/src/db.js";
import { fetchPlayers, importPlayersFromRows } from "../../../client/src/api/playersApi";
import { resetDatabase } from "../../server/helpers/db.js";
import { wrapFetchForTestApi } from "../helpers/remoteUserFetch.js";

const REMOTE_USER = "player-tester";

describe("players import/export API integration", () =>
{
  const app = createApp();
  let server: Server | null = null;
  let apiBaseUrl = "";
  const originalFetch = globalThis.fetch;

  beforeAll(async () =>
  {
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
  });

  beforeEach(async () =>
  {
    await resetDatabase();
    globalThis.fetch = wrapFetchForTestApi(originalFetch, apiBaseUrl, REMOTE_USER);
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
    const school = await prisma.school.findFirstOrThrow({ where: { name: "defaultSchool" } });
    const schoolClass = await prisma.schoolClass.create({
      data: { name: "10a", createdBySubject: REMOTE_USER, schoolId: school.id },
    });
    const keepPlayer = await prisma.player.create({
      data: {
        firstName: "Anna",
        lastName: "Muster",
        schoolClassId: schoolClass.id,
        createdBySubject: REMOTE_USER,
        schoolId: school.id,
      },
    });
    await prisma.player.create({
      data: {
        firstName: "Zoe",
        lastName: "Legacy",
        schoolClassId: schoolClass.id,
        createdBySubject: REMOTE_USER,
        schoolId: school.id,
      },
    });
    const tournament = await prisma.tournament.create({
      data: {
        name: "Roster Preserve",
        sport: "Fußball",
        createdBySubject: REMOTE_USER,
        schoolId: school.id,
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
    const school = await prisma.school.findFirstOrThrow({ where: { name: "defaultSchool" } });
    const schoolClass = await prisma.schoolClass.create({
      data: { name: "9b", createdBySubject: REMOTE_USER, schoolId: school.id },
    });
    await prisma.player.create({
      data: {
        firstName: "Old",
        lastName: "Player",
        schoolClassId: schoolClass.id,
        createdBySubject: REMOTE_USER,
        schoolId: school.id,
      },
    });
    await prisma.tournament.create({
      data: {
        name: "Old Tournament",
        sport: "Volleyball",
        createdBySubject: REMOTE_USER,
        schoolId: school.id,
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
