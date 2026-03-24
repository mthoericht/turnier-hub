<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

const username = ref("");
const email = ref("");
const password = ref("");
const inviteCode = ref("ballspiele2026");
const error = ref("");
const loading = ref(false);

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-transparent focus:ring-2 focus:ring-court-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:py-2";

async function submit(): Promise<void> 
{
  error.value = "";
  loading.value = true;
  try 
  {
    await auth.signup({
      username: username.value,
      email: email.value,
      password: password.value,
      inviteCode: inviteCode.value,
    });
  }
  catch (e) 
  {
    error.value = e instanceof Error ? e.message : "Registrierung fehlgeschlagen";
  }
  finally 
  {
    loading.value = false;
  }
}
</script>

<template>
  <div class="max-w-md mx-auto">
    <h1
      class="mb-2 font-display text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl"
    >
      Registrieren
    </h1>
    <p class="text-sm text-slate-500 mb-6">
      Registrierung nur mit gültigem Einladungscode. Spieler und Turniere gehören
      zu deinem Konto.
    </p>
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label
          class="block text-sm text-slate-600 dark:text-slate-400 mb-1"
          >Einladungscode</label
        >
        <input
          v-model="inviteCode"
          type="text"
          required
          :class="inputClass"
        />
      </div>
      <div>
        <label
          class="block text-sm text-slate-600 dark:text-slate-400 mb-1"
          >Benutzername</label
        >
        <input
          v-model="username"
          type="text"
          required
          minlength="3"
          maxlength="32"
          pattern="[a-zA-Z0-9_-]+"
          autocomplete="username"
          :class="inputClass"
        />
        <p class="text-xs text-slate-500 mt-1">
          3–32 Zeichen, nur Buchstaben, Ziffern, _ und -
        </p>
      </div>
      <div>
        <label
          class="block text-sm text-slate-600 dark:text-slate-400 mb-1"
          >E-Mail</label
        >
        <input
          v-model="email"
          type="email"
          required
          autocomplete="email"
          :class="inputClass"
        />
      </div>
      <div>
        <label
          class="block text-sm text-slate-600 dark:text-slate-400 mb-1"
          >Passwort (min. 8)</label
        >
        <input
          v-model="password"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
          :class="inputClass"
        />
      </div>
      <p v-if="error" class="text-sm text-rose-600 dark:text-rose-400">
        {{ error }}
      </p>
      <button
        type="submit"
        :disabled="loading"
        class="min-h-[48px] w-full rounded-lg bg-court-600 py-3 text-base font-medium text-white transition hover:bg-court-600/90 disabled:opacity-50 sm:min-h-0 sm:py-2.5"
      >
        {{ loading ? "…" : "Konto anlegen" }}
      </button>
    </form>
    <p class="mt-6 text-sm text-slate-500">
      Schon registriert?
      <RouterLink
        to="/login"
        class="text-court-800 hover:underline dark:text-court-100"
      >
        Login
      </RouterLink>
    </p>
  </div>
</template>
