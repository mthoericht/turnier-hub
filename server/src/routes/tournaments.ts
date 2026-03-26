import { Router, type Response } from "express";
import { z } from "zod";
import { MatchPhase, MatchStatus, TournamentMode, TournamentPhase, type Match } from "@prisma/client";
import { prisma } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  createdBySelect,
  parseListScope,
  playerApiInclude,
  playerToApi,
  toCreatedBy,
} from "../lib/createdBy.js";
import { advanceTournamentPhase } from "../services/advancePhase.js";
import { computePoolStandings } from "../services/standings.js";
import { computeElapsedMs } from "../services/matchTimer.js";
import {
  distributeIntoGroups,
  generateRoundRobinSchedule,
} from "../services/roundRobinSchedule.js";
import { generateKoBracketFirstRound } from "../services/knockoutBracket.js";

const router = Router();
router.use(authMiddleware);

const phaseOrder: Record<MatchPhase, number> = {
  GROUP: 0,
  ROUND_OF_16: 1,
  QUARTER: 2,
  SEMI: 3,
  FINAL: 4,
};

function sortMatches<T extends { phase: MatchPhase; roundOrder: number; slotIndex: number }>(
  matches: T[]
): T[] {
  return [...matches].sort((a, b) => {
    const po = phaseOrder[a.phase] - phaseOrder[b.phase];
    if (po !== 0) return po;
    if (a.roundOrder !== b.roundOrder) return a.roundOrder - b.roundOrder;
    return a.slotIndex - b.slotIndex;
  });
}

type MatchWithTeams = Match & {
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
};

const matchUpdateInclude = {
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
} as const;

function serializeMatch(m: MatchWithTeams) {
  const now = new Date();
  const { homeTeam, awayTeam, ...rest } = m;
  return {
    ...rest,
    homeTeam: homeTeam ?? null,
    awayTeam: awayTeam ?? null,
    elapsedMs: computeElapsedMs(m, now),
  };
}

async function loadTournamentById(id: string) {
  return prisma.tournament.findFirst({
    where: { id },
    include: {
      user: { select: createdBySelect },
      teams: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          members: {
            include: {
              player: { include: playerApiInclude },
            },
          },
        },
      },
      matches: {
        include: {
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
        },
        orderBy: [{ roundOrder: "asc" }, { slotIndex: "asc" }],
      },
    },
  });
}

function serializeTournamentDetail(
  t: NonNullable<Awaited<ReturnType<typeof loadTournamentById>>>
) {
  const { user, matches, teams, ...rest } = t;
  return {
    ...rest,
    createdBy: toCreatedBy(user),
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      sortOrder: team.sortOrder,
      groupLabel: team.groupLabel ?? null,
      members: team.members.map((m) => ({
        id: m.id,
        tournamentId: m.tournamentId,
        teamId: m.teamId,
        playerId: m.playerId,
        player: playerToApi(m.player),
      })),
    })),
    matches: sortMatches(matches).map((m) =>
      serializeMatch(m as MatchWithTeams)
    ),
  };
}

async function requireTournamentOwner(
  res: Response,
  tournamentId: string,
  userId: string
) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) {
    res.status(404).json({ error: "Turnier nicht gefunden" });
    return null;
  }
  if (t.userId !== userId) {
    res.status(403).json({ error: "Nur der Ersteller darf das bearbeiten." });
    return null;
  }
  return t;
}

const createTournamentSchema = z.object({
  name: z.string().min(1),
  sport: z.string().min(1),
  mode: z.enum(["GROUP_KO", "DIRECT_KO", "ROUND_ROBIN"]).optional(),
  groupCount: z.number().int().min(1).max(16).optional(),
  advancesPerGroup: z.number().int().min(1).max(8).optional(),
  teamsAreIndividuals: z.boolean().optional(),
});

