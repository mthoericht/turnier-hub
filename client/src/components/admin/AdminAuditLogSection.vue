<script setup lang="ts">
import type { AdminAuditLog } from "@/api/adminApi";

defineProps<{
  logs: AdminAuditLog[];
}>();
</script>

<template>
  <section class="ui-card p-5">
    <h2 class="font-display text-lg font-semibold text-slate-900">Aktivität</h2>
    <p class="mb-4 text-sm text-slate-600">
      Letzte Admin-Änderungen mit Zeitstempel und Benutzer.
    </p>

    <div v-if="logs.length === 0" class="ui-empty-card">
      <p class="text-slate-600">Noch keine Aktivitäten erfasst.</p>
    </div>
    <div v-else class="overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <caption class="sr-only">Admin-Aktivitätslog</caption>
        <thead class="border-b border-slate-200 text-slate-600">
          <tr>
            <th scope="col" class="px-3 py-2">Zeit</th>
            <th scope="col" class="px-3 py-2">Aktion</th>
            <th scope="col" class="px-3 py-2">Ziel</th>
            <th scope="col" class="px-3 py-2">Durch</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id" class="border-b border-slate-100">
            <td class="px-3 py-2 text-slate-700">
              {{ new Date(log.createdAt).toLocaleString("de-DE") }}
            </td>
            <td class="px-3 py-2 font-medium text-slate-900">{{ log.action }}</td>
            <td class="px-3 py-2 text-slate-700">{{ log.targetType }} / {{ log.targetId }}</td>
            <td class="px-3 py-2 text-slate-700">
              {{ log.actor.username ? `@${log.actor.username}` : log.actor.email }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
