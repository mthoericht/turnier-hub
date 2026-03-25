import {
  MatchPhase,
  MatchStatus,
  type Match,
  type PrismaClient,
  type Tournament,
  TournamentPhase,
} from "@prisma/client";
import {
  computePoolStandings,
  requireKnockoutWinnerTeamId,
} from "./standings.js";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

function interleavedQuarterPairings(ordered: string[]): [string, string][] {
  if (ordered.length !== 8)
    throw new Error("Viertelfinale benötigt genau 8 Qualifikanten");
  const pairs: [string, string][] = [
    [ordered[0], ordered[7]],
    [ordered[3], ordered[4]],
    [ordered[1], ordered[6]],
    [ordered[2], ordered[5]],
  ];
  return pairs;
}

export type AdvanceTeamRow = { id: string; name: string; sortOrder: number };

export async function advanceTournamentPhase(
  prisma: PrismaClient,
  tournament: Tournament & {
    teams: AdvanceTeamRow[];
    matches: Match[];
  },
  target: "QUARTER" | "SEMI" | "FINAL"
) {
  const teamsSorted = [...tournament.teams].sort((a, b) =>
    a.sortOrder !== b.sortOrder
      ? a.sortOrder - b.sortOrder
      : a.name.localeCompare(b.name)
  );
  const teamIds = teamsSorted.map((t) => t.id);
  const teamsById = new Map(
    tournament.teams.map((t) => [t.id, { id: t.id, name: t.name }] as const)
  );
  const groupMatches = tournament.matches.filter((m) => m.phase === MatchPhase.GROUP);

  const table = computePoolStandings(teamIds, teamsById, groupMatches);
  // Qualifikanten werden für die KO-Runden fest aus der Vorrunden-Tabelle abgeleitet.
  // (Die UI/Server-Seite ignoriert damit advancesPerGroup für die Erzeugung von VF/HF/F.)
  const qualifiersNeeded = target === "QUARTER" ? 8 : target === "SEMI" ? 4 : 2;
  const qualifiers: string[] = table.slice(0, qualifiersNeeded).map((r) => r.teamId);

  if (target === "QUARTER") {
    if (qualifiers.length < 8) {
      throw new Error(
        `Für das Viertelfinale werden 8 qualifizierte Mannschaften benötigt (aktuell: ${qualifiers.length}). Erhöhe die Mannschaftszahl oder die Weiterkommen-Plätze in der Vorrunde.`
      );
    }
    const ordered = qualifiers.slice(0, 8);
    const pairs = interleavedQuarterPairings(ordered);
    await prisma.$transaction(async (tx: Tx) => {
      await tx.match.deleteMany({
        where: {
          tournamentId: tournament.id,
          phase: { in: [MatchPhase.QUARTER, MatchPhase.SEMI, MatchPhase.FINAL] },
        },
      });
      let order = 0;
      for (const [home, away] of pairs) {
        await tx.match.create({
          data: {
            tournamentId: tournament.id,
            phase: MatchPhase.QUARTER,
            roundOrder: order++,
            homeTeamId: home,
            awayTeamId: away,
            status: MatchStatus.SCHEDULED,
          },
        });
      }
      await tx.tournament.update({
        where: { id: tournament.id },
        data: { phase: TournamentPhase.QUARTER },
      });
    });
    return;
  }

  if (target === "SEMI") {
    if (tournament.phase === TournamentPhase.QUARTER) {
      const qf = tournament.matches
        .filter((m) => m.phase === MatchPhase.QUARTER)
        .sort((a, b) => a.roundOrder - b.roundOrder);
      const winners: string[] = [];
      for (const m of qf) {
        if (m.status !== MatchStatus.FINISHED) {
          throw new Error("Alle Viertelfinalspiele müssen beendet sein");
        }
        winners.push(
          requireKnockoutWinnerTeamId(
            m,
            `Viertelfinale (Spiel ${m.roundOrder + 1})`
          )
        );
      }
      if (winners.length !== 4) {
        throw new Error(
          "Nach dem Viertelfinale werden vier Sieger für das Halbfinale benötigt"
        );
      }
      const pairs: [string, string][] = [
        [winners[0]!, winners[3]!],
        [winners[1]!, winners[2]!],
      ];
      await prisma.$transaction(async (tx: Tx) => {
        await tx.match.deleteMany({
          where: {
            tournamentId: tournament.id,
            phase: { in: [MatchPhase.SEMI, MatchPhase.FINAL] },
          },
        });
        let order = 0;
        for (const [home, away] of pairs) {
          await tx.match.create({
            data: {
              tournamentId: tournament.id,
              phase: MatchPhase.SEMI,
              roundOrder: order++,
              homeTeamId: home,
              awayTeamId: away,
              status: MatchStatus.SCHEDULED,
            },
          });
        }
        await tx.tournament.update({
          where: { id: tournament.id },
          data: { phase: TournamentPhase.SEMI },
        });
      });
      return;
    }

    if (qualifiers.length < 4) {
      throw new Error(
        `Für das Halbfinale werden mindestens 4 qualifizierte Mannschaften benötigt (aktuell: ${qualifiers.length}).`
      );
    }

    const q = qualifiers.slice(0, 4);
    const pairs: [string, string][] = [
      [q[0]!, q[3]!],
      [q[1]!, q[2]!],
    ];

    await prisma.$transaction(async (tx: Tx) => {
      await tx.match.deleteMany({
        where: {
          tournamentId: tournament.id,
          phase: { in: [MatchPhase.SEMI, MatchPhase.FINAL] },
        },
      });
      if (tournament.phase === TournamentPhase.GROUP) {
        await tx.match.deleteMany({
          where: { tournamentId: tournament.id, phase: MatchPhase.QUARTER },
        });
      }
      let order = 0;
      for (const [home, away] of pairs) {
        await tx.match.create({
          data: {
            tournamentId: tournament.id,
            phase: MatchPhase.SEMI,
            roundOrder: order++,
            homeTeamId: home,
            awayTeamId: away,
            status: MatchStatus.SCHEDULED,
          },
        });
      }
      await tx.tournament.update({
        where: { id: tournament.id },
        data: { phase: TournamentPhase.SEMI },
      });
    });
    return;
  }

  if (target === "FINAL") {
    const semis = tournament.matches.filter((m) => m.phase === MatchPhase.SEMI);
    const winners: string[] = [];
    for (const m of semis.sort((a, b) => a.roundOrder - b.roundOrder)) {
      if (m.status !== MatchStatus.FINISHED && m.status !== MatchStatus.CANCELLED) {
        throw new Error("Alle Halbfinalspiele müssen beendet oder abgebrochen sein");
      }
      if (m.status === MatchStatus.CANCELLED) continue;
      winners.push(
        requireKnockoutWinnerTeamId(
          m,
          `Halbfinale (Spiel ${m.roundOrder + 1})`
        )
      );
    }

    if (winners.length !== 2) {
      if (qualifiers.length >= 2 && semis.length === 0) {
        const q2 = qualifiers.slice(0, 2);
        await prisma.$transaction(async (tx: Tx) => {
          await tx.match.deleteMany({
            where: { tournamentId: tournament.id, phase: MatchPhase.FINAL },
          });
          await tx.match.create({
            data: {
              tournamentId: tournament.id,
              phase: MatchPhase.FINAL,
              roundOrder: 0,
              homeTeamId: q2[0]!,
              awayTeamId: q2[1]!,
              status: MatchStatus.SCHEDULED,
            },
          });
          await tx.tournament.update({
            where: { id: tournament.id },
            data: { phase: TournamentPhase.FINAL },
          });
        });
        return;
      }
      throw new Error("Für das Finale werden genau zwei Halbfinal-Sieger benötigt");
    }

    await prisma.$transaction(async (tx: Tx) => {
      await tx.match.deleteMany({
        where: { tournamentId: tournament.id, phase: MatchPhase.FINAL },
      });
      await tx.match.create({
        data: {
          tournamentId: tournament.id,
          phase: MatchPhase.FINAL,
          roundOrder: 0,
          homeTeamId: winners[0]!,
          awayTeamId: winners[1]!,
          status: MatchStatus.SCHEDULED,
        },
      });
      await tx.tournament.update({
        where: { id: tournament.id },
        data: { phase: TournamentPhase.FINAL },
      });
    });
  }
}
