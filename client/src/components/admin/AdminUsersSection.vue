<script setup lang="ts">
import type { AdminSchool, AdminUser } from "@/api/adminApi";
import type { UserRole } from "@turnier-hub/shared";

defineProps<{
  users: AdminUser[];
  schools: AdminSchool[];
  selectClass: string;
  currentUserId?: string;
}>();

defineEmits<{
  (e: "update-user-school", payload: { user: AdminUser; schoolId: string }): void;
  (e: "update-user-role", payload: { user: AdminUser; role: UserRole }): void;
}>();
</script>

<template>
  <section class="ui-card p-5">
    <h2 class="font-display text-lg font-semibold text-slate-900">Benutzerrechte</h2>
    <p class="mb-4 text-sm text-slate-600">
      Benutzer anzeigen und Rollen zwischen `user` und `admin` ändern.
    </p>

    <div v-if="users.length === 0" class="ui-empty-card">
      <p class="text-slate-600">Keine Benutzer gefunden.</p>
    </div>
    <div v-else class="overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <caption class="sr-only">Benutzerliste</caption>
        <thead class="border-b border-slate-200 text-slate-600">
          <tr>
            <th scope="col" class="px-3 py-2">Benutzer</th>
            <th scope="col" class="px-3 py-2">E-Mail</th>
            <th scope="col" class="px-3 py-2">Schule</th>
            <th scope="col" class="px-3 py-2">Rolle</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" class="border-b border-slate-100">
            <td class="px-3 py-2 font-medium text-slate-900">
              {{ user.username ? `@${user.username}` : "—" }}
            </td>
            <td class="px-3 py-2 text-slate-700">{{ user.email }}</td>
            <td class="px-3 py-2">
              <select
                :class="selectClass"
                :value="user.school.id"
                :aria-label="`Schule für ${user.username ? `@${user.username}` : user.email}`"
                @change="$emit('update-user-school', { user, schoolId: ($event.target as HTMLSelectElement).value })"
              >
                <option
                  v-for="school in schools"
                  :key="school.id"
                  :value="school.id"
                >
                  {{ school.name }}
                </option>
              </select>
            </td>
            <td class="px-3 py-2">
              <select
                :class="selectClass"
                :value="user.role"
                :disabled="currentUserId === user.id"
                :aria-label="`Rolle für ${user.username ? `@${user.username}` : user.email}`"
                @change="$emit('update-user-role', { user, role: ($event.target as HTMLSelectElement).value as UserRole })"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
