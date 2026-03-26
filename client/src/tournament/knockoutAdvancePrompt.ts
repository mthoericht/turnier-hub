export type KnockoutAdvancePrompt =
  | { kind: "confirm"; message: string }
  | { kind: "toastInfo"; message: string };

export type KnockoutAdvancePromptArgs = {
  phaseLabel: string;
  alreadyGenerated: boolean;
  pointsGiven: boolean;
  risks: boolean;
};

/**
 * Selects the user interaction needed before rebuilding knockout phases.
 *
 * This is intentionally kept pure so unit tests can validate the messaging.
 */
export function buildKnockoutAdvancePrompt(
  args: KnockoutAdvancePromptArgs
): KnockoutAdvancePrompt | null
{
  const { phaseLabel, alreadyGenerated, pointsGiven, risks } = args;

  if (alreadyGenerated)
  {
    if (risks)
    {
      if (pointsGiven)
      {
        return {
          kind: "confirm",
          message:
            `Die K.-o.-Runde ${phaseLabel} wurde bereits erzeugt und es wurden bereits Punkte vergeben. `
            + "Dabei werden bestehende Ergebnisse/Spielstände in dieser und allen folgenden K.-o.-Runden gelöscht oder überschrieben. "
            + "Fortfahren?",
        };
      }
      return {
        kind: "confirm",
        message:
          `Die K.-o.-Runde ${phaseLabel} wurde bereits erzeugt. `
          + "Dabei werden diese und alle folgenden K.-o.-Runden gelöscht und neu generiert. "
          + "Fortfahren?",
      };
    }

    return {
      kind: "toastInfo",
      message: pointsGiven
        ? `Die K.-o.-Runde ${phaseLabel} wurde bereits erzeugt und Punkte wurden vergeben.`
        : `Die K.-o.-Runde ${phaseLabel} wurde bereits erzeugt und wird neu generiert.`,
    };
  }

  if (risks)
  {
    return {
      kind: "confirm",
      message:
        "Es gibt bereits Ergebnisse oder Spielstände in K.-o.-Runden, die dabei "
        + "gelöscht oder überschrieben werden. Fortfahren?",
    };
  }

  return null;
}

