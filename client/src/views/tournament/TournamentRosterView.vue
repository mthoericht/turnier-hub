<script setup lang="ts">
import { inject } from "vue";
import TournamentAddMemberSection from "@/components/tournament/TournamentAddMemberSection.vue";
import TournamentTeamMembersList from "@/components/tournament/TournamentTeamMembersList.vue";
import {
  useTournamentRosterAddIndividual,
  useTournamentRosterAddMemberForm,
  useTournamentRosterGroupsDisplay,
  useTournamentRosterRenamePrompts,
  useTournamentRosterTransfer,
} from "@/composables/tournaments";
import { tournamentLayoutKey } from "@/tournament/tournamentContext";

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
  transferTeamFromTournament,
  confirmAction,
  promptText,
} = ctx;

const { addIndividualAsTeam } = useTournamentRosterAddIndividual({
  tournament,
  newTeamName,
  addMemberTeamId,
  addPlayerId,
  availablePlayers,
  createTeam,
  addMember,
});

const {
  selectedClassId,
  selectedAddGroupLabel,
  addMemberGroupOptions,
  addMemberSelectableTeams,
} = useTournamentRosterAddMemberForm({ tournament, addMemberTeamId });

const {
  transferFromTournamentId,
  sourceTournaments,
  loadingSources,
  transferFromSource,
} = useTournamentRosterTransfer({
  tournament,
  transferTeamFromTournament,
  confirmAction,
});

const {
  isIndividuals,
  hasGroups,
  teamsByGroup,
  groupBorderClass,
  groupBgClass,
} = useTournamentRosterGroupsDisplay({ tournament });

const { promptRenameGroup, promptRenameTeam } = useTournamentRosterRenamePrompts({
  canEdit,
  renameGroupLabel,
  renameTeam,
  promptText,
});
</script>

<template>
  <div v-if="tournament" class="space-y-8 sm:space-y-10">
    <section :class="[cardClass, 'space-y-4']">
      <h2
        class="font-display font-semibold text-lg text-slate-900"
      >
        Mannschaften
      </h2>

      <p v-if="isIndividuals" class="text-sm text-slate-600">
        Einzelpersonen-Turnier: Jeder Spieler wird als eigene Mannschaft behandelt.
        Wähle Spieler aus, um sie als Teilnehmer hinzuzufügen.
      </p>
      <p v-else class="text-sm text-slate-600">
        Jede Mannschaft spielt einmal gegen jede andere (ein Spiel pro Paarung).
      </p>

      <div
        v-if="canEdit && !isIndividuals"
        class="rounded-xl border border-blue-200/80 bg-blue-50/40 p-4"
      >
        <h3 class="mb-2 font-display text-sm font-semibold text-slate-900">
          Mannschaften aus Turnier übertragen
        </h3>
        <p class="mb-3 text-xs text-slate-600">
          Übernimmt Mannschaften und Zuordnungen aus einem anderen deiner Turniere.
          Teams werden nach Namen angelegt; bereits zugeordnete Spieler werden übersprungen.
        </p>
        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
          <div class="min-w-0 flex-1 sm:max-w-xs">
            <label
              class="mb-1 block text-xs text-slate-600"
              for="roster-transfer-from-tournament"
            >
              Von Turnier
            </label>
            <select
              id="roster-transfer-from-tournament"
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
            class="min-h-[48px] rounded-lg border border-slate-300 px-4 py-3 text-base text-slate-800 hover:bg-slate-100 sm:min-h-0 sm:py-2 sm:text-sm"
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
        <p v-else class="text-sm text-slate-500">
          Mannschaften siehst du unten.
        </p>
      </template>

      <!-- Gruppen-Ansicht: Teams nach Gruppen gegliedert -->
      <template v-if="hasGroups && tournament.teams.length">
        <div class="grid gap-5 sm:grid-cols-2">
          <div
            v-for="group in teamsByGroup"
            :key="group.label"
            class="rounded-xl border border-slate-200 overflow-hidden"
            :class="groupBgClass(group.label)"
          >
            <div
              class="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5"
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
              <span class="font-display text-sm font-semibold text-slate-900">
                Gruppe {{ group.label }}
              </span>
              <button
                v-if="canEdit"
                type="button"
                class="text-xs text-blue-700 hover:text-blue-800"
                @click="promptRenameGroup(group.label)"
              >
                Umbenennen
              </button>
              <span class="ml-auto text-xs text-slate-500">
                {{ group.teams.length }} {{ group.teams.length === 1 ? 'Mannschaft' : 'Mannschaften' }}
              </span>
            </div>

            <ul class="divide-y divide-slate-200/80">
              <li
                v-for="team in group.teams"
                :key="team.id"
                class="border-l-4 px-4 py-3"
                :class="groupBorderClass(group.label)"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="font-semibold text-slate-900">{{
                    team.name
                  }}</span>
                  <div v-if="canEdit" class="flex items-center gap-3">
                    <button
                      type="button"
                      class="text-xs text-blue-700 hover:text-blue-800"
                      @click="promptRenameTeam(team)"
                    >
                      Umbenennen
                    </button>
                    <button
                      type="button"
                      class="text-xs font-medium text-rose-800 hover:text-rose-900"
                      @click="removeTeam(team.id)"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
                <TournamentTeamMembersList
                  v-if="!isIndividuals"
                  class="mt-1"
                  :team="team"
                  :can-edit="canEdit"
                  @remove-member="(teamId, playerId) => removeMember(teamId, playerId)"
                />
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
            class="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
          >
            <div
              class="mb-2 flex flex-wrap items-center justify-between gap-2"
            >
              <span class="font-semibold text-slate-900">{{
                team.name
              }}</span>
              <div v-if="canEdit" class="flex items-center gap-3">
                <button
                  type="button"
                  class="text-sm text-blue-700 hover:text-blue-800"
                  @click="promptRenameTeam(team)"
                >
                  Umbenennen
                </button>
                <button
                  type="button"
                  class="text-sm font-medium text-rose-800 hover:text-rose-900"
                  @click="removeTeam(team.id)"
                >
                  {{ isIndividuals ? "Entfernen" : "Mannschaft löschen" }}
                </button>
              </div>
            </div>
            <template v-if="!isIndividuals">
              <p class="mb-1 text-xs text-slate-500">Spieler</p>
              <TournamentTeamMembersList
                :team="team"
                :can-edit="canEdit"
                :show-creator="true"
                @remove-member="(teamId, playerId) => removeMember(teamId, playerId)"
              />
            </template>
          </li>
        </ul>
      </template>

      <p
        v-else
        class="text-sm text-slate-500"
      >
        {{ isIndividuals ? "Noch keine Teilnehmer hinzugefügt." : "Noch keine Mannschaft angelegt." }}
      </p>
    </section>
  </div>
</template>