router.get("/", async (req, res) => {
  const scope = parseListScope(req.query.scope);
  const where = scope === "own" ? { userId: req.userId! } : {};
  const list = await prisma.tournament.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: createdBySelect },
      _count: { select: { teams: true, matches: true } },
    },
  });
  res.json(
    list.map(({ user, ...row }) => ({
      ...row,
      createdBy: toCreatedBy(user),
    }))
  );
});

router.post("/", async (req, res) => {
  const parsed = createTournamentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  const mode = parsed.data.mode
    ? (TournamentMode[parsed.data.mode as keyof typeof TournamentMode])
    : TournamentMode.GROUP_KO;
  const defaultPhase = mode === TournamentMode.DIRECT_KO
    ? TournamentPhase.QUARTER
    : TournamentPhase.GROUP;
  const t = await prisma.tournament.create({
    data: {
      name: parsed.data.name,
      sport: parsed.data.sport,
      mode,
      phase: defaultPhase,
      groupCount: parsed.data.groupCount ?? 1,
      userId: req.userId!,
      advancesPerGroup: parsed.data.advancesPerGroup ?? 2,
      teamsAreIndividuals: parsed.data.teamsAreIndividuals ?? false,
    },
    include: {
      user: { select: createdBySelect },
      _count: { select: { teams: true, matches: true } },
    },
  });
  const { user, ...row } = t;
  res.status(201).json({
    ...row,
    createdBy: toCreatedBy(user),
  });
});

router.get("/:id", async (req, res) => {
  const t = await loadTournamentById(req.params.id);
  if (!t) {
    res.status(404).json({ error: "Turnier nicht gefunden" });
    return;
  }
  res.json(serializeTournamentDetail(t));
});

const patchTournamentSchema = z.object({
  name: z.string().min(1).optional(),
  sport: z.string().min(1).optional(),
  groupCount: z.number().int().min(1).max(16).optional(),
  advancesPerGroup: z.number().int().min(1).max(8).optional(),
});

router.patch("/:id", async (req, res) => {
  const parsed = patchTournamentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  await prisma.tournament.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  const full = await loadTournamentById(req.params.id);
  res.json(serializeTournamentDetail(full!));
});

router.delete("/:id", async (req, res) => {
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  await prisma.tournament.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

const createTeamSchema = z.object({
  name: z.string().min(1).max(60),
  sortOrder: z.number().int().optional(),
});

const patchTeamSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  sortOrder: z.number().int().optional(),
});

const renameGroupSchema = z.object({
  oldLabel: z.string().trim().min(1).max(40),
  newLabel: z.string().trim().min(1).max(40),
});

router.post("/:id/teams", async (req, res) => {
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  const parsed = createTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Mannschaftsdaten" });
    return;
  }
  const name = parsed.data.name.trim();
  const maxRow = await prisma.tournamentTeam.aggregate({
    where: { tournamentId: req.params.id },
    _max: { sortOrder: true },
  });
  const sortOrder =
    parsed.data.sortOrder ?? (maxRow._max.sortOrder ?? -1) + 1;
  try {
    const team = await prisma.tournamentTeam.create({
      data: {
        tournamentId: req.params.id,
        name,
        sortOrder,
      },
    });
    res.status(201).json({
      id: team.id,
      name: team.name,
      sortOrder: team.sortOrder,
    });
  } catch {
    res.status(409).json({ error: "Mannschaftsname im Turnier schon vergeben" });
  }
});

router.patch("/:id/teams/:teamId", async (req, res) => {
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  const parsed = patchTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingaben" });
    return;
  }
  const existing = await prisma.tournamentTeam.findFirst({
    where: { id: req.params.teamId, tournamentId: req.params.id },
  });
  if (!existing) {
    res.status(404).json({ error: "Mannschaft nicht gefunden" });
    return;
  }
  try {
    const team = await prisma.tournamentTeam.update({
      where: { id: req.params.teamId },
      data: {
        ...(parsed.data.name != null ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.sortOrder !== undefined
          ? { sortOrder: parsed.data.sortOrder }
          : {}),
      },
    });
    res.json({
      id: team.id,
      name: team.name,
      sortOrder: team.sortOrder,
    });
  } catch {
    res.status(409).json({ error: "Mannschaftsname im Turnier schon vergeben" });
  }
});

