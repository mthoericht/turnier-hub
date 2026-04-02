<script setup lang="ts">
import type { TournamentListRow } from "@/api/tournamentsApi";
import TournamentsListItem from "@/components/tournaments/TournamentsListItem.vue";

defineProps<{
  list: TournamentListRow[];
  loading: boolean;
  remove: (id: string) => Promise<void>;
}>();
</script>

<template>
  <p v-if="loading" class="text-slate-500">Lade …</p>
  <ul v-else class="space-y-2">
    <TournamentsListItem
      v-for="t in list"
      :key="t.id"
      :t="t"
      :remove="remove"
    />
  </ul>
</template>

