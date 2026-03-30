<script setup lang="ts">
import { RouterLink } from "vue-router";
import { formatCreator } from "@/types";
import AppIcon from "@/components/common/AppIcon.vue";
import ScopeToggle from "@/components/common/ScopeToggle.vue";
import EmptyStateCard from "@/components/common/EmptyStateCard.vue";
import EntityDialog from "@/components/common/EntityDialog.vue";

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
  "ui-input-blue min-h-[48px] dark:bg-slate-950 sm:min-h-0 sm:text-sm";

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
        <ScopeToggle v-model="scope" />

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
          class="ui-btn-primary-blue"
          :disabled="!canAddPlayer"
          @click="openCreate"
        >
          + Neuer Spieler
        </button>
      </div>
    </div>

    <p
      v-if="error"
      class="mb-4 text-sm text-rose-600 dark:text-rose-400"
      role="alert"
    >
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
      <EmptyStateCard v-if="myClasses.length === 0" title="Erstelle zuerst eine Klasse, bevor du Spieler hinzufügst">
        <template #icon>
        <AppIcon name="players" class="mx-auto mb-4 h-12 w-12 text-slate-400" />
        </template>
        <template #action>
          <RouterLink
            to="/classes"
            class="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Zu den Klassen
          </RouterLink>
        </template>
      </EmptyStateCard>

        <div v-else>
          <EmptyStateCard
            v-if="players.length === 0"
            title="Noch keine Spieler erstellt"
            action-label="Ersten Spieler erstellen"
            :action-disabled="!canAddPlayer"
            @action="openCreate"
          >
            <template #icon>
            <AppIcon name="players" class="mx-auto mb-4 h-12 w-12 text-slate-400" />
            </template>
            <template #action>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-600/90 disabled:opacity-50"
                :disabled="!canAddPlayer"
                @click="openCreate"
              >
                Ersten Spieler erstellen
              </button>
            </template>
          </EmptyStateCard>

          <div
            v-else-if="filteredPlayers.length === 0"
            class="ui-empty-card"
          >
            <p class="text-slate-600 dark:text-slate-300">
              Keine Spieler für diese Klassenauswahl.
            </p>
          </div>

          <div
            v-else
            class="ui-card overflow-hidden"
          >
          <table class="w-full text-left text-sm">
            <caption class="sr-only">
              Spielerliste
            </caption>
            <thead class="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th scope="col" class="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                  Name
                </th>
                <th scope="col" class="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                  Klasse
                </th>
                <th scope="col" class="px-5 py-3 text-right font-medium text-slate-700 dark:text-slate-200">
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

    <EntityDialog
      :open="dialogOpen"
      :title="editingId ? 'Spieler bearbeiten' : 'Neuer Spieler'"
      :description="editingId ? 'Bearbeite die Spielerinformationen' : 'Füge einen neuen Spieler hinzu'"
      :submit-label="editingId ? 'Speichern' : 'Hinzufügen'"
      :submit-disabled="!dialogName.trim() || myClasses.length === 0"
      @close="closeDialog"
      @submit="submitDialog"
    >
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
    </EntityDialog>
  </div>
</template>

