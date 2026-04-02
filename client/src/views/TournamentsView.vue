<script setup lang="ts">
import { useTournamentsListState } from "@/composables/tournaments/useTournamentsListState";
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
  isMine,
} = useTournamentsListState();
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
      <div class="flex items-center gap-3">
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

    <div class="mb-8">
      <NewTournament
        v-model:name="name"
        v-model:sport="sport"
        v-model:mode="mode"
        v-model:teamsAreIndividuals="teamsAreIndividuals"
        :create-t="createT"
      />

      <TournamentsList
        :list="list"
        :loading="loading"
        :is-mine="isMine"
        :remove="remove"
      />
    </div>
  </div>
</template>