router.delete("/:id/teams/:teamId", async (req, res) => {
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  const existing = await prisma.tournamentTeam.findFirst({
    where: { id: req.params.teamId, tournamentId: req.params.id },
  });
  if (!existing) {
    res.status(404).json({ error: "Mannschaft nicht gefunden" });
    return;
  }
  const [memCount, teamMatches] = await Promise.all([
    prisma.tournamentTeamMember.count({ where: { teamId: req.params.teamId } }),
    prisma.match.findMany({
      where: {
        tournamentId: req.params.id,
        OR: [
          { homeTeamId: req.params.teamId },
          { awayTeamId: req.params.teamId },
        ],
      },
      select: { id: true, status: true, phase: true },
    }),
  ]);
  const removableGroupMatchIds = teamMatches
    .filter((m) => m.phase === MatchPhase.GROUP)
    .map((m) => m.id);
  const blockingMatchCount = teamMatches.length - removableGroupMatchIds.length;

  if (blockingMatchCount > 0)
  {
    res.status(400).json({
      error:
        "Mannschaft ist noch in K.-o.-Spielen enthalten. "
        + "Bitte diese Spiele zuerst löschen oder zurücksetzen.",
    });
    return;
  }

  if (memCount > 0)
  {
    if (!owned.teamsAreIndividuals)
    {
      res.status(400).json({
        error:
          "Mannschaft ist noch belegt (Kader). Entferne zuerst Spieler aus der Mannschaft.",
      });
      return;
    }
    await prisma.tournamentTeamMember.deleteMany({
      where: { tournamentId: req.params.id, teamId: req.params.teamId },
    });
  }

  if (removableGroupMatchIds.length > 0)
  {
    await prisma.match.deleteMany({
      where: { id: { in: removableGroupMatchIds } },
    });
  }

  try
  {
    await prisma.tournamentTeam.delete({ where: { id: req.params.teamId } });
  }
  catch
  {
    res.status(400).json({
      error:
        "Mannschaft konnte nicht gelöscht werden. Bitte prüfe vorhandene Zuordnungen.",
    });
    return;
  }
  res.status(200).json({
    deletedTeamId: req.params.teamId,
    removedGroupMatches: removableGroupMatchIds.length,
  });
});

router.patch("/:id/groups/rename", async (req, res) => {
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  const parsed = renameGroupSchema.safeParse(req.body);
  if (!parsed.success)
  {
    res.status(400).json({ error: "Ungültige Gruppennamen" });
    return;
  }
  const oldLabel = parsed.data.oldLabel;
  const newLabel = parsed.data.newLabel;
  if (oldLabel === newLabel)
  {
    const full = await loadTournamentById(req.params.id);
    res.json(serializeTournamentDetail(full!));
    return;
  }
  const existingNew = await prisma.tournamentTeam.count({
    where: {
      tournamentId: req.params.id,
      groupLabel: newLabel,
    },
  });
  if (existingNew > 0)
  {
    res.status(409).json({ error: "Gruppenname bereits vorhanden" });
    return;
  }
  await prisma.$transaction([
    prisma.tournamentTeam.updateMany({
      where: { tournamentId: req.params.id, groupLabel: oldLabel },
      data: { groupLabel: newLabel },
    }),
    prisma.match.updateMany({
      where: { tournamentId: req.params.id, phase: MatchPhase.GROUP, groupLabel: oldLabel },
      data: { groupLabel: newLabel },
    }),
  ]);
  const full = await loadTournamentById(req.params.id);
  res.json(serializeTournamentDetail(full!));
});

const addMemberSchema = z.object({
  playerId: z.string(),
});

