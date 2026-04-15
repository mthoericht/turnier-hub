<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import AuthFormField from "@/components/auth/AuthFormField.vue";
import { fetchAuthSchools } from "@/api/authApi";

const auth = useAuthStore();

const username = ref("");
const email = ref("");
const password = ref("");
const inviteCode = ref("");
const schoolId = ref("");
const schools = ref<{ id: string; name: string }[]>([]);
const error = ref("");
const loading = ref(false);
const schoolsLoading = ref(false);

const inputClass =
  "ui-input-court";

onMounted(() =>
{
  void loadSchools();
});

async function loadSchools(): Promise<void>
{
  schoolsLoading.value = true;
  try
  {
    const options = await fetchAuthSchools();
    const normalizedOptions = Array.isArray(options) ? options : [];
    schools.value = normalizedOptions;
    if (normalizedOptions.length > 0 && !schoolId.value)
    {
      schoolId.value = normalizedOptions[0]!.id;
    }
  }
  catch (e)
  {
    error.value = e instanceof Error ? e.message : "Schulen konnten nicht geladen werden";
  }
  finally
  {
    schoolsLoading.value = false;
  }
}

async function submit(): Promise<void> 
{
  error.value = "";
  if (!schoolId.value)
  {
    error.value = "Bitte eine Schule auswählen";
    return;
  }
  loading.value = true;
  try 
  {
    await auth.signup({
      username: username.value,
      email: email.value,
      password: password.value,
      inviteCode: inviteCode.value,
      schoolId: schoolId.value,
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
      class="mb-2 font-display text-xl font-semibold text-slate-900 sm:text-2xl"
    >
      Registrieren
    </h1>
    <p class="text-sm text-slate-500 mb-6">
      Registrierung nur mit gültigem Einladungscode. Spieler und Turniere gehören
      zu deinem Konto.
    </p>
    <form class="space-y-4" @submit.prevent="submit">
      <AuthFormField label="Schule" :input-class="inputClass">
        <template #default="{ fieldId, describedBy }">
          <select
            :id="fieldId"
            v-model="schoolId"
            required
            :class="inputClass"
            :disabled="schoolsLoading || schools.length === 0"
            :aria-describedby="describedBy"
            :aria-invalid="error ? 'true' : undefined"
          >
            <option value="" disabled>
              {{ schoolsLoading ? "Schulen werden geladen …" : "Schule wählen" }}
            </option>
            <option v-for="school in schools" :key="school.id" :value="school.id">
              {{ school.name }}
            </option>
          </select>
        </template>
      </AuthFormField>
      <AuthFormField label="Einladungscode" :input-class="inputClass">
        <template #default="{ fieldId, describedBy }">
          <input
            :id="fieldId"
            v-model="inviteCode"
            type="text"
            required
            autocomplete="off"
            :class="inputClass"
            :aria-describedby="describedBy"
            :aria-invalid="error ? 'true' : undefined"
          />
        </template>
      </AuthFormField>
      <AuthFormField
        label="Benutzername"
        :input-class="inputClass"
        help-text="3–32 Zeichen, nur Buchstaben, Ziffern, _ und -"
      >
        <template #default="{ fieldId, describedBy }">
          <input
            :id="fieldId"
            v-model="username"
            type="text"
            required
            minlength="3"
            maxlength="32"
            pattern="[a-zA-Z0-9_-]+"
            autocomplete="username"
            :class="inputClass"
            :aria-describedby="describedBy"
            :aria-invalid="error ? 'true' : undefined"
          />
        </template>
      </AuthFormField>
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
      <AuthFormField label="Passwort (min. 8)" :input-class="inputClass">
        <template #default="{ fieldId, describedBy }">
          <input
            :id="fieldId"
            v-model="password"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
            :class="inputClass"
            :aria-describedby="describedBy"
            :aria-invalid="error ? 'true' : undefined"
          />
        </template>
      </AuthFormField>
      <p
        v-if="error"
        class="text-sm text-rose-600"
        role="alert"
      >
        {{ error }}
      </p>
      <button
        type="submit"
        :disabled="loading"
        class="ui-btn-primary-court w-full"
      >
        {{ loading ? "…" : "Konto anlegen" }}
      </button>
    </form>
    <p class="mt-6 text-sm text-slate-500">
      Schon registriert?
      <RouterLink
        to="/login"
        class="text-court-800 underline underline-offset-2 hover:no-underline"
      >
        Login
      </RouterLink>
    </p>
  </div>
</template>
