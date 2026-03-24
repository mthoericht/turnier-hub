<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const email = ref("");
const password = ref("");
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
    await auth.login(email.value, password.value);
    const r = route.query.redirect as string | undefined;
    await router.replace(r && r.startsWith("/") ? r : "/");
  }
  catch (e) 
  {
    error.value = e instanceof Error ? e.message : "Login fehlgeschlagen";
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
      class="mb-6 font-display text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl"
    >
      Login
    </h1>
    <form class="space-y-4" @submit.prevent="submit">
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
          >Passwort</label
        >
        <input
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
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
        {{ loading ? "…" : "Anmelden" }}
      </button>
    </form>
    <p class="mt-6 text-sm text-slate-500 dark:text-slate-500">
      Noch kein Konto?
      <RouterLink
        to="/signup"
        class="text-court-800 hover:underline dark:text-court-100"
      >
        Registrieren
      </RouterLink>
    </p>
  </div>
</template>
