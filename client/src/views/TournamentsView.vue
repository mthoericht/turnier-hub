<script setup lang="ts">
import { ref, toRef, useId } from "vue";
import { useTournamentsListState } from "@/composables/tournaments/useTournamentsListState";
import { useDialogFocusTrap } from "@/composables/useDialogFocusTrap";
import NewTournament from "@/components/tournaments/NewTournament.vue";
import TournamentsList from "@/components/tournaments/TournamentsList.vue";
import ScopeToggle from "@/components/common/ScopeToggle.vue";

const {
  scope,
  list,
  loading,
  error,
  name,
  sport,
  mode,
  teamsAreIndividuals,
  createT,
  remove,
} = useTournamentsListState();

const newTournamentDialogOpen = ref(false);
const newTournamentDialogRootRef = ref<HTMLElement | null>(null);
const newTournamentHeadingId = useId();

function closeNewTournamentDialog(): void
{
  newTournamentDialogOpen.value = false;
}

useDialogFocusTrap(
  toRef(newTournamentDialogOpen),
  newTournamentDialogRootRef,
  closeNewTournamentDialog
);
</script>

<template>
  <div>
    <div
      class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <h1
        class="font-display text-xl font-semibold text-slate-900 sm:text-2xl"
      >
        Turniere
      </h1>
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="rounded-lg bg-blue-600 px-5 py-3 text-base font-medium text-white hover:bg-blue-600/90 sm:py-2 sm:text-sm"
          @click="newTournamentDialogOpen = true"
        >
          Turnier anlegen
        </button>
        <ScopeToggle v-model="scope" />
      </div>
    </div>
    <p
      v-if="error"
      class="mb-4 text-sm text-rose-600"
      role="alert"
    >
      {{ error }}
    </p>

    <div
      v-if="newTournamentDialogOpen"
      ref="newTournamentDialogRootRef"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-3"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="newTournamentHeadingId"
      @click.self="closeNewTournamentDialog"
    >
      <div
        class="ui-card max-h-[90vh] w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-lg"
        @click.stop
      >
        <NewTournament
          :heading-id="newTournamentHeadingId"
          v-model:name="name"
          v-model:sport="sport"
          v-model:mode="mode"
          v-model:teamsAreIndividuals="teamsAreIndividuals"
          :create-t="createT"
          @cancel="closeNewTournamentDialog"
          @created="closeNewTournamentDialog"
        />
      </div>
    </div>

    <div class="mb-8">
      <TournamentsList
        :list="list"
        :loading="loading"
        :remove="remove"
      />
    </div>
  </div>
</template>
