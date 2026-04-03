import "./stubs/vueDevtoolsNextHook";

import type { AfterEach } from "storybook/internal/csf";
import type { Preview } from "@storybook/vue3-vite";
import { setup } from "@storybook/vue3-vite";
import { createPinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import "../../../client/src/style.css";

function ensureVueDevtoolsKitGlobals()
{
  // Storybook's preview/docs iframe doesn't always provide a full devtools bridge.
  // `@vue/devtools-kit` then throws while reading `__VUE_DEVTOOLS_KIT_ACTIVE_APP_RECORD__.app`.
  // We stub the minimal global records so switching views doesn't crash the runner.
  const g = globalThis as unknown as Record<string, unknown>;
  const existingRecord = g.__VUE_DEVTOOLS_KIT_ACTIVE_APP_RECORD__;
  if (!existingRecord || typeof existingRecord !== "object")
  {
    g.__VUE_DEVTOOLS_KIT_ACTIVE_APP_RECORD__ = { app: {}, instanceMap: new Map() };
  }
  else
  {
    const record = existingRecord as Record<string, unknown>;
    record.app ??= {};
    if (!record.instanceMap || !(record.instanceMap instanceof Map))
    {
      record.instanceMap = new Map();
    }
    g.__VUE_DEVTOOLS_KIT_ACTIVE_APP_RECORD__ = record;
  }
  g.__VUE_DEVTOOLS_KIT_ACTIVE_APP_RECORD_ID__ ??= "";
  g.__VUE_DEVTOOLS_KIT_APP_RECORDS__ ??= [];
}

ensureVueDevtoolsKitGlobals();

setup((app) =>
{
  ensureVueDevtoolsKitGlobals();
  app.use(createPinia());
  app.use(createStorybookRouter());
});

function createStorybookRouter()
{
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: { template: "<div />" } },
      {
        path: "/tournaments",
        name: "tournaments-list",
        component: { template: "<div />" },
      },
      {
        path: "/tournaments/:id/roster",
        name: "tournament-roster",
        component: { template: "<div />" },
      },
      {
        path: "/tournaments/:id/matches/setup",
        name: "tournament-matches-setup",
        component: { template: "<div />" },
      },
      { path: "/classes", name: "classes", component: { template: "<div />" } },
      { path: "/players", name: "players", component: { template: "<div />" } },
      { path: "/:pathMatch(.*)*", name: "catch-all", component: { template: "<div />" } },
    ],
  });
}

/**
 * @storybook/addon-a11y runs axe only when `viewMode === "story"`, but the manager still
 * sets the Accessibility panel to "running" after `afterEach`. In Docs view no a11y report
 * is emitted, so the panel can stay on "Accessibility scan in progress" indefinitely.
 */
const afterEachA11yDocsWorkaround: AfterEach = async (context) =>
{
  const { viewMode, reporting, parameters, globals } = context;
  if (viewMode === "story")
  {
    return;
  }
  if (parameters?.a11y?.disable === true || parameters?.a11y?.test === "off")
  {
    return;
  }
  if (globals?.a11y?.manual === true)
  {
    return;
  }
  reporting.addReport({
    type: "a11y",
    version: 1,
    result: {
      violations: [],
      passes: [],
      incomplete: [],
    },
    status: "passed",
  });
};

// Classic `Preview` + `setup` instead of `definePreview({ addons: [] })`, which can interact oddly
// with addon preview annotations. A11y uses default body context + axe excludes.
const preview: Preview = {
  afterEach: afterEachA11yDocsWorkaround,
  parameters: {
    layout: "padded",
    backgrounds: {
      default: "canvas",
      options: {
        canvas: { name: "canvas", value: "#f8fafc" },
        white: { name: "white", value: "#ffffff" },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "error",
    },
    docs: {
      story: { inline: false },
    },
  },
  decorators: [
    (story) => ({
      components: { story },
      mounted()
      {
        ensureVueDevtoolsKitGlobals();
      },
      updated()
      {
        ensureVueDevtoolsKitGlobals();
      },
      template: `
        <div
          class="sb-canvas-root box-border min-h-[50vh] w-full p-6 text-slate-900 antialiased"
          style="font-family: system-ui, sans-serif;"
        >
          <story />
        </div>
      `,
    }),
  ],
};

export default preview;
