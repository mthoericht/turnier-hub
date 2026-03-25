<script setup lang="ts">
import { inject, ref, watch } from "vue";
import { tournamentLayoutKey } from "@/tournament/tournamentContext";
import { formatCreator } from "@/types";
import { fetchTournaments, type TournamentListRow } from "@/api/tournamentsApi";

const ctx = inject(tournamentLayoutKey);
if (!ctx) 
{
  throw new Error("TournamentRosterView must be used inside TournamentLayout");
}

const {
  tournament,
  canEdit,
  newTeamName,
  addMemberTeamId,
  addPlayerId,
  availablePlayers,
  createTeam,
  removeTeam,
  addMember,
  removeMember,
  fieldClass,
  cardClass,
  transferKaderFromTournament,
} = ctx;

const transferFromTournamentId = ref<string>("");
const sourceTournaments = ref<TournamentListRow[]>([]);
const loadingSources = ref(false);

watch(
  tournament,
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

async function transferKaderFromSource(): Promise<void> 
{
  if (!transferFromTournamentId.value) return;
  if (!tournament.value) return;

  const hasExistingMembers = tournament.value.teams.some(
    (team) => team.members.length > 0
  );

  if (hasExistingMembers)
  {
    const ok = confirm(
      "Im Ziel gibt es bereits Kader-Zuordnungen. Spieler, die im Ziel bereits zugeordnet sind, werden übersprungen. Fortfahren?"
    );
    if (!ok) return;
  }

  await transferKaderFromTournament(transferFromTournamentId.value);
  transferFromTournamentId.value = "";
}
</script>

<template>
  <div v-if="tournament" class="space-y-8 sm:space-y-10">
    <section :class="[cardClass, 'space-y-4']">
      <h2
        class="font-display font-semibold text-lg text-slate-900 dark:text-white"
      >
        Mannschaften
      </h2>
      <p class="text-sm text-slate-600 dark:text-slate-500">
        In der Vorrunde spielt jede Mannschaft einmal gegen jede andere
        (Hin- und Rückrunde gibt es nicht — ein Spiel pro Paarung).
      </p>

      <div
        v-if="canEdit"
        class="rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 dark:border-blue-800/60 dark:bg-blue-950/20"
      >
        <h3 class="mb-2 font-display text-sm font-semibold text-slate-900 dark:text-white">
          Kader aus Turnier übertragen
        </h3>
        <p class="mb-3 text-xs text-slate-600 dark:text-slate-400">
          Übernimmt Mannschaften und Kader-Zuordnungen aus einem anderen deiner Turniere.
          Teams werden nach Namen angelegt; Spieler, die im Ziel bereits zugeordnet sind, werden übersprungen.
        </p>
        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
          <div class="min-w-0 flex-1 sm:max-w-xs">
            <label class="mb-1 block text-xs text-slate-600 dark:text-slate-500">
              Von Turnier
            </label>
            <select
              v-model="transferFromTournamentId"
              :disabled="loadingSources || sourceTournaments.length === 0"
              :class="fieldClass"
            >
              <option value="" disabled>Turnier wählen …</option>
              <option
                v-for="t in sourceTournaments"
                :key="t.id"
                :value="t.id"
              >
                {{ t.name }}
              </option>
            </select>
          </div>
          <button
            type="button"
            class="min-h-[44px] rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-600/90 disabled:opacity-50 sm:min-h-0 sm:py-2 sm:text-sm"
            :disabled="
              !transferFromTournamentId || loadingSources || sourceTournaments.length === 0
            "
            @click="transferKaderFromSource"
          >
            Kader übertragen
          </button>
        </div>
      </div>

      <div
        v-if="canEdit"
        class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <input
          v-model="newTeamName"
          type="text"
          maxlength="60"
          placeholder="Name der Mannschaft"
          :class="['min-w-0 flex-1 sm:max-w-xs', fieldClass]"
          @keydown.enter.prevent="createTeam"
        />
        <button
          type="button"
          class="min-h-[48px] rounded-lg border border-slate-300 px-4 py-3 text-base text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 sm:min-h-0 sm:py-2 sm:text-sm"
          @click="createTeam"
        >
          Mannschaft anlegen
        </button>
      </div>

      <ul v-if="tournament.teams.length" class="space-y-4">
        <li
          v-for="team in tournament.teams"
          :key="team.id"
          class="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50"
        >
          <div
            class="mb-2 flex flex-wrap items-center justify-between gap-2"
          >
            <span class="font-semibold text-slate-900 dark:text-white">{{
              team.name
            }}</span>
            <button
              v-if="canEdit"
              type="button"
              class="text-sm text-rose-600 hover:text-rose-700 dark:text-rose-400"
              @click="removeTeam(team.id)"
            >
              Mannschaft löschen
            </button>
          </div>
          <p class="mb-1 text-xs text-slate-500 dark:text-slate-500">Kader</p>
          <ul class="space-y-1 text-sm">
            <li
              v-for="mem in team.members"
              :key="mem.id"
              class="flex flex-wrap items-center justify-between gap-2"
            >
              <span class="text-slate-800 dark:text-slate-200">
                {{ mem.player.name
                }}<span
                  v-if="mem.player.schoolClass"
                  class="text-slate-500 dark:text-slate-500"
                >
                  ({{ mem.player.schoolClass.name }})</span
                >
                <span
                  class="ml-2 text-xs text-slate-500"
                  :title="mem.player.createdBy.email"
                >
                  · {{ formatCreator(mem.player.createdBy) }}
                </span>
              </span>
              <button
                v-if="canEdit"
                type="button"
                class="text-xs text-rose-600 dark:text-rose-400"
                @click="removeMember(team.id, mem.playerId)"
              >
                Aus Kader
              </button>
            </li>
            <li
              v-if="team.members.length === 0"
              class="text-slate-500 dark:text-slate-500"
            >
              Noch keine Spieler
            </li>
          </ul>
        </li>
      </ul>
      <p v-else class="text-sm text-slate-500 dark:text-slate-500">
        Noch keine Mannschaft angelegt.
      </p>

      <h3
        class="border-t border-slate-200 pt-4 font-display font-semibold text-base text-slate-900 dark:border-slate-800 dark:text-white"
      >
        Spieler zum Kader hinzufügen
      </h3>
      <div
        v-if="canEdit"
        class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div class="min-w-0 flex-1 sm:max-w-xs">
          <label class="mb-1 block text-xs text-slate-600 dark:text-slate-500"
            >Mannschaft</label
          >
          <select
            v-model="addMemberTeamId"
            :disabled="tournament.teams.length === 0"
            :class="fieldClass"
          >
            <option value="" disabled>Wählen …</option>
            <option v-for="t in tournament.teams" :key="t.id" :value="t.id">
              {{ t.name }}
            </option>
          </select>
        </div>
        <div class="min-w-0 flex-1 sm:max-w-md">
          <label class="mb-1 block text-xs text-slate-600 dark:text-slate-500"
            >Spieler</label
          >
          <select v-model="addPlayerId" :class="fieldClass">
            <option value="">— wählen —</option>
            <option v-for="p in availablePlayers" :key="p.id" :value="p.id">
              {{ p.name }}{{ p.schoolClass ? ` (${p.schoolClass.name})` : "" }}
            </option>
          </select>
        </div>
        <button
          type="button"
          class="min-h-[48px] rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-600/90 disabled:opacity-50 sm:min-h-0 sm:py-2 sm:text-sm"
          :disabled="
            !addMemberTeamId || !addPlayerId || tournament.teams.length === 0
          "
          @click="addMember"
        >
          In Kader
        </button>
      </div>
      <p v-else class="text-sm text-slate-500 dark:text-slate-500">
        Kader siehst du oben; bearbeiten nur als Ersteller.
      </p>

    </section>
  </div>
</template>
