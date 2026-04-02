<!--
  Global single-line text prompt (rename / label input).

  Data and async API live in Pinia: useTextPromptDialogStore() → requestPrompt().
  Mount once next to the global confirm dialog in App.vue.

  Storybook: tests/client/storybook/stories/components/common/GlobalTextPromptDialog.stories.ts
-->
<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useId } from "vue";
import EntityDialog from "@/components/common/EntityDialog.vue";
import { useTextPromptDialogStore } from "@/stores/textPromptDialog";

const store = useTextPromptDialogStore();
const { open, title, description, submitLabel, inputLabel, placeholder, value } =
  storeToRefs(store);

const fieldId = useId();
</script>

<template>
  <EntityDialog
    :open="open"
    :title="title"
    :description="description"
    :submit-label="submitLabel"
    :submit-disabled="!value.trim()"
    @close="store.close"
    @submit="store.submit"
  >
    <div class="space-y-2">
      <label
        :for="fieldId"
        class="block text-sm font-medium text-slate-700"
      >
        {{ inputLabel }}
      </label>
      <input
        :id="fieldId"
        v-model="value"
        type="text"
        :placeholder="placeholder"
        autocomplete="off"
        maxlength="60"
        class="ui-input-blue min-h-[48px] sm:min-h-0 sm:text-sm"
      />
    </div>
  </EntityDialog>
</template>
