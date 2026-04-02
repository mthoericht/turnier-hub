<script setup lang="ts">
type KnockoutStageKey = "ROUND_OF_16" | "QUARTER" | "SEMI" | "FINAL";

defineProps<{
  canCreateR16: boolean;
  canCreateQuarter: boolean;
  canCreateSemi: boolean;
  canCreateFinal: boolean;
  hasR16Matches: boolean;
  isR16Current: boolean;
  r16HasScores: boolean;
  hasQuarterMatches: boolean;
  isQuarterCurrent: boolean;
  quarterHasScores: boolean;
  hasSemiMatches: boolean;
  isSemiCurrent: boolean;
  semiHasScores: boolean;
  hasFinalMatches: boolean;
  isFinalCurrent: boolean;
  finalHasScores: boolean;
}>();

const emit = defineEmits<{
  (e: "advance", phase: KnockoutStageKey): void;
}>();

const btnClass =
  "min-h-[44px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-left text-sm text-amber-950 hover:bg-amber-100 sm:min-h-0 sm:py-1.5";
</script>

<template>
  <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
    <button
      v-if="canCreateR16"
      type="button"
      :class="btnClass"
      @click="emit('advance', 'ROUND_OF_16')"
    >
      <span class="font-medium">Achtelfinale</span>
      <span class="block text-xs opacity-90">16 Mannschaften</span>
      <span
        v-if="hasR16Matches && isR16Current"
        class="block text-[11px] opacity-85"
      >
        Bereits erzeugt
        <span v-if="r16HasScores"> (Punkte vergeben)</span>
      </span>
    </button>
    <button
      v-if="canCreateQuarter"
      type="button"
      :class="btnClass"
      @click="emit('advance', 'QUARTER')"
    >
      <span class="font-medium">Viertelfinale</span>
      <span class="block text-xs opacity-90">8 Mannschaften</span>
      <span
        v-if="hasQuarterMatches && isQuarterCurrent"
        class="block text-[11px] opacity-85"
      >
        Bereits erzeugt
        <span v-if="quarterHasScores"> (Punkte vergeben)</span>
      </span>
    </button>
    <button
      v-if="canCreateSemi"
      type="button"
      :class="btnClass"
      @click="emit('advance', 'SEMI')"
    >
      <span class="font-medium">Halbfinale</span>
      <span class="block text-xs opacity-90">4 Mannschaften</span>
      <span
        v-if="hasSemiMatches && isSemiCurrent"
        class="block text-[11px] opacity-85"
      >
        Bereits erzeugt
        <span v-if="semiHasScores"> (Punkte vergeben)</span>
      </span>
    </button>
    <button
      v-if="canCreateFinal"
      type="button"
      :class="btnClass"
      @click="emit('advance', 'FINAL')"
    >
      <span class="font-medium">Finale</span>
      <span class="block text-xs opacity-90">2 Mannschaften</span>
      <span
        v-if="hasFinalMatches && isFinalCurrent"
        class="block text-[11px] opacity-85"
      >
        Bereits erzeugt
        <span v-if="finalHasScores"> (Punkte vergeben)</span>
      </span>
    </button>
  </div>
</template>
