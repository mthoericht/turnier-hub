import "./stubs/vueDevtoolsNextHook";

import type { AfterEach } from "storybook/internal/csf";
import type { Preview } from "@storybook/vue3-vite";
import { setup } from "@storybook/vue3-vite";
import { createPinia } from "pinia";
import type { RouteLocationRaw } from "vue-router";
import { createMemoryHistory, createRouter } from "vue-router";
import "../../../client/src/style.css";

/** Minimal globals for `@vue/devtools-kit` when preview/docs iframes lack a full hook. */
function ensureVueDevtoolsKitGlobals()
{
  // Storybook preview/docs iframes may expose only partial devtools globals.
  // Stub the minimal records expected by `@vue/devtools-kit` to avoid runtime crashes.
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
const storybookRouter = createStorybookRouter();

setup((app) =>
{
  ensureVueDevtoolsKitGlobals();
  app.use(createPinia());
  app.use(storybookRouter);
});

/** In-memory router with named routes used by stories (`RouterLink`, `useRoute`). */
function createStorybookRouter()
{
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: { template: "<div />" } },
      { path: "/login", name: "login", component: { template: "<div />" } },
      { path: "/signup", name: "signup", component: { template: "<div />" } },
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

type StorybookRouteParameter = RouteLocationRaw | null | undefined;

/** Applies `parameters.route` to the preview router (no-op if unchanged / missing). */
async function applyRouteFromParameters(routeParam: StorybookRouteParameter)
{
  if (!routeParam)
  {
    return;
  }

  const routeTarget =
    typeof routeParam === "string"
      ? { path: routeParam }
      : routeParam;

  if (storybookRouter.currentRoute.value.fullPath === storybookRouter.resolve(routeTarget).fullPath)
  {
    return;
  }

  await storybookRouter.push(routeTarget);
}

/**
 * `@storybook/addon-a11y` runs axe only in Story view (`viewMode === "story"`).
 * In Docs view, emit a no-op report so the manager panel does not stay "running".
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

// Keep classic `Preview` + `setup`; `definePreview` can conflict with addon preview annotations.
const preview: Preview = {
  afterEach: afterEachA11yDocsWorkaround,
  decorators: [
    /**
     * Sync only: Vue Storybook decorators must return `story()` immediately.
     * Route navigation is fired without awaiting so the story component still mounts.
     */
    (story, context) =>
    {
      void applyRouteFromParameters(context.parameters?.route as StorybookRouteParameter);
      return story();
    },
  ],
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
};

export default preview;
