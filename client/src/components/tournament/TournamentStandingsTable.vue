<script setup lang="ts">
import { onMounted, onUnmounted, ref, useId } from "vue";
import type { StandingTeamRow } from "@/tournament/tournamentContext";

defineProps<{
  standingsGroups: Record<string, StandingTeamRow[]>;
  cardClass: string;
}>();

const showHelp = ref(false);
const helpRef = ref<HTMLElement | null>(null);
const helpPanelId = useId();

function handleDocumentClick(event: MouseEvent): void
{
  if (!showHelp.value) return;
  const target = event.target as Node | null;
  if (!target) return;
  if (helpRef.value?.contains(target)) return;
  showHelp.value = false;
}

onMounted(() =>
{
  document.addEventListener("click", handleDocumentClick);
});

onUnmounted(() =>
{
  document.removeEventListener("click", handleDocumentClick);
});
</script>

<template>
  <section
    v-if="Object.keys(standingsGroups).length"
    :class="[cardClass, 'space-y-4']"
  >
    <div class="flex items-center gap-2">
      <h2
        class="font-display font-semibold text-lg text-slate-900"
      >
        Tabelle
      </h2>
      <div ref="helpRef" class="relative">
        <button
          type="button"
          class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          aria-label="Hilfe zur Tabelle anzeigen"
          :aria-expanded="showHelp"
          :aria-controls="helpPanelId"
          @click="showHelp = !showHelp"
        >
          ?
        </button>
        <div
          v-if="showHelp"
          :id="helpPanelId"
          role="region"
          aria-label="Legende zur Tabelle"
          class="absolute left-0 top-8 z-50 w-[min(24rem,calc(100vw-2rem))] max-w-[90vw] rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg sm:w-96"
        >
          <p class="mb-2 font-semibold">Legende</p>
          <p>Sp = Spiele, S = Siege, U = Unentschieden, N = Niederlagen</p>
          <p class="mt-1">Tore = erzielte : kassierte Tore</p>
          <p class="mt-1">Pkt = Punkte (Sieg 3, Unentschieden 1, Niederlage 0)</p>
        </div>
      </div>
    </div>
    <div
      v-for="(rows, poolName) in standingsGroups"
      :key="poolName"
      class="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0"
    >
      <h3
        v-if="Object.keys(standingsGroups).length > 1"
        class="mb-2 text-sm font-medium text-blue-800"
      >
        {{ poolName }}
      </h3>
      <table
        class="w-full min-w-[18rem] text-left text-sm text-slate-900"
      >
        <caption class="sr-only">
          {{ poolName }} — Tabelle
        </caption>
        <thead>
          <tr
            class="border-b border-slate-200 text-slate-600"
          >
            <th scope="col" class="py-2 pr-4">#</th>
            <th scope="col" class="py-2 pr-4">Mannschaft</th>
            <th scope="col" class="py-2 pr-2">Sp</th>
            <th scope="col" class="py-2 pr-2">S</th>
            <th scope="col" class="py-2 pr-2">U</th>
            <th scope="col" class="py-2 pr-2">N</th>
            <th scope="col" class="py-2 pr-2">Tore</th>
            <th scope="col" class="py-2">Pkt</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in rows"
            :key="row.team.id"
            class="border-b border-slate-200/90"
          >
            <td class="py-2 pr-4 text-slate-500">
              {{ idx + 1 }}
            </td>
            <td class="py-2 pr-4 font-medium text-slate-900">
              {{ row.team.name }}
            </td>
            <td class="py-2 pr-2">{{ row.played }}</td>
            <td class="py-2 pr-2">{{ row.wins }}</td>
            <td class="py-2 pr-2">{{ row.draws }}</td>
            <td class="py-2 pr-2">{{ row.losses }}</td>
            <td class="py-2 pr-2">{{ row.goalsFor }}:{{ row.goalsAgainst }}</td>
            <td
              class="py-2 font-medium text-blue-800"
            >
              {{ row.points }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
