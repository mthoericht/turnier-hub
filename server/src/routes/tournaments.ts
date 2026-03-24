import { Router, type Response } from "express";
import { z } from "zod";
import { MatchPhase, MatchStatus, TournamentPhase, type Match } from "@prisma/client";
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

const router = Router();
router.use(authMiddleware);

const phaseOrder: Record<MatchPhase, number> = {
  GROUP: 0,
  QUARTER: 1,
  SEMI: 2,
  FINAL: 3,
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
  advancesPerGroup: z.number().int().min(1).max(8).optional(),
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
  const t = await prisma.tournament.create({
    data: {
      name: parsed.data.name,
      sport: parsed.data.sport,
      userId: req.userId!,
      advancesPerGroup: parsed.data.advancesPerGroup ?? 2,
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
  const [memCount, mCount] = await Promise.all([
    prisma.tournamentTeamMember.count({ where: { teamId: req.params.teamId } }),
    prisma.match.count({
      where: {
        OR: [
          { homeTeamId: req.params.teamId },
          { awayTeamId: req.params.teamId },
        ],
      },
    }),
  ]);
  if (memCount > 0 || mCount > 0) {
    res.status(400).json({
      error:
        "Mannschaft ist noch belegt (Kader oder Spiele). Entferne zuerst Spieler bzw. Spiele.",
    });
    return;
  }
  await prisma.tournamentTeam.delete({ where: { id: req.params.teamId } });
  res.status(204).send();
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

const STANDINGS_GROUP_KEY = "Vorrunde";

router.post("/:id/generate-group-matches", async (req, res) => {
  const owned = await requireTournamentOwner(res, req.params.id, req.userId!);
  if (!owned) return;
  const t = await loadTournamentById(req.params.id);
  if (!t) {
    res.status(404).json({ error: "Turnier nicht gefunden" });
    return;
  }
  const teamIds = [...t.teams]
    .sort((a, b) =>
      a.sortOrder !== b.sortOrder
        ? a.sortOrder - b.sortOrder
        : a.name.localeCompare(b.name)
    )
    .map((tm) => tm.id);
  if (teamIds.length < 2) {
    res.status(400).json({
      error:
        "Für die Vorrunde werden mindestens zwei Mannschaften benötigt (Jeder gegen Jeden).",
    });
    return;
  }

  await prisma.match.deleteMany({
    where: { tournamentId: t.id, phase: MatchPhase.GROUP },
  });

  let slot = 0;
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      await prisma.match.create({
        data: {
          tournamentId: t.id,
          phase: MatchPhase.GROUP,
          slotIndex: slot++,
          homeTeamId: teamIds[i]!,
          awayTeamId: teamIds[j]!,
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

router.get("/:id/standings", async (req, res) => {
  const t = await loadTournamentById(req.params.id);
  if (!t) {
    res.status(404).json({ error: "Turnier nicht gefunden" });
    return;
  }
  const teamIds = [...t.teams]
    .sort((a, b) =>
      a.sortOrder !== b.sortOrder
        ? a.sortOrder - b.sortOrder
        : a.name.localeCompare(b.name)
    )
    .map((tm) => tm.id);
  const teamsById = new Map(
    t.teams.map((tm) => [tm.id, { id: tm.id, name: tm.name }] as const)
  );
  const groupMatches = t.matches.filter((m) => m.phase === MatchPhase.GROUP);
  const rows = computePoolStandings(teamIds, teamsById, groupMatches);
  res.json({ groups: { [STANDINGS_GROUP_KEY]: rows } });
});

const advanceSchema = z.object({
  target: z.enum(["QUARTER", "SEMI", "FINAL"]),
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
  try {
    await advanceTournamentPhase(
      prisma,
      {
        ...t,
        teams: t.teams.map((tm) => ({
          id: tm.id,
          name: tm.name,
          sortOrder: tm.sortOrder,
        })),
        matches: t.matches,
      },
      parsed.data.target
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    res.status(400).json({ error: msg });
    return;
  }
  const full = await loadTournamentById(t.id);
  res.json(serializeTournamentDetail(full!));
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
