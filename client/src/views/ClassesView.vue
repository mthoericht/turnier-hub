<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import {
  deleteSchoolClass,
  fetchSchoolClasses,
  patchSchoolClass,
  postSchoolClass,
} from "@/api/classesApi";
import { useAuthStore } from "@/stores/auth";
import type { SchoolClass } from "@/types";
import { formatCreator } from "@/types";

const auth = useAuthStore();
const scope = ref<"all" | "own">("all");
const classes = ref<SchoolClass[]>([]);
const loading = ref(true);
const error = ref("");
const name = ref("");
const editingId = ref<string | null>(null);
const editName = ref("");

const inputClass =
  "min-h-[48px] rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:ring-2 focus:ring-court-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:min-h-0 sm:py-2 sm:text-sm";
const inputSmClass =
  "min-h-[44px] rounded-lg border border-slate-300 bg-white px-2 py-2 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:min-h-0 sm:py-1 sm:text-sm";

async function load(): Promise<void> 
{
  loading.value = true;
  error.value = "";
  try 
  {
    classes.value = await fetchSchoolClasses(scope.value);
  }
  catch (e) 
  {
    error.value = e instanceof Error ? e.message : "Laden fehlgeschlagen";
  }
  finally 
  {
    loading.value = false;
  }
}

function isMine(c: SchoolClass): boolean 
{
  return !!auth.user && c.createdBy.id === auth.user.id;
}

watch(scope, () => void load());

async function createClass(): Promise<void> 
{
  if (!name.value.trim()) return;
  try 
  {
    await postSchoolClass({ name: name.value.trim() });
    name.value = "";
    await load();
  }
  catch (e) 
  {
    error.value = e instanceof Error ? e.message : "Speichern fehlgeschlagen";
  }
}

function startEdit(c: SchoolClass): void 
{
  editingId.value = c.id;
  editName.value = c.name;
}

async function saveEdit(): Promise<void> 
{
  if (!editingId.value || !editName.value.trim()) return;
  try 
  {
    await patchSchoolClass(editingId.value, {
      name: editName.value.trim(),
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
  if (!confirm("Klasse wirklich löschen? Zugeordnete Spieler verlieren die Zuordnung."))
    return;
  try 
  {
    await deleteSchoolClass(id);
    await load();
  }
  catch (e) 
  {
    error.value = e instanceof Error ? e.message : "Löschen fehlgeschlagen";
  }
}

onMounted(() => void load());
</script>

<template>
  <div>
    <div
      class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <h1
        class="font-display text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl"
      >
        Klassen
      </h1>
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
    <p class="text-slate-600 dark:text-slate-400 text-sm mb-4 max-w-xl">
      Klassen hier anlegen und umbenennen. Beim Anlegen oder Bearbeiten von
      Spielern wählst du eine dieser Klassen zu — oder keine.
    </p>
    <p v-if="error" class="text-rose-600 dark:text-rose-400 text-sm mb-4">
      {{ error }}
    </p>

    <form
      class="mb-8 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/50 sm:flex-row sm:flex-wrap sm:items-end"
      @submit.prevent="createClass"
    >
      <input
        v-model="name"
        placeholder="Klassenname (z. B. 10a)"
        :class="['flex-1', inputClass]"
      />
      <button
        type="submit"
        class="min-h-[48px] rounded-lg bg-court-600 px-4 py-3 text-base font-medium text-white hover:bg-court-600/90 sm:min-h-0 sm:py-2 sm:text-sm"
      >
        Klasse anlegen
      </button>
    </form>

    <p v-if="loading" class="text-slate-500">Lade …</p>
    <ul v-else class="space-y-2">
      <li
        v-for="c in classes"
        :key="c.id"
        class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40 sm:flex-row sm:items-center sm:justify-between"
      >
        <template v-if="editingId === c.id">
          <input v-model="editName" :class="['flex-1', inputSmClass]" />
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
              c.name
            }}</span>
            <p
              class="mt-1 text-xs text-slate-500 dark:text-slate-500"
              :title="c.createdBy.email"
            >
              Von {{ formatCreator(c.createdBy) }}
            </p>
          </div>
          <div v-if="isMine(c)" class="flex gap-3 text-sm shrink-0">
            <button
              type="button"
              class="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              @click="startEdit(c)"
            >
              Bearbeiten
            </button>
            <button
              type="button"
              class="text-rose-600/90 hover:text-rose-600 dark:text-rose-400/80 dark:hover:text-rose-400"
              @click="remove(c.id)"
            >
              Löschen
            </button>
          </div>
        </template>
      </li>
    </ul>
    <p v-if="!loading && classes.length === 0" class="text-slate-500 mt-4">
      Noch keine Klassen — lege oben welche an.
    </p>
  </div>
</template>
