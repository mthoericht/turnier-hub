import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { createApp } from "../../../server/src/app.js";
import { prisma } from "../../../server/src/db.js";
import {
  SEED_EMAIL,
  SEED_PASSWORD,
} from "../../../server/src/seed/demoSeed.js";
import {
  postAuthLogin,
} from "../../../client/src/api/authApi";
import {
  addTeamMember,
  createTournamentTeam,
  deleteAllMatches,
  deleteTournamentTeam,
  fetchTournamentDetail,
  fetchTournaments,
  postAdvancePhase,
  postGenerateGroupMatches,
  postTournament,
} from "../../../client/src/api/tournamentsApi";
import { prisma } from "../../../server/src/db.js";
import { fetchPlayersAll } from "../../../client/src/api/playersApi";
import { setToken } from "../../../client/src/api/http";
import { resetDatabase } from "../../server/helpers/db.js";

const app = createApp();
let server: Server | null = null;
let apiBaseUrl = "";
const originalFetch = globalThis.fetch;

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

async function seedMinimalAuthAndPlayers(): Promise<void>
{
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: SEED_EMAIL,
      username: "seeduser",
      passwordHash,
    },
  });
  await prisma.player.createMany({
    data: Array.from({ length: 16 }, (_, i) => ({
      name: `Test Player ${i + 1}`,
      userId: user.id,
      schoolClassId: null,
    })),
  });
}

describe("tournaments API integration (via client API)", () =>
{
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
    await seedMinimalAuthAndPlayers();
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

  it("deletes team and removes related group matches", async () =>
  {
    const auth = await postAuthLogin(SEED_EMAIL, SEED_PASSWORD);
    setToken(auth.token);

    const created = await postTournament({
      name: "Delete Team Test",
      sport: "Badminton",
      mode: "GROUP_KO",
      groupCount: 1,
      advancesPerGroup: 2,
      teamsAreIndividuals: true,
    });
    await createTournamentTeam(created.id, { name: "Team A" });
    await createTournamentTeam(created.id, { name: "Team B" });
    await createTournamentTeam(created.id, { name: "Team C" });
    const detail = await fetchTournamentDetail(created.id);
    const players = await fetchPlayersAll();
    for (let i = 0; i < 3; i++)
    {
      await addTeamMember(created.id, detail.teams[i]!.id, players[i]!.id);
    }
    await postGenerateGroupMatches(created.id);

    const teamId = detail.teams[0]!.id;

    const initialGroupMatches = await prisma.match.count({
      where: {
        tournamentId: created.id,
        phase: "GROUP",
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      },
    });
    expect(initialGroupMatches).toBeGreaterThan(0);

    const delRes = await deleteTournamentTeam(created.id, teamId);
    expect(delRes.removedGroupMatches).toBe(initialGroupMatches);

    const remainingTeam = await prisma.tournamentTeam.findUnique({
      where: { id: teamId },
    });
    expect(remainingTeam).toBeNull();
  });

  it("delete-all-matches removes matches and clears team group labels", async () =>
  {
    const auth = await postAuthLogin(SEED_EMAIL, SEED_PASSWORD);
    setToken(auth.token);

    const created = await postTournament({
      name: "Delete Matches Test",
      sport: "Fußball",
      mode: "GROUP_KO",
      groupCount: 2,
      advancesPerGroup: 1,
    });
    await createTournamentTeam(created.id, { name: "Team A" });
    await createTournamentTeam(created.id, { name: "Team B" });
    await createTournamentTeam(created.id, { name: "Team C" });
    await createTournamentTeam(created.id, { name: "Team D" });
    const detail = await fetchTournamentDetail(created.id);
    const players = await fetchPlayersAll();
    for (let i = 0; i < 4; i++)
    {
      await addTeamMember(created.id, detail.teams[i]!.id, players[i]!.id);
    }
    await postGenerateGroupMatches(created.id);

    const res = await deleteAllMatches(created.id);
    expect(res.matches).toHaveLength(0);

    const groupedTeams = await prisma.tournamentTeam.count({
      where: { tournamentId: created.id, groupLabel: { not: null } },
    });
    expect(groupedTeams).toBe(0);
  });

  it("returns tie-break notice when points are equal on qualification boundary", async () =>
  {
    const auth = await postAuthLogin(SEED_EMAIL, SEED_PASSWORD);
    setToken(auth.token);

    const created = await postTournament({
      name: "Tie-Break Test Turnier",
      sport: "Fußball",
      mode: "GROUP_KO",
      groupCount: 1,
      advancesPerGroup: 2,
    });

    await createTournamentTeam(created.id, { name: "Team A" });
    await createTournamentTeam(created.id, { name: "Team B" });
    await createTournamentTeam(created.id, { name: "Team C" });
    await createTournamentTeam(created.id, { name: "Team D" });

    const detail = await fetchTournamentDetail(created.id);
    const players = await fetchPlayersAll();
    expect(players.length).toBeGreaterThanOrEqual(4);
    const teamIds = detail.teams.map((team) => team.id);
    for (let i = 0; i < teamIds.length; i++)
    {
      await addTeamMember(created.id, teamIds[i], players[i].id);
    }

    const afterGenerate = await postGenerateGroupMatches(created.id);
    await prisma.match.updateMany({
      where: {
        tournamentId: created.id,
        id: { in: afterGenerate.matches.filter((x) => x.phase === "GROUP").map((m) => m.id) },
      },
      data: { homeScore: 1, awayScore: 1, status: "FINISHED" },
    });

    const advanced = await postAdvancePhase(created.id, "FINAL");
    expect((advanced.notices ?? []).length).toBeGreaterThan(0);
    expect((advanced.notices ?? []).some((n) => n.includes("Zufallsprinzip"))).toBe(true);
  });

  it("turnier-ersteller kann fremden Spieler in den Kader aufnehmen", async () =>
  {
    const auth = await postAuthLogin(SEED_EMAIL, SEED_PASSWORD);
    setToken(auth.token);

    const otherUser = await prisma.user.create({
      data: {
        email: "other@turnier-hub.test",
        username: "othercoach",
        passwordHash: await bcrypt.hash("x", 10),
      },
    });
    const otherPlayer = await prisma.player.create({
      data: {
        name: "Spieler anderer Nutzer",
        userId: otherUser.id,
        schoolClassId: null,
      },
    });

    const created = await postTournament({
      name: "Cross-user roster",
      sport: "Fußball",
      mode: "GROUP_KO",
      groupCount: 1,
      advancesPerGroup: 2,
    });
    await createTournamentTeam(created.id, { name: "Team A" });
    const detail = await fetchTournamentDetail(created.id);
    await addTeamMember(created.id, detail.teams[0]!.id, otherPlayer.id);
    const after = await fetchTournamentDetail(created.id);
    expect(after.teams[0]?.members.some((m) => m.playerId === otherPlayer.id)).toBe(true);
  });

  // Hinweis: Gruppen-Generierung berücksichtigt nun auch Teams ohne Spieler.
});
