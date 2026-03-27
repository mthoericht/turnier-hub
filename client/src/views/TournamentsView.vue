<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { formatCreator } from "@/types";
import { formatTournamentMode } from "@/tournament/tournamentFormat";
import { useTournamentsListState } from "@/composables/tournaments/useTournamentsListState";
import ScopeToggle from "@/components/common/ScopeToggle.vue";

const router = useRouter();

const {
  scope,
  list,
  loading,
  error,
  name,
  sport,
  mode,
  teamsAreIndividuals,
  createT,
  remove,
  isMine,
} = useTournamentsListState();

const showCreateForm = ref(false);

const inputClass =
  "min-h-[48px] rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:min-h-0 sm:py-2 sm:text-sm";

async function handleCreate(): Promise<void>
{
  const result = await createT();
  if (result)
  {
    showCreateForm.value = false;
    void router.push({ name: "tournament-roster", params: { id: result.id } });
  }
}
</script>

<template>
  <div>
    <div
      class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <h1
        class="font-display text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl"
      >
        Turniere
      </h1>
      <div class="flex items-center gap-3">
        <ScopeToggle v-model="scope" />
      </div>
    </div>
    <p v-if="error" class="text-rose-600 dark:text-rose-400 text-sm mb-4">
      {{ error }}
    </p>

    <div class="mb-8">
      <button
        v-if="!showCreateForm"
        type="button"
        class="rounded-lg bg-blue-600 px-5 py-3 text-base font-medium text-white hover:bg-blue-600/90 sm:py-2 sm:text-sm"
        @click="showCreateForm = true"
      >
        Turnier anlegen
      </button>

      <div
        v-else
        class="rounded-xl border border-slate-200 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-900/50 space-y-5"
      >
        <div class="flex items-center justify-between">
          <h2 class="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Neues Turnier erstellen
          </h2>
          <button
            type="button"
            class="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            @click="showCreateForm = false"
          >
            Abbrechen
          </button>
        </div>

        <form class="space-y-5" @submit.prevent="handleCreate">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Turniername
              </label>
              <input
                v-model="name"
                placeholder="z.B. Schulcup 2026"
                :class="['w-full', inputClass]"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Sportart
              </label>
              <select v-model="sport" :class="['w-full', inputClass]">
                <option value="Volleyball">Volleyball</option>
                <option value="Fußball">Fußball</option>
                <option value="2-Felderball">2-Felderball</option>
                <option value="Basketball">Basketball</option>
                <option value="Handball">Handball</option>
                <option value="Badminton">Badminton</option>
                <option value="Tischtennis">Tischtennis</option>
                <option value="Sonstiges">Sonstiges</option>
              </select>
            </div>
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Turniermodus
            </label>
            <div class="grid gap-3 sm:grid-cols-3">
              <label
                :class="[
                  'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition',
                  mode === 'GROUP_KO'
                    ? 'border-blue-600 bg-blue-50/60 dark:border-blue-400 dark:bg-blue-950/30'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
                ]"
              >
                <input
                  v-model="mode"
                  type="radio"
                  value="GROUP_KO"
                  class="mt-1"
                />
                <div>
                  <span class="font-medium text-slate-900 dark:text-white">Gruppenspiele + K.O.</span>
                  <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Gruppenphase, dann K.O.-Runden (VF/HF/Finale)
                  </p>
                </div>
              </label>

              <label
                :class="[
                  'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition',
                  mode === 'DIRECT_KO'
                    ? 'border-blue-600 bg-blue-50/60 dark:border-blue-400 dark:bg-blue-950/30'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
                ]"
              >
                <input
                  v-model="mode"
                  type="radio"
                  value="DIRECT_KO"
                  class="mt-1"
                />
                <div>
                  <span class="font-medium text-slate-900 dark:text-white">Direkt K.O.</span>
                  <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Sofort K.O.-Runden, auch mit 10+ Mannschaften
                  </p>
                </div>
              </label>

              <label
                :class="[
                  'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition',
                  mode === 'ROUND_ROBIN'
                    ? 'border-blue-600 bg-blue-50/60 dark:border-blue-400 dark:bg-blue-950/30'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
                ]"
              >
                <input
                  v-model="mode"
                  type="radio"
                  value="ROUND_ROBIN"
                  class="mt-1"
                />
                <div>
                  <span class="font-medium text-slate-900 dark:text-white">Jeder gegen Jeden</span>
                  <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Alle Mannschaften spielen gegeneinander, ohne K.O.-Phase
                  </p>
                </div>
              </label>
            </div>
          </div>

          <label
            class="flex items-center gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
          >
            <input
              v-model="teamsAreIndividuals"
              type="checkbox"
              class="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span class="font-medium text-slate-900 dark:text-white">
                Mannschaften sind Einzelpersonen
              </span>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                z.B. für Badminton oder Tischtennis — Spieler werden direkt als Mannschaft behandelt
              </p>
            </div>
          </label>

          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              @click="showCreateForm = false"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-600/90"
            >
              Turnier erstellen
            </button>
          </div>
        </form>
      </div>
    </div>

    <p v-if="loading" class="text-slate-500">Lade …</p>
    <ul v-else class="space-y-2">
      <li
        v-for="t in list"
        :key="t.id"
        class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <RouterLink
            :to="{ name: 'tournament-roster', params: { id: t.id } }"
            class="font-medium text-blue-800 hover:underline dark:text-blue-100"
          >
            {{ t.name }}
          </RouterLink>
          <p class="text-sm text-slate-500 dark:text-slate-500">
            {{ t.sport }} · {{ formatTournamentMode(t.mode) }} · {{ t._count.teams }} Mannschaften,
            {{ t._count.matches }} Spiele
          </p>
          <p
            class="mt-1 text-xs text-slate-500 dark:text-slate-500"
            :title="t.createdBy.email"
          >
            Von {{ formatCreator(t.createdBy) }}
          </p>
        </div>
        <div class="flex gap-3 text-sm shrink-0">
          <RouterLink
            :to="{ name: 'tournament-roster', params: { id: t.id } }"
            class="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Öffnen
          </RouterLink>
          <button
            v-if="isMine(t)"
            type="button"
            class="ui-link-danger"
            @click="remove(t.id)"
          >
            Löschen
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
