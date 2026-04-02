import type { Meta, StoryObj } from "@storybook/vue3-vite";
import AuthFormField from "@/components/auth/AuthFormField.vue";

const meta: Meta<typeof AuthFormField> = {
  title: "Auth/AuthFormField",
  component: AuthFormField,
  args: {
    label: "E-Mail",
    inputClass: "ui-input w-full max-w-md",
    helpText: "Wir senden dir keinen Spam.",
  },
  parameters: {
    // Shown in Docs; `@storybook/vue3` sourceDecorator skips expensive generation when `code` is set
    // (see root patch: patches/@storybook+vue3+10.3.3.patch).
    docs: {
      source: {
        code: `<template>
  <div class="max-w-md p-4">
    <AuthFormField
      label="E-Mail"
      input-class="ui-input w-full max-w-md"
      help-text="Wir senden dir keinen Spam."
    >
      <template #default="{ fieldId, describedBy }">
        <input
          :id="fieldId"
          type="email"
          :aria-describedby="describedBy"
          class="ui-input w-full max-w-md"
          placeholder="name@schule.de"
        />
      </template>
    </AuthFormField>
  </div>
</template>`,
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof AuthFormField>;

export const WithTextInput: Story = {
  render: (args) => ({
    components: { AuthFormField },
    setup()
    {
      return { args };
    },
    template: `
      <div class="max-w-md p-4">
        <AuthFormField v-bind="args">
          <template #default="{ fieldId, describedBy }">
            <input
              :id="fieldId"
              type="email"
              :aria-describedby="describedBy"
              :class="args.inputClass"
              placeholder="name@schule.de"
            />
          </template>
        </AuthFormField>
      </div>
    `,
  }),
};

export const WithoutHelp: Story = {
  args: {
    helpText: undefined,
    label: "Passwort",
  },
  render: (args) => ({
    components: { AuthFormField },
    setup()
    {
      return { args };
    },
    template: `
      <div class="max-w-md p-4">
        <AuthFormField v-bind="args">
          <template #default="{ fieldId, describedBy }">
            <input
              :id="fieldId"
              type="password"
              :aria-describedby="describedBy"
              :class="args.inputClass"
            />
          </template>
        </AuthFormField>
      </div>
    `,
  }),
};
