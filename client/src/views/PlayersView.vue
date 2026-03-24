<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { fetchSchoolClasses } from "@/api/classesApi";
import {
  deletePlayer,
  fetchPlayers,
  patchPlayer,
  postPlayer,
} from "@/api/playersApi";
import { useAuthStore } from "@/stores/auth";
import type { Player, SchoolClass } from "@/types";
import { formatCreator } from "@/types";

const auth = useAuthStore();
const scope = ref<"all" | "own">("all");
const players = ref<Player[]>([]);
const myClasses = ref<SchoolClass[]>([]);
const loading = ref(true);
const classesLoading = ref(true);
const error = ref("");
const name = ref("");
const newSchoolClassId = ref("");
const editingId = ref<string | null>(null);
const editName = ref("");
const editSchoolClassId = ref("");
/** "" = alle, "__none__" = ohne Klasse, sonst Klassen-ID */
const classFilter = ref("");

const selectClass =
  "min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-court-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:min-h-0";

const distinctClassOptions = computed(() =>
{
  const byId = new Map<string, string>();
  for (const p of players.value) 
  {
    if (p.schoolClass) byId.set(p.schoolClass.id, p.schoolClass.name);
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
});

const hasPlayersWithoutClass = computed(() =>
  players.value.some((p) => !p.schoolClass)
);

const filteredPlayers = computed(() =>
{
  if (!classFilter.value) return players.value;
  if (classFilter.value === "__none__")
  {
    return players.value.filter((p) => !p.schoolClass);
  }
  return players.value.filter(
    (p) => p.schoolClass?.id === classFilter.value
  );
});

const inputClass =
  "min-h-[48px] rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:ring-2 focus:ring-court-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:min-h-0 sm:py-2 sm:text-sm";
const inputSmClass =
  "min-h-[44px] rounded-lg border border-slate-300 bg-white px-2 py-2 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:min-h-0 sm:py-1 sm:text-sm";

async function loadClasses(): Promise<void> 
{
  classesLoading.value = true;
  try 
  {
    myClasses.value = await fetchSchoolClasses("own");
  }
  catch 
  {
    myClasses.value = [];
  }
  finally 
  {
    classesLoading.value = false;
  }
}

async function load(): Promise<void> 
{
  loading.value = true;
  error.value = "";
  try 
  {
    players.value = await fetchPlayers(scope.value);
  }
  catch (e) 
  {
    error.value = e instanceof Error ? e.message : "Laden fehlgeschlagen";
  }
  finally 
  {
    loading.value = false;
  }
  normalizeClassFilter();
}

function normalizeClassFilter(): void 
{
  if (!classFilter.value) return;
  if (classFilter.value === "__none__") 
  {
    if (!players.value.some((p) => !p.schoolClass)) classFilter.value = "";
    return;
  }
  const ids = new Set(
    players.value.map((p) => p.schoolClass?.id).filter(Boolean) as string[]
  );
  if (!ids.has(classFilter.value)) classFilter.value = "";
}

function isMine(p: Player): boolean 
{
  return !!auth.user && p.createdBy.id === auth.user.id;
}

watch(scope, () =>
{
  classFilter.value = "";
  void load();
});

async function createPlayer(): Promise<void> 
{
  if (!name.value.trim()) return;
  try 
  {
    await postPlayer({
      name: name.value.trim(),
      schoolClassId: newSchoolClassId.value || null,
    });
    name.value = "";
    newSchoolClassId.value = "";
    await load();
  }
  catch (e) 
  {
    error.value = e instanceof Error ? e.message : "Speichern fehlgeschlagen";
  }
}

function startEdit(p: Player): void 
{
  editingId.value = p.id;
  editName.value = p.name;
  editSchoolClassId.value = p.schoolClass?.id ?? "";
}

async function saveEdit(): Promise<void> 
{
  if (!editingId.value || !editName.value.trim()) return;
  try 
  {
    await patchPlayer(editingId.value, {
      name: editName.value.trim(),
      schoolClassId: editSchoolClassId.value || null,
    });
    editingId.value = null;
    await load();
  }
  catch (e) 
  {
    error.value = e instanceof Error ? e.message : "Speichern fehlgeschlagen";
  }
}

async function remove(id: string): Promise<void> 
{
  if (!confirm("Spieler wirklich löschen?")) return;
  try 
  {
    await deletePlayer(id);
    await load();
  }
  catch (e) 
  {
    error.value = e instanceof Error ? e.message : "Löschen fehlgeschlagen";
  }
}

onMounted(() =>
{
  void loadClasses();
  void load();
});
</script>

<template>
  <div>
    <div
      class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <h1
        class="font-display text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl"
      >
        Spieler
      </h1>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label
          class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
        >
          <span class="shrink-0">Klasse</span>
          <select
            v-model="classFilter"
            :class="[
              selectClass,
              distinctClassOptions.length === 0 && !hasPlayersWithoutClass
                ? 'opacity-60'
                : '',
            ]"
            :disabled="
              distinctClassOptions.length === 0 && !hasPlayersWithoutClass
            "
          >
            <option value="">Alle Klassen</option>
            <option v-if="hasPlayersWithoutClass" value="__none__">
              Ohne Klasse
            </option>
            <option
              v-for="c in distinctClassOptions"
              :key="c.id"
              :value="c.id"
            >
              {{ c.name }}
            </option>
          </select>
        </label>
        <div
          class="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700"
          role="group"
          aria-label="Ansicht"
        >
          <button
            type="button"
            :class="[
              'rounded-md px-3 py-2 text-sm font-medium transition sm:py-1.5',
              scope === 'all'
                ? 'bg-court-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
            ]"
            @click="scope = 'all'"
          >
            Alle
          </button>
          <button
            type="button"
            :class="[
              'rounded-md px-3 py-2 text-sm font-medium transition sm:py-1.5',
              scope === 'own'
                ? 'bg-court-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
            ]"
            @click="scope = 'own'"
          >
            Eigene
          </button>
        </div>
      </div>
    </div>
    <p v-if="error" class="text-rose-600 dark:text-rose-400 text-sm mb-4">
      {{ error }}
    </p>

    <form
      class="mb-8 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/50 sm:flex-row sm:flex-wrap sm:items-end"
      @submit.prevent="createPlayer"
    >
      <input
        v-model="name"
        placeholder="Name"
        :class="['flex-1', inputClass]"
      />
      <label class="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-400 sm:shrink-0">
        <span class="sr-only sm:not-sr-only sm:text-xs">Klasse</span>
        <select
          v-model="newSchoolClassId"
          :disabled="classesLoading"
          :class="['min-w-[8rem]', selectClass]"
        >
          <option value="">Keine Klasse</option>
          <option
            v-for="c in myClasses"
            :key="c.id"
            :value="c.id"
          >
            {{ c.name }}
          </option>
        </select>
      </label>
      <button
        type="submit"
        class="min-h-[48px] rounded-lg bg-court-600 px-4 py-3 text-base font-medium text-white hover:bg-court-600/90 sm:min-h-0 sm:py-2 sm:text-sm"
      >
        Hinzufügen
      </button>
    </form>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
      Klassen verwaltest du unter
      <RouterLink
        to="/classes"
        class="text-court-700 underline hover:no-underline dark:text-court-200"
      >Klassen</RouterLink>.
    </p>

    <p v-if="loading" class="text-slate-500">Lade …</p>
    <ul v-else class="space-y-2">
      <li
        v-for="p in filteredPlayers"
        :key="p.id"
        class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40 sm:flex-row sm:items-center sm:justify-between"
      >
        <template v-if="editingId === p.id">
          <div class="flex flex-wrap gap-2 flex-1 items-center">
            <input v-model="editName" :class="inputSmClass" />
            <select v-model="editSchoolClassId" :class="[inputSmClass, 'min-w-[7rem]']">
              <option value="">Keine Klasse</option>
              <option
                v-for="c in myClasses"
                :key="c.id"
                :value="c.id"
              >
                {{ c.name }}
              </option>
            </select>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="text-court-800 text-sm dark:text-court-100"
              @click="saveEdit"
            >
              Speichern
            </button>
            <button
              type="button"
              class="text-slate-500 text-sm"
              @click="editingId = null"
            >
              Abbrechen
            </button>
          </div>
        </template>
        <template v-else>
          <div class="min-w-0 flex-1">
            <span class="font-medium text-slate-900 dark:text-white">{{
              p.name
            }}</span>
            <span
              v-if="p.schoolClass"
              class="text-slate-500 text-sm ml-2 dark:text-slate-500"
            >
              {{ p.schoolClass.name }}
            </span>
            <p
              class="mt-1 text-xs text-slate-500 dark:text-slate-500"
              :title="p.createdBy.email"
            >
              Von {{ formatCreator(p.createdBy) }}
            </p>
          </div>
          <div v-if="isMine(p)" class="flex gap-3 text-sm shrink-0">
            <button
              type="button"
              class="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              @click="startEdit(p)"
            >
              Bearbeiten
            </button>
            <button
              type="button"
              class="text-rose-600/90 hover:text-rose-600 dark:text-rose-400/80 dark:hover:text-rose-400"
              @click="remove(p.id)"
            >
              Löschen
            </button>
          </div>
        </template>
      </li>
    </ul>
    <p
      v-if="!loading && players.length === 0"
      class="text-slate-500 mt-4"
    >
      Noch keine Spieler — lege oben welche an.
    </p>
    <p
      v-else-if="!loading && filteredPlayers.length === 0"
      class="text-slate-500 mt-4"
    >
      Keine Spieler für diese Klassenauswahl.
    </p>
  </div>
</template>
