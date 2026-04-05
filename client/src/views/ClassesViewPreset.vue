<script setup lang="ts">
import { formatCreator } from "@/types";
import AppIcon from "@/components/common/AppIcon.vue";
import CatalogPageHeader from "@/components/common/CatalogPageHeader.vue";
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
  openCreate,
  openEdit,
  closeDialog,
  submitDialog,
  remove,
} = useClassesManagementState();

const inputClass =
  "ui-input-blue min-h-[48px] sm:min-h-0 sm:text-sm";
</script>

<template>
  <div>
    <CatalogPageHeader title="Klassen">
      <template #description>
        <p class="text-sm text-slate-600">
          Schulklassen im gemeinsamen Katalog. Beim Anlegen oder Bearbeiten von
          Spielern kann jede Klasse zugewiesen werden — oder keine.
        </p>
      </template>
      <template #actions>
        <ScopeToggle v-model="scope" />

        <button
          type="button"
          class="ui-btn-primary-blue"
          @click="openCreate"
        >
          + Neue Klasse
        </button>
      </template>
    </CatalogPageHeader>

    <p
      v-if="error"
      class="mb-4 text-sm text-rose-600"
      role="alert"
    >
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
                class="font-display text-lg font-semibold text-slate-900 truncate"
              >
                {{ c.name }}
              </p>
              <p class="text-sm text-slate-500 mt-1 truncate">
                Schulklasse
              </p>
              <p
                class="mt-2 text-xs text-slate-500 truncate"
                :title="c.createdBy.email"
              >
                Von {{ formatCreator(c.createdBy) }}
              </p>
            </div>
            <div class="flex gap-2 shrink-0">
              <button
                type="button"
                class="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
                title="Bearbeiten"
                aria-label="Klasse bearbeiten"
                @click="openEdit(c)"
              >
                <AppIcon name="edit" class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                title="Löschen"
                aria-label="Klasse löschen"
                @click="remove(c.id)"
              >
                <AppIcon name="trash" class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2 text-slate-600">
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
      @close="closeDialog"
      @submit="submitDialog"
    >
      <div class="space-y-2">
        <label
          class="block text-sm font-medium text-slate-700"
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

