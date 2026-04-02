import { describe, expect, it } from "vitest";
import { pickQualifiersWithRandomPointsTie } from "../../../server/src/services/advancePhase.js";

type Row = {
  teamId: string;
  team: { id: string; name: string };
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

function row(
  teamId: string,
  name: string,
  points: number,
  goalsFor = 0,
  goalsAgainst = 0
): Row
{
  return {
    teamId,
    team: { id: teamId, name },
    points,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor,
    goalsAgainst,
  };
}

describe("advancePhase tie-break selection", () =>
{
  it("keeps deterministic selection for same tournament and inputs", () =>
  {
    const table: Row[] = [
      row("a", "A", 10, 10, 4),
      row("b", "B", 9, 7, 4),
      // three teams vollständig gleichauf an der Grenze:
      row("c", "C", 9, 6, 4),
      row("d", "D", 9, 6, 4),
      row("e", "E", 9, 6, 4),
      row("f", "F", 5, 4, 7),
    ];

    const first = pickQualifiersWithRandomPointsTie(
      "tournament-1",
      table,
      4,
      "Gruppe A"
    );
    const second = pickQualifiersWithRandomPointsTie(
      "tournament-1",
      table,
      4,
      "Gruppe A"
    );

    expect(first.teamIds).toEqual(second.teamIds);
    expect(first.notices.length).toBe(1);
  });

  it("returns top teams directly when there is no boundary tie", () =>
  {
    const table: Row[] = [
      row("a", "A", 12),
      row("b", "B", 9),
      row("c", "C", 6),
      row("d", "D", 3),
    ];
    const picked = pickQualifiersWithRandomPointsTie(
      "tournament-2",
      table,
      2,
      "Gruppe B"
    );

    expect(picked.teamIds).toEqual(["a", "b"]);
    expect(picked.notices).toEqual([]);
  });

  it("does not randomize when goal difference and goals scored break the tie", () =>
  {
    const table: Row[] = [
      row("a", "Alpha", 10, 10, 4), // klar vorne
      row("b", "Bravo", 9, 8, 4), // bessere GD als Charlie/Delta
      row("c", "Charlie", 9, 7, 5), // schlechter als Bravo
      row("d", "Delta", 9, 6, 5), // noch schlechter
      row("e", "Echo", 5, 4, 7),
    ];

    const picked = pickQualifiersWithRandomPointsTie(
      "tournament-3",
      table,
      3,
      "Gruppe C"
    );

    // Kein Zufallsverfahren, reine Tabellenreihenfolge entscheidet
    expect(picked.teamIds).toEqual(["a", "b", "c"]);
    expect(picked.notices).toEqual([]);
  });

  it("randomizes only within a fully equal cluster at the boundary", () =>
  {
    const table: Row[] = [
      row("a", "Alpha", 10, 10, 4),
      row("b", "Bravo", 9, 7, 4),
      // zwei Teams komplett gleichauf am Cutoff:
      row("c", "Charlie", 9, 6, 4),
      row("d", "Delta", 9, 6, 4),
      row("e", "Echo", 5, 4, 7),
    ];

    const picked = pickQualifiersWithRandomPointsTie(
      "tournament-4",
      table,
      3,
      "Gruppe D"
    );

    // Alpha und Bravo müssen immer gesetzt sein.
    expect(picked.teamIds.slice(0, 2)).toEqual(["a", "b"]);
    // Der dritte Platz ist deterministisch, aber entweder Charlie oder Delta.
    expect(["c", "d"]).toContain(picked.teamIds[2]);
    expect(picked.notices.length).toBe(1);
  });
});
