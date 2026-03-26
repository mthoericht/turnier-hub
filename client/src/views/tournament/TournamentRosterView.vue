<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import TournamentAddMemberSection from "@/components/tournament/TournamentAddMemberSection.vue";
import { tournamentLayoutKey, type TournamentTeam } from "@/tournament/tournamentContext";
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
  renameTeam,
  renameGroupLabel,
  addMember,
  removeMember,
  fieldClass,
  cardClass,
  transferKaderFromTournament,
} = ctx;

const isIndividuals = computed(() => tournament.value?.teamsAreIndividuals ?? false);

const hasGroups = computed(() =>
  tournament.value?.teams.some((t) => t.groupLabel) ?? false
);

const GROUP_COLORS: Record<string, string> = {
  A: "border-l-blue-500 dark:border-l-blue-400",
  B: "border-l-emerald-500 dark:border-l-emerald-400",
  C: "border-l-amber-500 dark:border-l-amber-400",
  D: "border-l-rose-500 dark:border-l-rose-400",
  E: "border-l-violet-500 dark:border-l-violet-400",
  F: "border-l-cyan-500 dark:border-l-cyan-400",
  G: "border-l-orange-500 dark:border-l-orange-400",
  H: "border-l-pink-500 dark:border-l-pink-400",
};

const GROUP_BG: Record<string, string> = {
  A: "bg-blue-50/50 dark:bg-blue-950/20",
  B: "bg-emerald-50/50 dark:bg-emerald-950/20",
  C: "bg-amber-50/50 dark:bg-amber-950/20",
  D: "bg-rose-50/50 dark:bg-rose-950/20",
  E: "bg-violet-50/50 dark:bg-violet-950/20",
  F: "bg-cyan-50/50 dark:bg-cyan-950/20",
  G: "bg-orange-50/50 dark:bg-orange-950/20",
  H: "bg-pink-50/50 dark:bg-pink-950/20",
};

type GroupedTeams = { label: string; teams: TournamentTeam[] };

const teamsByGroup = computed<GroupedTeams[]>(() =>
{
  if (!tournament.value || !hasGroups.value) return [];
  const map = new Map<string, TournamentTeam[]>();
  for (const team of tournament.value.teams)
  {
    const label = team.groupLabel ?? "–";
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(team);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, teams]) => ({ label, teams }));
});

const transferFromTournamentId = ref<string>("");
const selectedClassId = ref<string>("");
const selectedAddGroupLabel = ref<string>("");
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

async function transferFromSource(): Promise<void>
{
  if (!transferFromTournamentId.value) return;
  if (!tournament.value) return;

  const hasExistingMembers = tournament.value.teams.some(
    (team) => team.members.length > 0
  );

  if (hasExistingMembers)
  {
    const ok = confirm(
      "Im Ziel gibt es bereits Zuordnungen. Spieler, die im Ziel bereits zugeordnet sind, werden übersprungen. Fortfahren?"
    );
    if (!ok) return;
  }

  await transferKaderFromTournament(transferFromTournamentId.value);
  transferFromTournamentId.value = "";
}

async function addIndividualAsTeam(): Promise<void>
{
  if (!addPlayerId.value) return;
  const player = availablePlayers.value.find((p) => p.id === addPlayerId.value);
  if (!player || !tournament.value) return;

  newTeamName.value = player.name;
  await createTeam();

  const t = tournament.value;
  if (!t) return;
  const team = t.teams.find((tm) => tm.name === player.name);
  if (team)
  {
    addMemberTeamId.value = team.id;
    addPlayerId.value = player.id;
    await addMember();
  }
  addPlayerId.value = "";
}

const addMemberGroupOptions = computed(() =>
{
  if (!tournament.value) return [];
  const labels = new Set<string>();
  for (const team of tournament.value.teams)
  {
    if (team.groupLabel) labels.add(team.groupLabel);
  }
  return [...labels].sort((a, b) => a.localeCompare(b));
});

