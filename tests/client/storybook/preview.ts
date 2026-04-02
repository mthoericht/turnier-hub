import "./stubs/vueDevtoolsNextHook";

import { definePreview, setup } from "@storybook/vue3-vite";
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

function isVueDevtoolsPrepareAppReadError(reason: unknown): boolean
{
  const message = (reason as { message?: unknown } | undefined)?.message ?? reason;
  if (typeof message !== "string")
  {
    return false;
  }
  return (
    message.includes("Cannot read properties of undefined") &&
    message.includes("reading 'app'")
  );
}

// In some Storybook view switches, `@vue/devtools-kit` throws an unhandled promise.
// If it's exactly the known devtools prepare.js crash, suppress the noisy console output.
if (typeof window !== "undefined")
{
  window.addEventListener("unhandledrejection", (event) =>
  {
    if (isVueDevtoolsPrepareAppReadError(event.reason))
    {
      event.preventDefault();
    }
  });

  window.addEventListener("error", (event) =>
  {
    const msg = event?.message;
    if (typeof msg === "string" && msg.includes("reading 'app'"))
    {
      // Best-effort suppression of the devtools prepare.js crash noise.
      event.preventDefault?.();
    }
  });
}

const decodeEntitiesWarningFragment =
  "decodeEntities option is passed but will be ignored in non-browser builds.";

function hasDecodeEntitiesWarning(args: unknown[]): boolean
{
  return args.some((arg) =>
  {
    if (typeof arg !== "string")
    {
      return false;
    }
    return arg.includes(decodeEntitiesWarningFragment);
  });
}

function hasPopoverProviderAriaLabelWarning(args: unknown[]): boolean
{
  return args.some((arg) =>
  {
    if (typeof arg !== "string")
    {
      return false;
    }
    // Storybook internates `PopoverProvider` ohne `ariaLabel` (derzeit noch optional),
    // ab SB 11 wird es verpflichtend. Für unsere Tests/Dev-Logs filtern wir das Noise.
    return (
      arg.includes("ariaLabel") &&
      arg.includes("PopoverProvider") &&
      arg.includes("will become mandatory in Storybook 11")
    );
  });
}

// Storybook UI runs stories in varying environments; Vue may emit a noisy
// warning for `decodeEntities` in some non-browser compilation paths.
// Filter it out so it doesn't clutter local dev / CI logs.
const originalWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) =>
{
  if (hasDecodeEntitiesWarning(args) || hasPopoverProviderAriaLabelWarning(args))
  {
    return;
  }
  originalWarn(...args);
};

const originalError = console.error.bind(console);
console.error = (...args: unknown[]) =>
{
  if (hasDecodeEntitiesWarning(args) || hasPopoverProviderAriaLabelWarning(args))
  {
    return;
  }
  originalError(...args);
};

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

export default definePreview({
  addons: [],
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
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
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
        // Storybook rerenders when switching views; re-stub to avoid globals being reset.
        ensureVueDevtoolsKitGlobals();
      },
      template: `
        <div
          class="sb-canvas-root min-h-[50vh] text-slate-900 antialiased"
          style="font-family: system-ui, sans-serif;"
        >
          <story />
        </div>
      `,
    }),
  ],
});
