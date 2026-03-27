<script setup lang="ts">
import { formatCreator } from "@/types";
import AppIcon from "@/components/common/AppIcon.vue";
import ScopeToggle from "@/components/common/ScopeToggle.vue";
import EmptyStateCard from "@/components/common/EmptyStateCard.vue";
import EntityDialog from "@/components/common/EntityDialog.vue";

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
  "ui-input-blue min-h-[48px] dark:bg-slate-950 sm:min-h-0 sm:text-sm";
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
        <ScopeToggle v-model="scope" />

        <button
          type="button"
          class="ui-btn-primary-blue"
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
    <EmptyStateCard v-else-if="classes.length === 0" title="Noch keine Klassen erstellt" action-label="Erste Klasse erstellen" @action="openCreate">
      <template #icon>
      <AppIcon name="classes" class="mx-auto mb-4 h-12 w-12 text-slate-400" />
      </template>
    </EmptyStateCard>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="c in classes"
        :key="c.id"
        class="ui-card"
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
                <AppIcon name="edit" class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                title="Löschen"
                @click="remove(c.id)"
              >
                <AppIcon name="trash" class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <AppIcon name="players" class="h-4 w-4" />
            <span class="text-sm">{{ getPlayerCount(c.id) }} Spieler</span>
          </div>
        </div>
      </div>
    </div>

    <EntityDialog
      :open="dialogOpen"
      :title="editingId ? 'Klasse bearbeiten' : 'Neue Klasse'"
      :description="editingId ? 'Bearbeite die Klasseninformationen' : 'Füge eine neue Klasse hinzu'"
      :submit-label="editingId ? 'Speichern' : 'Hinzufügen'"
      :submit-disabled="!dialogName.trim()"
      @close="closeDialog"
      @submit="submitDialog"
    >
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
    </EntityDialog>
  </div>
</template>

