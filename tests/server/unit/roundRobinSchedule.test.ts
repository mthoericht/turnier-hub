import { describe, expect, it } from "vitest";
import {
  distributeIntoGroups,
  generateRoundRobinSchedule,
} from "../../../server/src/services/roundRobinSchedule.js";

describe("roundRobinSchedule", () =>
{
  it("creates complete pairings for even team count", () =>
  {
    const teams = ["A", "B", "C", "D"];
    const schedule = generateRoundRobinSchedule(teams);

    expect(schedule).toHaveLength(6);
    const pairs = new Set(
      schedule.map((m) => [m.home, m.away].sort().join("-"))
    );
    expect(pairs.size).toBe(6);
  });

  it("creates complete pairings for odd team count", () =>
  {
    const teams = ["A", "B", "C", "D", "E"];
    const schedule = generateRoundRobinSchedule(teams);

    expect(schedule).toHaveLength(10);
    const pairs = new Set(
      schedule.map((m) => [m.home, m.away].sort().join("-"))
    );
    expect(pairs.size).toBe(10);
  });

  it("distributes teams into balanced groups", () =>
  {
    const groups = distributeIntoGroups(
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      3
    );

    expect(groups).toHaveLength(3);
    const sizes = groups.map((g) => g.teamIds.length).sort((a, b) => a - b);
    expect(sizes[2] - sizes[0]).toBeLessThanOrEqual(1);
    const all = groups.flatMap((g) => g.teamIds);
    expect(new Set(all).size).toBe(8);
  });
});
