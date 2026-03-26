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

function row(teamId: string, name: string, points: number): Row
{
  return {
    teamId,
    team: { id: teamId, name },
    points,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };
}

describe("advancePhase tie-break selection", () =>
{
  it("keeps deterministic selection for same tournament and inputs", () =>
  {
    const table: Row[] = [
      row("a", "A", 10),
      row("b", "B", 9),
      row("c", "C", 9),
      row("d", "D", 9),
      row("e", "E", 5),
    ];

    const first = pickQualifiersWithRandomPointsTie(
      "tournament-1",
      table,
      3,
      "Gruppe A"
    );
    const second = pickQualifiersWithRandomPointsTie(
      "tournament-1",
      table,
      3,
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
});
