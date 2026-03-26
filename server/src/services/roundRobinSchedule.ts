export type RoundRobinMatch = {
  round: number;
  home: string;
  away: string;
};

/**
 * Generates a round-robin schedule using the circle method.
 *
 * Produces `n-1` rounds for even team count or `n` rounds for odd team count,
 * where each round can be played in parallel.
 */
export function generateRoundRobinSchedule(
  teamIds: string[]
): RoundRobinMatch[]
{
  const n = teamIds.length;
  if (n < 2) return [];

  const BYE = "__BYE__";
  const teams = [...teamIds];
  if (n % 2 !== 0) teams.push(BYE);

  const total = teams.length;
  const half = total / 2;
  const matches: RoundRobinMatch[] = [];

  const circle = teams.slice(1);

  for (let round = 0; round < total - 1; round++)
  {
    if (teams[0] !== BYE && circle[0] !== BYE)
    {
      matches.push({
        round,
        home: round % 2 === 0 ? teams[0]! : circle[0]!,
        away: round % 2 === 0 ? circle[0]! : teams[0]!,
      });
    }

    for (let i = 1; i < half; i++)
    {
      const t1 = circle[i]!;
      const t2 = circle[circle.length - i]!;
      if (t1 !== BYE && t2 !== BYE)
      {
        matches.push({ round, home: t1, away: t2 });
      }
    }

    circle.unshift(circle.pop()!);
  }

  return matches;
}

/**
 * Randomly distributes team ids into labeled groups (`A`, `B`, `C`, ...).
 */
export function distributeIntoGroups(
  teamIds: string[],
  groupCount: number
): { label: string; teamIds: string[] }[]
{
  const shuffled = [...teamIds];
  for (let i = shuffled.length - 1; i > 0; i--)
  {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  const groups: { label: string; teamIds: string[] }[] = [];
  for (let g = 0; g < groupCount; g++)
  {
    groups.push({ label: String.fromCharCode(65 + g), teamIds: [] });
  }

  for (let i = 0; i < shuffled.length; i++)
  {
    groups[i % groupCount]!.teamIds.push(shuffled[i]!);
  }

  return groups;
}