router.post("/:id/teams/:teamId/members", async (req, res) => {
  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Spieler erforderlich" });
    return;
  }
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  const team = await prisma.tournamentTeam.findFirst({
    where: { id: req.params.teamId, tournamentId: req.params.id },
  });
  if (!team) {
    res.status(404).json({ error: "Mannschaft nicht gefunden" });
    return;
  }
  const player = await prisma.player.findUnique({
    where: { id: parsed.data.playerId },
    include: playerApiInclude,
  });
  if (!player) {
    res.status(404).json({ error: "Spieler nicht gefunden" });
    return;
  }
  try {
    const row = await prisma.tournamentTeamMember.create({
      data: {
        tournamentId: req.params.id,
        teamId: req.params.teamId,
        playerId: parsed.data.playerId,
      },
      include: {
        player: { include: playerApiInclude },
      },
    });
    res.status(201).json({
      id: row.id,
      tournamentId: row.tournamentId,
      teamId: row.teamId,
      playerId: row.playerId,
      player: playerToApi(row.player),
    });
  } catch {
    res.status(409).json({
      error: "Spieler ist bereits einem Kader in diesem Turnier zugeordnet",
    });
  }
});

router.delete("/:id/teams/:teamId/members/:playerId", async (req, res) => {
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  await prisma.tournamentTeamMember.deleteMany({
    where: {
      tournamentId: req.params.id,
      teamId: req.params.teamId,
      playerId: req.params.playerId,
    },
  });
  res.status(204).send();
});

const transferKaderBodySchema = z.object({
  // Wenn `true`, werden alle bestehenden Kader-Zuordnungen im Ziel-Turnier gelöscht,
  // bevor der Quell-Kader übertragen wird.
  overwriteExistingMembers: z.boolean().optional(),
});

router.post(
  "/:id/transfer-kader-from/:sourceTournamentId",
  async (req, res) => {
    const parsed = transferKaderBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ungültige Eingaben" });
      return;
    }

    const targetOwned = await requireTournamentOwner(
      res,
      req.params.id,
      req.userId!
    );
    if (!targetOwned) return;

    const sourceOwned = await requireTournamentOwner(
      res,
      req.params.sourceTournamentId,
      req.userId!
    );
    if (!sourceOwned) return;

    const overwriteExistingMembers =
      parsed.data.overwriteExistingMembers ?? false;

    const sourceTournament = await prisma.tournament.findUnique({
      where: { id: req.params.sourceTournamentId },
      include: {
        teams: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            members: {
              select: { playerId: true },
            },
          },
        },
      },
    });

    if (!sourceTournament) {
      res.status(404).json({ error: "Quell-Turnier nicht gefunden" });
      return;
    }

    if (overwriteExistingMembers) {
      await prisma.tournamentTeamMember.deleteMany({
        where: { tournamentId: req.params.id },
      });
    }

    let createdTeams = 0;
    let addedMembers = 0;

    for (const sTeam of sourceTournament.teams) {
      let tTeam = await prisma.tournamentTeam.findFirst({
        where: { tournamentId: req.params.id, name: sTeam.name },
      });

      if (!tTeam) {
        tTeam = await prisma.tournamentTeam.create({
          data: {
            tournamentId: req.params.id,
            name: sTeam.name,
            sortOrder: sTeam.sortOrder,
          },
        });
        createdTeams++;
      }

      for (const m of sTeam.members) {
        try {
          await prisma.tournamentTeamMember.create({
            data: {
              tournamentId: req.params.id,
              teamId: tTeam!.id,
              playerId: m.playerId,
            },
          });
          addedMembers++;
        } catch {
          // Eindeutigkeit pro Turnier/Spieler: bereits zugeordnet -> überspringen.
        }
      }
    }

    res.json({ createdTeams, addedMembers });
  }
);

