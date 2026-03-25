<script setup lang="ts">
import { RouterLink } from "vue-router";
import { formatCreator } from "@/types";
import { useTournamentsListState } from "@/composables/tournaments/useTournamentsListState";

const {
  scope,
  list,
  loading,
  error,
  name,
  sport,
  createT,
  remove,
  isMine,
} = useTournamentsListState();

const inputClass =
  "min-h-[48px] rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:min-h-0 sm:py-2 sm:text-sm";
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
              ? 'bg-blue-600 text-white'
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
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
          ]"
          @click="scope = 'own'"
        >
          Eigene
        </button>
      </div>
    </div>
    <p v-if="error" class="text-rose-600 dark:text-rose-400 text-sm mb-4">
      {{ error }}
    </p>

    <form
      class="mb-8 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/50 sm:flex-row sm:flex-wrap sm:items-end"
      @submit.prevent="createT"
    >
      <input
        v-model="name"
        placeholder="Turniername"
        :class="['flex-1', inputClass]"
      />
      <select v-model="sport" :class="inputClass">
        <option value="Volleyball">Volleyball</option>
        <option value="Fußball">Fußball</option>
        <option value="2-Felderball">2-Felderball</option>
        <option value="Basketball">Basketball</option>
        <option value="Handball">Handball</option>
        <option value="Sonstiges">Sonstiges</option>
      </select>
      <button
        type="submit"
        class="min-h-[48px] rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-600/90 sm:min-h-0 sm:py-2 sm:text-sm"
      >
        Anlegen
      </button>
    </form>

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
            {{ t.sport }} · Phase {{ t.phase }} · {{ t._count.teams }} Mannschaften,
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
            class="text-rose-600/90 hover:text-rose-600 dark:text-rose-400/80 dark:hover:text-rose-400"
            @click="remove(t.id)"
          >
            Löschen
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
