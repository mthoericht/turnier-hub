import type { Meta, StoryObj } from "@storybook/vue3-vite";
import ClassesViewPreset from "@/views/ClassesViewPreset.vue";
import {
  resetClassesStoryState,
  setClassesStoryState,
} from "@/composables/classes/useClassesManagementState";
import type { SchoolClass } from "@turnier-hub/shared";

const meta: Meta<typeof ClassesViewPreset> = {
  title: "Views/ClassesViewPreset",
  component: ClassesViewPreset,
};

export default meta;

type Story = StoryObj<typeof ClassesViewPreset>;

const populatedClasses: SchoolClass[] = [
  {
    id: "class-1",
    name: "10a",
    createdBy: {
      subject: "coach",
    },
  },
  {
    id: "class-2",
    name: "9b",
    createdBy: {
      subject: "teacher",
    },
  },
];

function buildStory(classes: SchoolClass[]): Story
{
  return {
    parameters: {
      route: "/classes",
    },
    render: () =>
    {
      resetClassesStoryState();
      setClassesStoryState({ classes });
      return {
        components: { ClassesViewPreset },
        template: `<ClassesViewPreset />`,
      };
    },
  };
}

export const Default: Story = buildStory(populatedClasses);

export const Empty: Story = buildStory([]);

