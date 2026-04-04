<script setup lang="ts">
import { computed, useId } from "vue";
import { useRouter } from "vue-router";
import type { TournamentMode } from "@/tournament/tournamentContext";
import type { TournamentListRow } from "@/api/tournamentsApi";

const props = defineProps<{
  name: string;
  sport: string;
  mode: TournamentMode;
  teamsAreIndividuals: boolean;
  createT: () => Promise<TournamentListRow | null>;
  /** When set, applied to the main heading (e.g. parent dialog `aria-labelledby`). */
  headingId?: string;
}>();

const emit = defineEmits<{
  (e: "update:name", value: string): void;
  (e: "update:sport", value: string): void;
  (e: "update:mode", value: TournamentMode): void;
  (e: "update:teamsAreIndividuals", value: boolean): void;
  (e: "cancel"): void;
  (e: "created"): void;
}>();

const router = useRouter();

const nameModel = computed({
  get: () => props.name,
  set: (v: string) => emit("update:name", v),
});

const sportModel = computed({
  get: () => props.sport,
  set: (v: string) => emit("update:sport", v),
});

const modeModel = computed({
  get: () => props.mode,
  set: (v: TournamentMode) => emit("update:mode", v),
});

const teamsAreIndividualsModel = computed({
  get: () => props.teamsAreIndividuals,
  set: (v: boolean) => emit("update:teamsAreIndividuals", v),
});

const formFieldId = useId();
const fallbackHeadingId = useId();
const headingIdResolved = computed(
  () => props.headingId ?? fallbackHeadingId
);
const nameFieldId = `${formFieldId}-name`;
const sportFieldId = `${formFieldId}-sport`;

const inputClass =
  "min-h-[48px] rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:ring-2 focus:ring-blue-600 sm:min-h-0 sm:py-2 sm:text-sm";

async function handleCreate(): Promise<void>
{
  const result = await props.createT();
  if (!result) return;
  emit("created");
  void router.push({ name: "tournament-roster", params: { id: result.id } });
}
</script>

<template>
  <div class="space-y-5">
    <h2
      :id="headingIdResolved"
      class="font-display text-lg font-semibold text-slate-900"
    >
      Neues Turnier erstellen
    </h2>

    <form class="space-y-5" @submit.prevent="() => void handleCreate()">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <label
              class="block text-sm font-medium text-slate-700"
              :for="nameFieldId"
            >
              Turniername
            </label>
            <input
              :id="nameFieldId"
              v-model="nameModel"
              placeholder="z.B. Schulcup 2026"
              autocomplete="off"
              required
              :class="['w-full', inputClass]"
            />
          </div>
          <div class="space-y-2">
            <label
              class="block text-sm font-medium text-slate-700"
              :for="sportFieldId"
            >
              Sportart
            </label>
            <select
              :id="sportFieldId"
              v-model="sportModel"
              :class="['w-full', inputClass]"
            >
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

        <fieldset class="m-0 min-w-0 border-0 p-0">
          <legend class="mb-2 block text-sm font-medium text-slate-700">
            Turniermodus
          </legend>
          <div class="grid gap-3 sm:grid-cols-3">
            <label
              :class="[
                'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition',
                modeModel === 'GROUP_KO'
                  ? 'border-blue-600 bg-blue-50/60'
                  : 'border-slate-200 hover:border-slate-300',
              ]"
            >
              <input
                v-model="modeModel"
                type="radio"
                value="GROUP_KO"
                class="mt-1"
              />
              <div>
                <span class="font-medium text-slate-900"
                  >Gruppenspiele + K.O.</span
                >
                <p class="mt-1 text-xs text-slate-500">
                  Gruppenphase, dann K.O.-Runden (VF/HF/Finale)
                </p>
              </div>
            </label>

            <label
              :class="[
                'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition',
                modeModel === 'DIRECT_KO'
                  ? 'border-blue-600 bg-blue-50/60'
                  : 'border-slate-200 hover:border-slate-300',
              ]"
            >
              <input
                v-model="modeModel"
                type="radio"
                value="DIRECT_KO"
                class="mt-1"
              />
              <div>
                <span class="font-medium text-slate-900">Direkt K.O.</span>
                <p class="mt-1 text-xs text-slate-500">
                  Sofort K.O.-Runden, auch mit 10+ Mannschaften
                </p>
              </div>
            </label>

            <label
              :class="[
                'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition',
                modeModel === 'ROUND_ROBIN'
                  ? 'border-blue-600 bg-blue-50/60'
                  : 'border-slate-200 hover:border-slate-300',
              ]"
            >
              <input
                v-model="modeModel"
                type="radio"
                value="ROUND_ROBIN"
                class="mt-1"
              />
              <div>
                <span class="font-medium text-slate-900"
                  >Jeder gegen Jeden</span
                >
                <p class="mt-1 text-xs text-slate-500">
                  Alle Mannschaften spielen gegeneinander, ohne K.O.-Phase
                </p>
              </div>
            </label>
          </div>
        </fieldset>

        <label
          class="flex items-center gap-3 rounded-xl border border-slate-200 p-4"
        >
          <input
            v-model="teamsAreIndividualsModel"
            type="checkbox"
            class="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <span class="font-medium text-slate-900">
              Mannschaften sind Einzelpersonen
            </span>
            <p class="text-xs text-slate-500">
              z.B. für Badminton oder Tischtennis — Spieler werden direkt als
              Mannschaft behandelt
            </p>
          </div>
        </label>

        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            @click="emit('cancel')"
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
</template>

