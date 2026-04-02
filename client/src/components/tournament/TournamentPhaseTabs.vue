<script setup lang="ts">
import type { MatchPhase } from "@/tournament/tournamentContext";

type MatchesTab = "overview" | "group" | "r16" | "quarter" | "semi" | "final";

defineProps<{
  modelValue: MatchesTab;
  mode: "GROUP_KO" | "DIRECT_KO" | "ROUND_ROBIN";
  hasGroupMatches: boolean;
  hasR16Matches: boolean;
  hasQuarterMatches: boolean;
  hasSemiMatches: boolean;
  hasFinalMatches: boolean;
  formatPhaseLabel: (phase: MatchPhase) => string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: MatchesTab): void;
}>();
</script>

<template>
  <div
    class="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-1"
  >
    <button
      v-if="hasGroupMatches"
      type="button"
      class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
      :class="[
        modelValue === 'group'
          ? 'bg-blue-600 text-white'
          : 'text-slate-700 hover:bg-slate-100',
      ]"
      @click="emit('update:modelValue', 'group')"
    >
      {{ mode === "ROUND_ROBIN" ? "Jeder gegen Jeden" : "Gruppenspiele" }}
    </button>
    <button
      v-if="hasR16Matches"
      type="button"
      class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
      :class="[
        modelValue === 'r16'
          ? 'bg-blue-600 text-white'
          : 'text-slate-700 hover:bg-slate-100',
      ]"
      @click="emit('update:modelValue', 'r16')"
    >
      {{ formatPhaseLabel("ROUND_OF_16") }}
    </button>
    <button
      v-if="hasQuarterMatches"
      type="button"
      class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
      :class="[
        modelValue === 'quarter'
          ? 'bg-blue-600 text-white'
          : 'text-slate-700 hover:bg-slate-100',
      ]"
      @click="emit('update:modelValue', 'quarter')"
    >
      Viertelfinale
    </button>
    <button
      v-if="hasSemiMatches"
      type="button"
      class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
      :class="[
        modelValue === 'semi'
          ? 'bg-blue-600 text-white'
          : 'text-slate-700 hover:bg-slate-100',
      ]"
      @click="emit('update:modelValue', 'semi')"
    >
      Halbfinale
    </button>
    <button
      v-if="hasFinalMatches"
      type="button"
      class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
      :class="[
        modelValue === 'final'
          ? 'bg-blue-600 text-white'
          : 'text-slate-700 hover:bg-slate-100',
      ]"
      @click="emit('update:modelValue', 'final')"
    >
      Finale
    </button>
    <button
      type="button"
      class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
      :class="[
        modelValue === 'overview'
          ? 'bg-blue-600 text-white'
          : 'text-slate-700 hover:bg-slate-100',
      ]"
      @click="emit('update:modelValue', 'overview')"
    >
      Alle
    </button>
  </div>
</template>
