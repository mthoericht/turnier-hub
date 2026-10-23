import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../server/src/app.js";
import { prisma } from "../../../server/src/db.js";
import { fetchPlayers, importPlayersFromRows } from "../../../client/src/api/playersApi";
import { resetDatabase } from "../../server/helpers/db.js";

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
    const schoolClass = await prisma.schoolClass.create({
      data: { name: "10a" },
    });
    const keepPlayer = await prisma.player.create({
      data: {
        firstName: "Anna",
        lastName: "Muster",
        schoolClassId: schoolClass.id,
      },
    });
    await prisma.player.create({
      data: {
        firstName: "Zoe",
        lastName: "Legacy",
        schoolClassId: schoolClass.id,
      },
    });
    const tournament = await prisma.tournament.create({
      data: {
        name: "Roster Preserve",
        sport: "Fußball",
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
    const players = await fetchPlayers();
    expect(players.map((p) => `${p.firstName} ${p.lastName}`)).toEqual(["Anna Muster", "Ben Neu"]);

    const membership = await prisma.tournamentTeamMember.findFirst({
      where: {
        tournamentId: tournament.id,
        playerId: keepPlayer.id,
      },
    });
    expect(membership).not.toBeNull();
  });

  it("rejects host-only reset through the player import API", async () =>
  {
    const schoolClass = await prisma.schoolClass.create({
      data: { name: "9b" },
    });
    await prisma.player.create({
      data: {
        firstName: "Old",
        lastName: "Player",
        schoolClassId: schoolClass.id,
      },
    });
    await prisma.tournament.create({
      data: {
        name: "Old Tournament",
        sport: "Volleyball",
      },
    });

    const response = await fetch("/api/players/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "reset_all", rows: [{ firstName: "Nina", lastName: "Neu", className: "11c" }] }),
    });
    expect(response.status).toBe(400);
    const players = await fetchPlayers();
    expect(players).toHaveLength(1);
    expect(players[0]?.firstName).toBe("Old");
    expect(await prisma.tournament.count()).toBe(1);
  });
});
