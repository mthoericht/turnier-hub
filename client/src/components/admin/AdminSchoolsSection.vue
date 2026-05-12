<script setup lang="ts">
import AppIcon from "@/components/common/AppIcon.vue";
import type { AdminSchool } from "@/api/adminApi";

defineProps<{
  schools: AdminSchool[];
}>();

defineEmits<{
  (e: "create-school"): void;
  (e: "edit-school", school: AdminSchool): void;
  (e: "remove-school", school: AdminSchool): void;
}>();
</script>

<template>
  <section class="ui-card p-5">
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 class="font-display text-lg font-semibold text-slate-900">
          Schulen
        </h2>
        <p class="text-sm text-slate-600">
          Schulen anlegen, umbenennen und löschen.
        </p>
      </div>
      <button type="button" class="ui-btn-primary-blue" @click="$emit('create-school')">
        + Schule anlegen
      </button>
    </div>

    <div v-if="schools.length === 0" class="ui-empty-card">
      <p class="text-slate-600">Noch keine Schulen vorhanden.</p>
    </div>
    <div v-else class="overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <caption class="sr-only">Schulliste</caption>
        <thead class="border-b border-slate-200 text-slate-600">
          <tr>
            <th scope="col" class="px-3 py-2">Name</th>
            <th scope="col" class="px-3 py-2">Klassen / Spieler / Turniere</th>
            <th scope="col" class="px-3 py-2 text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="school in schools" :key="school.id" class="border-b border-slate-100">
            <td class="px-3 py-2 font-medium text-slate-900">{{ school.name }}</td>
            <td class="px-3 py-2 text-slate-600">{{ school.catalogCount }}</td>
            <td class="px-3 py-2">
              <div class="flex justify-end gap-2">
                <button type="button" class="rounded-lg p-2 text-slate-700 hover:bg-slate-100" title="Bearbeiten" aria-label="Schule bearbeiten" @click="$emit('edit-school', school)">
                  <AppIcon name="edit" class="h-4 w-4" />
                </button>
                <button type="button" class="rounded-lg p-2 text-rose-600 hover:bg-rose-50" title="Löschen" aria-label="Schule löschen" @click="$emit('remove-school', school)">
                  <AppIcon name="trash" class="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
