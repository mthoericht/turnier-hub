<script setup lang="ts">
import CatalogPageHeader from "@/components/common/CatalogPageHeader.vue";
import AdminSchoolsSection from "@/components/admin/AdminSchoolsSection.vue";
import AdminSchoolDialog from "@/components/admin/AdminSchoolDialog.vue";
import AdminAuditLogSection from "@/components/admin/AdminAuditLogSection.vue";
import { useAdminManagementState } from "@/composables/admin/useAdminManagementState";

const {
  loading,
  error,
  schools,
  auditLogs,
  schoolDialogOpen,
  schoolDialogId,
  schoolDialogName,
  isAdmin,
  inputClass,
  openCreateSchool,
  openEditSchool,
  closeSchoolDialog,
  submitSchoolDialog,
  removeSchool,
} = useAdminManagementState();
</script>

<template>
  <div>
    <CatalogPageHeader title="Admin" />

    <div v-if="!isAdmin" class="ui-empty-card">
      <p class="text-slate-700">
        Diese Ansicht ist nur mit Admin-Rechten verfügbar.
      </p>
    </div>

    <template v-else>
      <p
        class="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        role="note"
      >
        Hinweis: Diese Admin-Ansicht ist nur fuer erfahrene Nutzer gedacht. Bitte
        Änderungen mit Bedacht vornehmen.
      </p>
      <p v-if="error" class="mb-4 text-sm text-rose-700" role="alert">
        {{ error }}
      </p>
      <p v-if="loading" class="text-slate-500">
        Lade …
      </p>

      <div v-else class="space-y-8">
        <AdminSchoolsSection
          :schools="schools"
          @create-school="openCreateSchool"
          @edit-school="openEditSchool"
          @remove-school="removeSchool"
        />

        <AdminAuditLogSection :logs="auditLogs" />
      </div>
    </template>

    <AdminSchoolDialog
      :open="schoolDialogOpen"
      :editing-id="schoolDialogId"
      v-model="schoolDialogName"
      :input-class="inputClass"
      @close="closeSchoolDialog"
      @submit="submitSchoolDialog"
    />
  </div>
</template>
