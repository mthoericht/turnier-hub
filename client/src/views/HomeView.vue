<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { RouterLink } from "vue-router";

const auth = useAuthStore();
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1
        class="font-display text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl mb-2 text-balance break-words"
      >
        Hallo{{
          auth.user
            ? `, ${auth.user.username ?? auth.user.email.split("@")[0]}`
            : ""
        }}
      </h1>
      <p class="max-w-xl text-base text-slate-600 dark:text-slate-400 sm:text-[1.05rem]">
        Verwalte Spieler, Turniere und Ergebnisse für Schulsportarten wie
        Volleyball, Fußball oder Zwei-Felderball — inklusive Stoppuhr und
        K.-o.-Runden: Mannschaften spielen gegeneinander, Spieler sind Kader.
        Alle Nutzer sehen die Daten; du bearbeitest nur deine eigenen Turniere.
      </p>
    </div>
    <div v-if="auth.user" class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <RouterLink
        to="/players"
        class="rounded-xl border border-slate-300 bg-white/80 px-5 py-3 text-center text-court-800 transition hover:border-court-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-court-100 dark:hover:border-court-600 sm:inline-block sm:text-left"
      >
        Spieler verwalten
      </RouterLink>
      <RouterLink
        to="/classes"
        class="rounded-xl border border-slate-300 bg-white/80 px-5 py-3 text-center text-court-800 transition hover:border-court-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-court-100 dark:hover:border-court-600 sm:inline-block sm:text-left"
      >
        Klassen verwalten
      </RouterLink>
      <RouterLink
        to="/tournaments"
        class="rounded-xl bg-court-600 px-5 py-3 text-center font-medium text-white transition hover:bg-court-600/90 sm:inline-block"
      >
        Zu den Turnieren
      </RouterLink>
    </div>
    <div
      v-else
      class="max-w-md rounded-2xl border border-slate-200 bg-white/60 p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900/40"
    >
      <p class="text-slate-700 mb-4 dark:text-slate-300">
        Melde dich an oder registriere dich mit dem Einladungscode.
      </p>
      <div class="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <RouterLink
          to="/login"
          class="rounded-lg border border-slate-300 px-4 py-3 text-center text-slate-800 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 sm:py-2"
        >
          Login
        </RouterLink>
        <RouterLink
          to="/signup"
          class="rounded-lg bg-court-600 px-4 py-3 text-center font-medium text-white transition hover:bg-court-600/90 sm:py-2"
        >
          Registrieren
        </RouterLink>
      </div>
    </div>
  </div>
</template>
