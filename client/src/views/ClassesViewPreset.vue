<script setup lang="ts">
import { formatCreator } from "@/types";

import { useClassesManagementState } from "@/composables/classes/useClassesManagementState";

const {
  scope,
  classes,
  loading,
  error,
  dialogOpen,
  editingId,
  dialogName,
  getPlayerCount,
  isMine,
  openCreate,
  openEdit,
  closeDialog,
  submitDialog,
  remove,
} = useClassesManagementState();

const inputClass =
  "min-h-[48px] w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:min-h-0 sm:py-2 sm:text-sm";
</script>

<template>
  <div>
    <div
      class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="min-w-0">
        <h1
          class="font-display text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl"
        >
          Klassen
        </h1>
        <p class="text-slate-600 dark:text-slate-400 text-sm mt-1 max-w-xl">
          Verwalte deine Schulklassen. Beim Anlegen oder Bearbeiten von
          Spielern wählst du eine dieser Klassen zu — oder keine.
        </p>
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

        <button
          type="button"
          class="min-h-[48px] rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-600/90 sm:min-h-0 sm:py-2 sm:text-sm"
          @click="openCreate"
        >
          + Neue Klasse
        </button>
      </div>
    </div>

    <p v-if="error" class="text-rose-600 dark:text-rose-400 text-sm mb-4">
      {{ error }}
    </p>

    <p v-if="loading" class="text-slate-500">Lade …</p>
    <div
      v-else-if="classes.length === 0"
      class="rounded-2xl border border-slate-200 bg-white/70 p-6 text-center dark:border-slate-800 dark:bg-slate-900/40"
    >
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
        <path d="M3 10h18" />
        <path
          d="M5 10V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"
        />
        <path
          d="M7 10V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4"
        />
      </svg>
      <p class="text-slate-600 dark:text-slate-300 mb-4">
        Noch keine Klassen erstellt
      </p>
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100 dark:hover:bg-slate-800"
        @click="openCreate"
      >
        Erste Klasse erstellen
      </button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="c in classes"
        :key="c.id"
        class="rounded-2xl border border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/40"
      >
        <div class="p-5">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="min-w-0">
              <p
                class="font-display text-lg font-semibold text-slate-900 dark:text-white truncate"
              >
                {{ c.name }}
              </p>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
                Schulklasse
              </p>
              <p
                class="mt-2 text-xs text-slate-500 dark:text-slate-500 truncate"
                :title="c.createdBy.email"
              >
                Von {{ formatCreator(c.createdBy) }}
              </p>
            </div>
            <div v-if="isMine(c)" class="flex gap-2 shrink-0">
              <button
                type="button"
                class="rounded-lg p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                title="Bearbeiten"
                @click="openEdit(c)"
              >
                <svg
                  class="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9" />
                  <path
                    d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                  />
                </svg>
              </button>
              <button
                type="button"
                class="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                title="Löschen"
                @click="remove(c.id)"
              >
                <svg
                  class="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <svg
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
            </svg>
            <span class="text-sm">{{ getPlayerCount(c.id) }} Spieler</span>
          </div>
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
          <h2
            class="font-display text-xl font-semibold text-slate-900 dark:text-white"
          >
            {{ editingId ? "Klasse bearbeiten" : "Neue Klasse" }}
          </h2>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {{
              editingId
                ? "Bearbeite die Klasseninformationen"
                : "Füge eine neue Klasse hinzu"
            }}
          </p>
        </div>

        <form @submit.prevent="submitDialog" class="space-y-4">
          <div class="space-y-2">
            <label
              class="block text-sm font-medium text-slate-700 dark:text-slate-200"
              for="class-name"
            >
              Klassenname
            </label>
            <input
              id="class-name"
              v-model="dialogName"
              placeholder="z.B. 10a, 9b"
              :class="inputClass"
              required
            />
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
              :disabled="!dialogName.trim()"
            >
              {{ editingId ? "Speichern" : "Hinzufügen" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

