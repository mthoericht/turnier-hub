import { describe, expect, it } from "vitest";
import { buildKnockoutAdvancePrompt } from "../../../client/src/tournament/knockoutAdvancePrompt.js";

describe("knockoutAdvancePrompt", () =>
{
  it("asks for confirm and includes points when already generated + points + risks", () =>
  {
    const prompt = buildKnockoutAdvancePrompt({
      phaseLabel: "Viertelfinale",
      alreadyGenerated: true,
      pointsGiven: true,
      risks: true,
    });

    expect(prompt).not.toBeNull();
    if (!prompt) return;
    expect(prompt.kind).toBe("confirm");
    if (prompt.kind !== "confirm") return;
    expect(prompt.message).toContain("Punkte vergeben");
  });

  it("asks for confirm when already generated + risks (no points)", () =>
  {
    const prompt = buildKnockoutAdvancePrompt({
      phaseLabel: "Halbfinale",
      alreadyGenerated: true,
      pointsGiven: false,
      risks: true,
    });

    expect(prompt).not.toBeNull();
    if (!prompt) return;
    expect(prompt.kind).toBe("confirm");
    if (prompt.kind !== "confirm") return;
    expect(prompt.message).toContain("wurde bereits erzeugt");
    expect(prompt.message).not.toContain("Punkte vergeben");
  });

  it("shows info toast when already generated + points but no risks", () =>
  {
    const prompt = buildKnockoutAdvancePrompt({
      phaseLabel: "Finale",
      alreadyGenerated: true,
      pointsGiven: true,
      risks: false,
    });

    expect(prompt).not.toBeNull();
    if (!prompt) return;
    expect(prompt.kind).toBe("toastInfo");
    if (prompt.kind !== "toastInfo") return;
    expect(prompt.message).toContain("Punkte wurden vergeben");
  });

  it("asks for confirm when risks exist but it was not generated yet", () =>
  {
    const prompt = buildKnockoutAdvancePrompt({
      phaseLabel: "Finale",
      alreadyGenerated: false,
      pointsGiven: false,
      risks: true,
    });

    expect(prompt).not.toBeNull();
    if (!prompt) return;
    expect(prompt.kind).toBe("confirm");
    if (prompt.kind !== "confirm") return;
    expect(prompt.message).toContain("gelöscht oder überschrieben");
  });

  it("returns null when there are no risks and nothing was generated yet", () =>
  {
    const prompt = buildKnockoutAdvancePrompt({
      phaseLabel: "Finale",
      alreadyGenerated: false,
      pointsGiven: false,
      risks: false,
    });
    expect(prompt).toBeNull();
  });
});

