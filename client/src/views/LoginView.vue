<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import AuthFormField from "@/components/auth/AuthFormField.vue";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

const inputClass =
  "ui-input-court";

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
      <AuthFormField label="E-Mail" :input-class="inputClass">
        <template #default="{ fieldId, describedBy }">
          <input
            :id="fieldId"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            :class="inputClass"
            :aria-describedby="describedBy"
            :aria-invalid="error ? 'true' : undefined"
          />
        </template>
      </AuthFormField>
      <AuthFormField label="Passwort" :input-class="inputClass">
        <template #default="{ fieldId, describedBy }">
          <input
            :id="fieldId"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            :class="inputClass"
            :aria-describedby="describedBy"
            :aria-invalid="error ? 'true' : undefined"
          />
        </template>
      </AuthFormField>
      <p
        v-if="error"
        class="text-sm text-rose-600 dark:text-rose-400"
        role="alert"
      >
        {{ error }}
      </p>
      <button
        type="submit"
        :disabled="loading"
        class="ui-btn-primary-court w-full"
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
