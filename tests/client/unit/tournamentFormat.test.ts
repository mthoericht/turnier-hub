import { describe, expect, it } from "vitest";
import {
  formatMatchDurationMs,
  formatMatchStatusLabel,
  formatPhaseLabel,
  formatTournamentMode,
} from "../../../client/src/tournament/tournamentFormat";

describe("tournamentFormat", () =>
{
  it("formats phase labels", () =>
  {
    expect(formatPhaseLabel("GROUP")).toBe("Gruppenspiele");
    expect(formatPhaseLabel("ROUND_OF_16")).toBe("Achtelfinale");
    expect(formatPhaseLabel("UNKNOWN")).toBe("UNKNOWN");
  });

  it("formats match status labels", () =>
  {
    expect(formatMatchStatusLabel("SCHEDULED")).toBe("Geplant");
    expect(formatMatchStatusLabel("LIVE")).toBe("Läuft");
    expect(formatMatchStatusLabel("CANCELLED")).toBe("Abgebrochen");
  });

  it("formats tournament modes", () =>
  {
    expect(formatTournamentMode("GROUP_KO")).toBe("Gruppenspiele + K.O.");
    expect(formatTournamentMode("DIRECT_KO")).toBe("Direkt K.O.");
    expect(formatTournamentMode("ROUND_ROBIN")).toBe("Jeder gegen Jeden");
  });

  it("formats durations with and without hours", () =>
  {
    expect(formatMatchDurationMs(65_000)).toBe("1:05");
    expect(formatMatchDurationMs(3_726_000)).toBe("1:02:06");
  });
});