router.post("/:id/generate-group-matches", async (req, res) => {
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  const t = await loadTournamentById(req.params.id);
  if (!t) {
    res.status(404).json({ error: "Turnier nicht gefunden" });
    return;
  }
  const teamsWithMembers = t.teams.filter((team) => team.members.length > 0);
  const sortedTeams = [...teamsWithMembers].sort((a, b) =>
    a.sortOrder !== b.sortOrder
      ? a.sortOrder - b.sortOrder
      : a.name.localeCompare(b.name)
  );
  const teamIds = sortedTeams.map((tm) => tm.id);
  if (teamIds.length < 2)
  {
    res.status(400).json({
      error:
        "Für Gruppenspiele werden mindestens zwei Mannschaften mit Spielern benötigt.",
    });
    return;
  }

  await prisma.match.deleteMany({
    where: { tournamentId: t.id, phase: MatchPhase.GROUP },
  });

  await prisma.tournamentTeam.updateMany({
    where: { tournamentId: t.id },
    data: { groupLabel: null },
  });

  const gc = t.groupCount;
  const groups = gc > 1
    ? distributeIntoGroups(teamIds, gc)
    : [{ label: "A", teamIds }];

  for (const group of groups)
  {
    await prisma.tournamentTeam.updateMany({
      where: { id: { in: group.teamIds }, tournamentId: t.id },
      data: { groupLabel: gc > 1 ? group.label : null },
    });
  }

  let globalSlot = 0;
  for (const group of groups)
  {
    const schedule = generateRoundRobinSchedule(group.teamIds);
    for (const m of schedule)
    {
      await prisma.match.create({
        data: {
          tournamentId: t.id,
          phase: MatchPhase.GROUP,
          groupLabel: gc > 1 ? group.label : null,
          roundOrder: m.round,
          slotIndex: globalSlot++,
          homeTeamId: m.home,
          awayTeamId: m.away,
          status: MatchStatus.SCHEDULED,
        },
      });
    }
  }

  await prisma.tournament.update({
    where: { id: t.id },
    data: { phase: TournamentPhase.GROUP },
  });

  const full = await loadTournamentById(t.id);
  res.json(serializeTournamentDetail(full!));
});

router.post("/:id/generate-knockout", async (req, res) => {
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  const t = await loadTournamentById(req.params.id);
  if (!t)
  {
    res.status(404).json({ error: "Turnier nicht gefunden" });
    return;
  }
  if (t.mode !== TournamentMode.DIRECT_KO)
  {
    res.status(400).json({ error: "K.O.-Generierung nur für Direkt-K.O.-Turniere" });
    return;
  }
  const sortedTeams = [...t.teams].sort((a, b) =>
    a.sortOrder !== b.sortOrder
      ? a.sortOrder - b.sortOrder
      : a.name.localeCompare(b.name)
  );
  if (sortedTeams.length < 2)
  {
    res.status(400).json({ error: "Mindestens 2 Mannschaften für K.O. benötigt" });
    return;
  }

  await prisma.match.deleteMany({ where: { tournamentId: t.id } });

  const { phase, tournamentPhase, matches } = generateKoBracketFirstRound(
    sortedTeams.map((tm) => tm.id)
  );

  for (const m of matches)
  {
    await prisma.match.create({
      data: {
        tournamentId: t.id,
        phase: m.phase,
        roundOrder: m.roundOrder,
        slotIndex: m.roundOrder,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        status: MatchStatus.SCHEDULED,
      },
    });
  }

  await prisma.tournament.update({
    where: { id: t.id },
    data: { phase: tournamentPhase },
  });

  const full = await loadTournamentById(t.id);
  res.json(serializeTournamentDetail(full!));
});