const addMemberSelectableTeams = computed(() =>
{
  if (!tournament.value) return [];
  if (!selectedAddGroupLabel.value) return tournament.value.teams;
  return tournament.value.teams.filter(
    (t) => t.groupLabel === selectedAddGroupLabel.value
  );
});

watch(addMemberSelectableTeams, (teams) =>
{
  if (teams.some((t) => t.id === addMemberTeamId.value)) return;
  addMemberTeamId.value = teams[0]?.id ?? "";
});

function groupBorderClass(label: string): string
{
  return GROUP_COLORS[label] ?? "border-l-slate-400 dark:border-l-slate-500";
}

function groupBgClass(label: string): string
{
  return GROUP_BG[label] ?? "bg-slate-50/50 dark:bg-slate-900/20";
}

async function promptRenameGroup(label: string): Promise<void>
{
  if (!canEdit.value) return;
  const next = prompt("Neuer Gruppenname", label);
  if (!next) return;
  await renameGroupLabel(label, next);
}

async function promptRenameTeam(team: TournamentTeam): Promise<void>
{
  if (!canEdit.value) return;
  const next = prompt("Neuer Mannschaftsname", team.name);
  if (!next) return;
  await renameTeam(team.id, next);
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

      <p v-if="isIndividuals" class="text-sm text-slate-600 dark:text-slate-500">
        Einzelpersonen-Turnier: Jeder Spieler wird als eigene Mannschaft behandelt.
        Wähle Spieler aus, um sie als Teilnehmer hinzuzufügen.
      </p>
      <p v-else class="text-sm text-slate-600 dark:text-slate-500">
        Jede Mannschaft spielt einmal gegen jede andere (ein Spiel pro Paarung).
      </p>

      <div
        v-if="canEdit && !isIndividuals"
        class="rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 dark:border-blue-800/60 dark:bg-blue-950/20"
      >
        <h3 class="mb-2 font-display text-sm font-semibold text-slate-900 dark:text-white">
          Mannschaften aus Turnier übertragen
        </h3>
        <p class="mb-3 text-xs text-slate-600 dark:text-slate-400">
          Übernimmt Mannschaften und Zuordnungen aus einem anderen deiner Turniere.
          Teams werden nach Namen angelegt; bereits zugeordnete Spieler werden übersprungen.
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
            @click="transferFromSource"
          >
            Übertragen
          </button>
        </div>
      </div>

      <template v-if="isIndividuals && canEdit">
        <TournamentAddMemberSection
          :available-players="availablePlayers"
          :selected-class-id="selectedClassId"
          :selected-player-id="addPlayerId"
          :field-class="fieldClass"
          @update:selected-class-id="selectedClassId = $event"
          @update:selected-player-id="addPlayerId = $event"
          @add="addIndividualAsTeam"
        />
      </template>

      <template v-else-if="canEdit">
        <div
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
      </template>

      <template v-if="!isIndividuals">
        <TournamentAddMemberSection
          v-if="canEdit"
          mode="member"
          :has-groups="hasGroups"
          :group-options="addMemberGroupOptions"
          :selectable-teams="addMemberSelectableTeams"
          :available-players="availablePlayers"
          :selected-class-id="selectedClassId"
          :selected-group-label="selectedAddGroupLabel"
          :selected-team-id="addMemberTeamId"
          :selected-player-id="addPlayerId"
          :field-class="fieldClass"
          @update:selected-class-id="selectedClassId = $event"
          @update:selected-group-label="selectedAddGroupLabel = $event"
          @update:selected-team-id="addMemberTeamId = $event"
          @update:selected-player-id="addPlayerId = $event"
          @add="addMember"
        />
        <p v-else class="text-sm text-slate-500 dark:text-slate-500">
          Mannschaften siehst du unten; bearbeiten nur als Ersteller.
        </p>
      </template>

      <!-- Gruppen-Ansicht: Teams nach Gruppen gegliedert -->
      <template v-if="hasGroups && tournament.teams.length">
        <div class="grid gap-5 sm:grid-cols-2">
          <div
            v-for="group in teamsByGroup"
            :key="group.label"
            class="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            :class="groupBgClass(group.label)"
          >
            <div
              class="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800"
            >
              <span
                class="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-white"
                :class="{
                  'bg-blue-500': group.label === 'A',
                  'bg-emerald-500': group.label === 'B',
                  'bg-amber-500': group.label === 'C',
                  'bg-rose-500': group.label === 'D',
                  'bg-violet-500': group.label === 'E',
                  'bg-cyan-500': group.label === 'F',
                  'bg-orange-500': group.label === 'G',
                  'bg-pink-500': group.label === 'H',
                }"
              >
                {{ group.label }}
              </span>
              <span class="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Gruppe {{ group.label }}
              </span>
              <button
                v-if="canEdit"
                type="button"
                class="text-xs text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                @click="promptRenameGroup(group.label)"
              >
                Umbenennen
              </button>
              <span class="ml-auto text-xs text-slate-500 dark:text-slate-400">
                {{ group.teams.length }} {{ group.teams.length === 1 ? 'Mannschaft' : 'Mannschaften' }}
              </span>
            </div>

            <ul class="divide-y divide-slate-200/80 dark:divide-slate-800/80">
              <li
                v-for="team in group.teams"
                :key="team.id"
                class="border-l-4 px-4 py-3"
                :class="groupBorderClass(group.label)"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="font-semibold text-slate-900 dark:text-white">{{
                    team.name
                  }}</span>
                  <div v-if="canEdit" class="flex items-center gap-3">
                    <button
                      type="button"
                      class="text-xs text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                      @click="promptRenameTeam(team)"
                    >
                      Umbenennen
                    </button>
                    <button
                      type="button"
                      class="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
                      @click="removeTeam(team.id)"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
                <template v-if="!isIndividuals && team.members.length">
                  <ul class="mt-1 space-y-0.5 text-sm">
                    <li
                      v-for="mem in team.members"
                      :key="mem.id"
                      class="flex flex-wrap items-center justify-between gap-1"
                    >
                      <span class="text-slate-700 dark:text-slate-300">
                        {{ mem.player.name
                        }}<span
                          v-if="mem.player.schoolClass"
                          class="text-slate-500 dark:text-slate-500"
                        >
                          ({{ mem.player.schoolClass.name }})</span
                        >
                      </span>
                      <button
                        v-if="canEdit"
                        type="button"
                        class="text-xs text-rose-600 dark:text-rose-400"
                        @click="removeMember(team.id, mem.playerId)"
                      >
                        Entfernen
                      </button>
                    </li>
                  </ul>
                </template>
                <p
                  v-else-if="!isIndividuals"
                  class="mt-1 text-xs text-slate-500 dark:text-slate-500"
                >
                  Noch keine Spieler
                </p>
              </li>
            </ul>
          </div>
        </div>
      </template>

      <!-- Flache Liste (ohne Gruppen) -->
      <template v-else-if="tournament.teams.length">
        <ul class="space-y-4">
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
              <div v-if="canEdit" class="flex items-center gap-3">
                <button
                  type="button"
                  class="text-sm text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                  @click="promptRenameTeam(team)"
                >
                  Umbenennen
                </button>
                <button
                  type="button"
                  class="text-sm text-rose-600 hover:text-rose-700 dark:text-rose-400"
                  @click="removeTeam(team.id)"
                >
                  {{ isIndividuals ? "Entfernen" : "Mannschaft löschen" }}
                </button>
              </div>
            </div>
            <template v-if="!isIndividuals">
              <p class="mb-1 text-xs text-slate-500 dark:text-slate-500">Spieler</p>
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
                    Entfernen
                  </button>
                </li>
                <li
                  v-if="team.members.length === 0"
                  class="text-slate-500 dark:text-slate-500"
                >
                  Noch keine Spieler
                </li>
              </ul>
            </template>
          </li>
        </ul>
      </template>

      <p
        v-else
        class="text-sm text-slate-500 dark:text-slate-500"
      >
        {{ isIndividuals ? "Noch keine Teilnehmer hinzugefügt." : "Noch keine Mannschaft angelegt." }}
      </p>
    </section>
  </div>
</template>
