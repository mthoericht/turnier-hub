import { ref, watch, type Ref } from "vue";
import type { TournamentLayoutContext } from "@/tournament/tournamentContext";
import { fetchTournaments, type TournamentListRow } from "@/api/tournamentsApi";

type RosterTransferDeps = Pick<
  TournamentLayoutContext,
  "tournament" | "transferKaderFromTournament" | "confirmAction"
>;

export function useTournamentRosterTransfer(
  deps: RosterTransferDeps
): {
  transferFromTournamentId: Ref<string>;
  sourceTournaments: Ref<TournamentListRow[]>;
  loadingSources: Ref<boolean>;
  transferFromSource: () => Promise<void>;
}
{
  const transferFromTournamentId = ref<string>("");
  const sourceTournaments = ref<TournamentListRow[]>([]);
  const loadingSources = ref(false);

  watch(
    deps.tournament,
    async (t) =>
    {
      if (!t) return;
      loadingSources.value = true;
      try
      {
        const own = await fetchTournaments("own");
        sourceTournaments.value = own.filter((x) => x.id !== t.id);
      }
      finally
      {
        loadingSources.value = false;
      }
    },
    { immediate: true }
  );

  async function transferFromSource(): Promise<void>
  {
    if (!transferFromTournamentId.value) return;
    if (!deps.tournament.value) return;

    const hasExistingMembers = deps.tournament.value.teams.some(
      (team) => team.members.length > 0
    );

    if (hasExistingMembers)
    {
      const ok = await deps.confirmAction(
        {
          title: "Kader übertragen",
          description:
            "Im Ziel gibt es bereits Zuordnungen. Spieler, die im Ziel bereits zugeordnet sind, werden übersprungen. Fortfahren?",
          submitLabel: "Fortfahren",
        }
      );
      if (!ok) return;
    }

    await deps.transferKaderFromTournament(transferFromTournamentId.value);
    transferFromTournamentId.value = "";
  }

  return {
    transferFromTournamentId,
    sourceTournaments,
    loadingSources,
    transferFromSource,
  };
}