router.delete("/:id/matches", async (req, res) => {
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  const t = await loadTournamentById(req.params.id);
  if (!t)
  {
    res.status(404).json({ error: "Turnier nicht gefunden" });
    return;
  }
  await prisma.match.deleteMany({ where: { tournamentId: t.id } });
  await prisma.tournamentTeam.updateMany({
    where: { tournamentId: t.id },
    data: { groupLabel: null },
  });
  await prisma.tournament.update({
    where: { id: t.id },
    data: { phase: TournamentPhase.GROUP },
  });
  const full = await loadTournamentById(t.id);
  res.json(serializeTournamentDetail(full!));
});

router.get("/:id/standings", async (req, res) => {
  const t = await loadTournamentById(req.params.id);
  if (!t)
  {
    res.status(404).json({ error: "Turnier nicht gefunden" });
    return;
  }

  const teamsById = new Map(
    t.teams.map((tm) => [tm.id, { id: tm.id, name: tm.name }] as const)
  );
  const groupMatches = t.matches.filter((m) => m.phase === MatchPhase.GROUP);

  if (t.groupCount > 1)
  {
    const labels = [...new Set(t.teams.map((tm) => tm.groupLabel).filter(Boolean))] as string[];
    labels.sort();
    const groups: Record<string, ReturnType<typeof computePoolStandings>> = {};
    for (const label of labels)
    {
      const gTeamIds = t.teams
        .filter((tm) => tm.groupLabel === label)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((tm) => tm.id);
      const gMatches = groupMatches.filter((m) => m.groupLabel === label);
      groups[`Gruppe ${label}`] = computePoolStandings(gTeamIds, teamsById, gMatches);
    }
    res.json({ groups });
    return;
  }

  const teamIds = [...t.teams]
    .sort((a, b) =>
      a.sortOrder !== b.sortOrder
        ? a.sortOrder - b.sortOrder
        : a.name.localeCompare(b.name)
    )
    .map((tm) => tm.id);
  const rows = computePoolStandings(teamIds, teamsById, groupMatches);
  const label = t.mode === TournamentMode.ROUND_ROBIN ? "Jeder gegen Jeden" : "Gruppenspiele";
  res.json({ groups: { [label]: rows } });
});

const advanceSchema = z.object({
  target: z.enum(["ROUND_OF_16", "QUARTER", "SEMI", "FINAL", "COMPLETED"]),
});

router.post("/:id/advance", async (req, res) => {
  const parsed = advanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Zielphase" });
    return;
  }
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  const t = await loadTournamentById(req.params.id);
  if (!t) {
    res.status(404).json({ error: "Turnier nicht gefunden" });
    return;
  }
  if (parsed.data.target === "COMPLETED")
  {
    await prisma.tournament.update({
      where: { id: t.id },
      data: { phase: TournamentPhase.COMPLETED },
    });
    const full = await loadTournamentById(t.id);
    res.json(serializeTournamentDetail(full!));
    return;
  }
  try
  {
    const result = await advanceTournamentPhase(
      prisma,
      {
        ...t,
        teams: t.teams.map((tm) => ({
          id: tm.id,
          name: tm.name,
          sortOrder: tm.sortOrder,
          groupLabel: tm.groupLabel,
        })),
        matches: t.matches,
      },
      parsed.data.target as "ROUND_OF_16" | "QUARTER" | "SEMI" | "FINAL"
    );
    const full = await loadTournamentById(t.id);
    res.json({
      ...serializeTournamentDetail(full!),
      notices: result.notices,
    });
    return;
  }
  catch (e)
  {
    const msg = e instanceof Error ? e.message : "Fehler";
    res.status(400).json({ error: msg });
    return;
  }
});

const scoresSchema = z.object({
  homeScore: z.number().int().min(0).optional(),
  awayScore: z.number().int().min(0).optional(),
});

