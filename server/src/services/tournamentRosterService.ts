import { prisma } from "../db.js";
import { playerApiInclude, playerToApi } from "../lib/createdBy.js";
import {
  loadTournamentById,
  serializeTournamentDetail,
} from "../routes/tournaments/shared.js";
import { ServiceError } from "./ServiceError.js";

export async function createTeam(
  tournamentId: string,
  name: string,
  sortOrder?: number,
)
{
  const maxRow = await prisma.tournamentTeam.aggregate({
    where: { tournamentId },
    _max: { sortOrder: true },
  });
  const resolvedSortOrder = sortOrder ?? (maxRow._max.sortOrder ?? -1) + 1;
  try
  {
    const team = await prisma.tournamentTeam.create({
      data: {
        tournamentId,
        name,
        sortOrder: resolvedSortOrder,
      },
    });
    return {
      id: team.id,
      name: team.name,
      sortOrder: team.sortOrder,
    };
  }
  catch
  {
    throw new ServiceError("Mannschaftsname im Turnier schon vergeben", 409);
  }
}

export async function patchTeam(
  tournamentId: string,
  teamId: string,
  data: { name?: string; sortOrder?: number },
)
{
  const existing = await prisma.tournamentTeam.findFirst({
    where: { id: teamId, tournamentId },
  });
  if (!existing)
  {
    throw new ServiceError("Mannschaft nicht gefunden", 404);
  }
  try
  {
    const team = await prisma.tournamentTeam.update({
      where: { id: teamId },
      data: {
        ...(data.name != null ? { name: data.name.trim() } : {}),
        ...(data.sortOrder !== undefined
          ? { sortOrder: data.sortOrder }
          : {}),
      },
    });
    return {
      id: team.id,
      name: team.name,
      sortOrder: team.sortOrder,
    };
  }
  catch
  {
    throw new ServiceError("Mannschaftsname im Turnier schon vergeben", 409);
  }
}

export async function deleteTeam(
  tournamentId: string,
  teamId: string,
  teamsAreIndividuals: boolean,
)
{
  const existing = await prisma.tournamentTeam.findFirst({
    where: { id: teamId, tournamentId },
  });
  if (!existing)
  {
    throw new ServiceError("Mannschaft nicht gefunden", 404);
  }
  const [memCount, teamMatches] = await Promise.all([
    prisma.tournamentTeamMember.count({ where: { teamId } }),
    prisma.match.findMany({
      where: {
        tournamentId,
        OR: [
          { homeTeamId: teamId },
          { awayTeamId: teamId },
        ],
      },
      select: { id: true, status: true, phase: true },
    }),
  ]);
  const removableGroupMatchIds = teamMatches
    .filter((m) => m.phase === "GROUP")
    .map((m) => m.id);
  const blockingMatchCount = teamMatches.length - removableGroupMatchIds.length;

  if (blockingMatchCount > 0)
  {
    throw new ServiceError(
      "Mannschaft ist noch in K.-o.-Spielen enthalten. "
      + "Bitte diese Spiele zuerst löschen oder zurücksetzen.",
    );
  }

  if (memCount > 0)
  {
    if (!teamsAreIndividuals)
    {
      throw new ServiceError(
        "Mannschaft ist noch belegt (Kader). Entferne zuerst Spieler aus der Mannschaft.",
      );
    }
    await prisma.tournamentTeamMember.deleteMany({
      where: { tournamentId, teamId },
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
    await prisma.tournamentTeam.delete({ where: { id: teamId } });
  }
  catch
  {
    throw new ServiceError(
      "Mannschaft konnte nicht gelöscht werden. Bitte prüfe vorhandene Zuordnungen.",
    );
  }
  return {
    deletedTeamId: teamId,
    removedGroupMatches: removableGroupMatchIds.length,
  };
}

export async function renameGroup(
  tournamentId: string,
  oldLabel: string,
  newLabel: string,
)
{
  if (oldLabel === newLabel)
  {
    const full = await loadTournamentById(tournamentId);
    return serializeTournamentDetail(full!);
  }
  const existingNew = await prisma.tournamentTeam.count({
    where: {
      tournamentId,
      groupLabel: newLabel,
    },
  });
  if (existingNew > 0)
  {
    throw new ServiceError("Gruppenname bereits vorhanden", 409);
  }
  await prisma.$transaction([
    prisma.tournamentTeam.updateMany({
      where: { tournamentId, groupLabel: oldLabel },
      data: { groupLabel: newLabel },
    }),
    prisma.match.updateMany({
      where: { tournamentId, phase: "GROUP", groupLabel: oldLabel },
      data: { groupLabel: newLabel },
    }),
  ]);
  const full = await loadTournamentById(tournamentId);
  return serializeTournamentDetail(full!);
}

export async function addMember(
  tournamentId: string,
  teamId: string,
  playerId: string,
)
{
  const team = await prisma.tournamentTeam.findFirst({
    where: { id: teamId, tournamentId },
  });
  if (!team)
  {
    throw new ServiceError("Mannschaft nicht gefunden", 404);
  }
  const player = await prisma.player.findFirst({
    where: { id: playerId },
    include: playerApiInclude,
  });
  if (!player)
  {
    throw new ServiceError("Spieler nicht gefunden", 404);
  }
  try
  {
    const row = await prisma.tournamentTeamMember.create({
      data: {
        tournamentId,
        teamId,
        playerId,
      },
      include: {
        player: { include: playerApiInclude },
      },
    });
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      teamId: row.teamId,
      playerId: row.playerId,
      player: playerToApi(row.player),
    };
  }
  catch
  {
    throw new ServiceError(
      "Spieler ist bereits einem Kader in diesem Turnier zugeordnet",
      409,
    );
  }
}

export async function removeMember(
  tournamentId: string,
  teamId: string,
  playerId: string,
): Promise<void>
{
  await prisma.tournamentTeamMember.deleteMany({
    where: {
      tournamentId,
      teamId,
      playerId,
    },
  });
}

export async function transferKader(
  targetTournamentId: string,
  sourceTournamentId: string,
  overwriteExistingMembers: boolean,
)
{
  const sourceTournament = await prisma.tournament.findUnique({
    where: { id: sourceTournamentId },
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

  if (!sourceTournament)
  {
    throw new ServiceError("Quell-Turnier nicht gefunden", 404);
  }

  if (overwriteExistingMembers)
  {
    await prisma.tournamentTeamMember.deleteMany({
      where: { tournamentId: targetTournamentId },
    });
  }

  let createdTeams = 0;
  let addedMembers = 0;

  for (const sTeam of sourceTournament.teams)
  {
    let tTeam = await prisma.tournamentTeam.findFirst({
      where: { tournamentId: targetTournamentId, name: sTeam.name },
    });

    if (!tTeam)
    {
      tTeam = await prisma.tournamentTeam.create({
        data: {
          tournamentId: targetTournamentId,
          name: sTeam.name,
          sortOrder: sTeam.sortOrder,
        },
      });
      createdTeams++;
    }

    for (const m of sTeam.members)
    {
      try
      {
        await prisma.tournamentTeamMember.create({
          data: {
            tournamentId: targetTournamentId,
            teamId: tTeam!.id,
            playerId: m.playerId,
          },
        });
        addedMembers++;
      }
      catch
      {
        // Eindeutigkeit pro Turnier/Spieler: bereits zugeordnet -> überspringen.
      }
    }
  }

  return { createdTeams, addedMembers };
}
