<script setup lang="ts">
import { RouterLink } from "vue-router";
import { formatCreator } from "@/types";

import { usePlayersManagementState } from "@/composables/players/usePlayersManagementState";

const {
  scope,
  players,
  myClasses,
  classFilter,
  loading,
  classesLoading,
  error,
  dialogOpen,
  editingId,
  dialogName,
  dialogClassId,
  filteredPlayers,
  canAddPlayer,
  distinctClassOptions,
  hasPlayersWithoutClass,
  openCreate,
  openEdit,
  closeDialog,
  submitDialog,
  remove,
  isMine,
  getClassName,
} = usePlayersManagementState();

const inputClass =
  "min-h-[48px] w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:min-h-0 sm:py-2 sm:text-sm";

const selectClass =
  "min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

</script>

<template>
  <div>
    <div
      class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h1
          class="font-display text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl"
        >
          Spieler
        </h1>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
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

        <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <span class="shrink-0">Klasse</span>
          <select
            v-model="classFilter"
            :class="selectClass"
            :disabled="distinctClassOptions.length === 0 && !hasPlayersWithoutClass"
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

        <button
          type="button"
          class="min-h-[48px] rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-600/90 disabled:opacity-50 sm:min-h-0 sm:py-2 sm:text-sm"
          :disabled="!canAddPlayer"
          @click="openCreate"
        >
          + Neuer Spieler
        </button>
      </div>
    </div>

    <p v-if="error" class="text-rose-600 dark:text-rose-400 text-sm mb-4">
      {{ error }}
    </p>

    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
      Klassen verwaltest du unter
      <RouterLink
        to="/classes"
        class="text-blue-700 underline hover:no-underline dark:text-blue-200"
      >
        Klassen
      </RouterLink>
      .
    </p>

    <p v-if="loading || classesLoading" class="text-slate-500">Lade …</p>

    <div v-else>
      <div v-if="myClasses.length === 0" class="rounded-2xl border border-slate-200 bg-white/70 p-6 text-center dark:border-slate-800 dark:bg-slate-900/40">
        <svg
          class="h-12 w-12 text-slate-400 mx-auto mb-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
          />
          <circle cx="9" cy="7" r="4" />
        </svg>
        <p class="text-slate-600 dark:text-slate-300 mb-4">
          Erstelle zuerst eine Klasse, bevor du Spieler hinzufügst
        </p>
        <RouterLink to="/classes">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Zu den Klassen
          </button>
        </RouterLink>
      </div>

        <div v-else>
          <div v-if="players.length === 0" class="rounded-2xl border border-slate-200 bg-white/70 p-6 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <svg
            class="h-12 w-12 text-slate-400 mx-auto mb-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
            />
            <circle cx="9" cy="7" r="4" />
          </svg>
          <p class="text-slate-600 dark:text-slate-300 mb-4">
            Noch keine Spieler erstellt
          </p>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-600/90"
            :disabled="!canAddPlayer"
            @click="openCreate"
          >
            Ersten Spieler erstellen
          </button>
        </div>

          <div
            v-else-if="filteredPlayers.length === 0"
            class="rounded-2xl border border-slate-200 bg-white/70 p-6 text-center dark:border-slate-800 dark:bg-slate-900/40"
          >
            <p class="text-slate-600 dark:text-slate-300">
              Keine Spieler für diese Klassenauswahl.
            </p>
          </div>

          <div
            v-else
            class="rounded-2xl border border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/40 overflow-hidden"
          >
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                  Name
                </th>
                <th class="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                  Klasse
                </th>
                <th class="px-5 py-3 font-medium text-slate-700 dark:text-slate-200 text-right">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in filteredPlayers"
                :key="p.id"
                class="border-b border-slate-200/70 dark:border-slate-800/70"
              >
                <td class="px-5 py-3 text-slate-900 dark:text-white font-medium">
                  <div class="min-w-0">
                    <div class="truncate">
                      {{ p.name }}
                    </div>
                    <p
                      class="text-xs font-normal text-slate-500 dark:text-slate-500 mt-1 truncate"
                      :title="p.createdBy.email"
                    >
                      Von {{ formatCreator(p.createdBy) }}
                    </p>
                  </div>
                </td>
                <td class="px-5 py-3 text-slate-600 dark:text-slate-400">
                  {{ getClassName(p) }}
                </td>
                <td class="px-5 py-3 text-right text-slate-600 dark:text-slate-300">
                  <div class="flex justify-end gap-2">
                    <button
                      v-if="isMine(p)"
                      type="button"
                      class="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                      @click="openEdit(p)"
                    >
                      Bearbeiten
                    </button>
                    <button
                      v-if="isMine(p)"
                      type="button"
                      class="rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                      @click="remove(p.id)"
                    >
                      Löschen
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div
      v-if="dialogOpen"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-3"
      role="dialog"
      aria-modal="true"
      @click.self="closeDialog"
    >
      <div
        class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950"
      >
        <div class="mb-4">
          <h2 class="font-display text-xl font-semibold text-slate-900 dark:text-white">
            {{ editingId ? "Spieler bearbeiten" : "Neuer Spieler" }}
          </h2>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {{
              editingId
                ? "Bearbeite die Spielerinformationen"
                : "Füge einen neuen Spieler hinzu"
            }}
          </p>
        </div>

        <form @submit.prevent="submitDialog" class="space-y-4">
          <div class="space-y-2">
            <label
              class="block text-sm font-medium text-slate-700 dark:text-slate-200"
              for="player-name"
            >
              Name
            </label>
            <input
              id="player-name"
              v-model="dialogName"
              placeholder="Spielername eingeben"
              :class="inputClass"
              required
            />
          </div>

          <div class="space-y-2">
            <label
              class="block text-sm font-medium text-slate-700 dark:text-slate-200"
              for="player-class"
            >
              Klasse
            </label>
            <select
              id="player-class"
              v-model="dialogClassId"
              :class="selectClass"
            >
              <option value="">Keine Klasse</option>
              <option v-for="c in myClasses" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              @click="closeDialog"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              class="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600/90 disabled:opacity-50"
              :disabled="!dialogName.trim() || myClasses.length === 0"
            >
              {{ editingId ? "Speichern" : "Hinzufügen" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