router.patch("/:id/matches/:matchId/scores", async (req, res) => {
  const parsed = scoresSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Ergebnisse" });
    return;
  }
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  const m = await prisma.match.findFirst({
    where: { id: req.params.matchId, tournamentId: req.params.id },
  });
  if (!m) {
    res.status(404).json({ error: "Spiel nicht gefunden" });
    return;
  }
  const updated = await prisma.match.update({
    where: { id: m.id },
    data: {
      ...(parsed.data.homeScore !== undefined
        ? { homeScore: parsed.data.homeScore }
        : {}),
      ...(parsed.data.awayScore !== undefined
        ? { awayScore: parsed.data.awayScore }
        : {}),
    },
    include: matchUpdateInclude,
  });
  res.json(serializeMatch(updated as MatchWithTeams));
});

const timerSchema = z.object({
  action: z.enum(["start", "pause", "resume", "end", "cancel"]),
});

router.post("/:id/matches/:matchId/timer", async (req, res) => {
  const parsed = timerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Aktion" });
    return;
  }
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  const m = await prisma.match.findFirst({
    where: { id: req.params.matchId, tournamentId: req.params.id },
  });
  if (!m) {
    res.status(404).json({ error: "Spiel nicht gefunden" });
    return;
  }

  const now = new Date();
  const action = parsed.data.action;

  if (action === "start") {
    if (m.status !== MatchStatus.SCHEDULED && m.status !== MatchStatus.CANCELLED) {
      res.status(400).json({ error: "Spiel kann nur von „Geplant“ gestartet werden" });
      return;
    }
    const updated = await prisma.match.update({
      where: { id: m.id },
      data: {
        status: MatchStatus.LIVE,
        matchStartedAt: now,
        totalPausedMs: 0,
        pausedAt: null,
        elapsedSnapshotMs: null,
      },
      include: matchUpdateInclude,
    });
    res.json(serializeMatch(updated as MatchWithTeams));
    return;
  }

  if (action === "pause") {
    if (m.status !== MatchStatus.LIVE) {
      res.status(400).json({ error: "Nur laufende Spiele können pausiert werden" });
      return;
    }
    const updated = await prisma.match.update({
      where: { id: m.id },
      data: { status: MatchStatus.PAUSED, pausedAt: now },
      include: matchUpdateInclude,
    });
    res.json(serializeMatch(updated as MatchWithTeams));
    return;
  }

  if (action === "resume") {
    if (m.status !== MatchStatus.PAUSED || !m.pausedAt) {
      res.status(400).json({ error: "Spiel ist nicht pausiert" });
      return;
    }
    const extra = now.getTime() - m.pausedAt.getTime();
    const updated = await prisma.match.update({
      where: { id: m.id },
      data: {
        status: MatchStatus.LIVE,
        totalPausedMs: m.totalPausedMs + extra,
        pausedAt: null,
      },
      include: matchUpdateInclude,
    });
    res.json(serializeMatch(updated as MatchWithTeams));
    return;
  }

  if (action === "end") {
    if (
      m.status !== MatchStatus.LIVE
      && m.status !== MatchStatus.PAUSED
      && m.status !== MatchStatus.SCHEDULED
    ) {
      res.status(400).json({ error: "Spiel kann so nicht beendet werden" });
      return;
    }
    const snap = computeElapsedMs(m, now);
    const updated = await prisma.match.update({
      where: { id: m.id },
      data: {
        status: MatchStatus.FINISHED,
        elapsedSnapshotMs: snap,
        pausedAt: null,
      },
      include: matchUpdateInclude,
    });
    res.json(serializeMatch(updated as MatchWithTeams));
    return;
  }

  if (action === "cancel") {
    const snap =
      m.matchStartedAt && (m.status === MatchStatus.LIVE || m.status === MatchStatus.PAUSED)
        ? computeElapsedMs(m, now)
        : 0;
    const updated = await prisma.match.update({
      where: { id: m.id },
      data: {
        status: MatchStatus.CANCELLED,
        elapsedSnapshotMs: snap,
        pausedAt: null,
      },
      include: matchUpdateInclude,
    });
    res.json(serializeMatch(updated as MatchWithTeams));
    return;
  }

  res.status(400).json({ error: "Unbekannte Aktion" });
});

export default router;
