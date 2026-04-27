// This file has been automatically migrated to valid ESM format by Storybook.
import type { StorybookConfig } from "@storybook/vue3-vite";
import { dirname } from "path";
import { fileURLToPath } from "url";
import path from "node:path";
import vue from "@vitejs/plugin-vue";
import { mergeConfig } from "vite";
import type { Alias, AliasOptions } from "vite";

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string)
{
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const __dirname =
  typeof globalThis.__dirname !== "undefined"
    ? // eslint-disable-next-line no-underscore-dangle
      (globalThis.__dirname as string)
    : dirname(fileURLToPath(import.meta.url));

/** Absolute path to the `client` workspace package (Vite `root` for Storybook). */
const clientRoot = path.resolve(__dirname, "../../../client");
/** Same as `client/src`; used as Vite `root` and as the `@` alias target. */
const clientSrc = path.resolve(clientRoot, "src");

/** Ensures Vue SFCs compile in Storybook when `configDir` lives outside `client/`. */
function clientPlugins()
{
  return [vue()];
}

/** Story-only module swaps: real composables → lightweight mocks under `./mocks/`. */
const composableMockReplacements: Alias[] = [
  {
    find: "@/composables/dashboard/useDashboardState",
    replacement: path.resolve(__dirname, "./mocks/useDashboardState.mock.ts"),
  },
  {
    find: "@/composables/tournaments/useTournamentsListState",
    replacement: path.resolve(__dirname, "./mocks/useTournamentsListState.mock.ts"),
  },
  {
    find: "@/composables/players/usePlayersManagementState",
    replacement: path.resolve(__dirname, "./mocks/usePlayersManagementState.mock.ts"),
  },
  {
    find: "@/composables/classes/useClassesManagementState",
    replacement: path.resolve(__dirname, "./mocks/useClassesManagementState.mock.ts"),
  },
  {
    find: "@/composables/admin/useAdminManagementState",
    replacement: path.resolve(__dirname, "./mocks/useAdminManagementState.mock.ts"),
  },
  {
    find: "@/tournament/useTournamentLayoutState",
    replacement: path.resolve(__dirname, "./mocks/useTournamentLayoutState.mock.ts"),
  },
  {
    find: "@/api/tournamentsApi",
    replacement: path.resolve(__dirname, "./mocks/tournamentsApi.mock.ts"),
  },
];

const storybookAddons = [
  "@chromatic-com/storybook",
  "@storybook/addon-a11y",
  "@storybook/addon-docs",
];

/**
 * String `find` keys we re-define when merging aliases (mocks + final `@`).
 * Regex aliases from upstream config are never skipped here.
 */
const mockedAliasFinders = new Set([
  ...composableMockReplacements.map((alias) => alias.find),
  "@",
]);

/**
 * Drops conflicting string keys from the merged Vite alias so our mocks and
 * a single `@` → `clientSrc` win; avoids duplicates from client/Storybook merge.
 */
function shouldSkipAlias(find: string | RegExp)
{
  return typeof find === "string" && mockedAliasFinders.has(find);
}

/** Addon list; Vitest addon optional via `STORYBOOK_DISABLE_VITEST_ADDON=1`. */
function createAddons()
{
  const baseAddons = storybookAddons.map(getAbsolutePath);
  if (process.env.STORYBOOK_DISABLE_VITEST_ADDON === "1")
  {
    return baseAddons;
  }
  return [...baseAddons, getAbsolutePath("@storybook/addon-vitest")];
}

/**
 * Rebuilds `resolve.alias`: composable mocks first, then remaining merged aliases
 * (minus skipped keys), then `@` last so `@` does not shadow longer `@/…` mocks.
 */
function buildResolveAlias(
  raw: AliasOptions | undefined,
  clientAlias: string,
): Alias[]
{
  const tail: Alias[] = [];
  if (Array.isArray(raw))
  {
    for (const entry of raw)
    {
      if (shouldSkipAlias(entry.find))
      {
        continue;
      }
      tail.push(entry);
    }
  }
  else if (raw && typeof raw === "object")
  {
    for (const [find, replacement] of Object.entries(raw))
    {
      if (shouldSkipAlias(find))
      {
        continue;
      }
      tail.push({ find, replacement: replacement as string });
    }
  }
  return [
    ...composableMockReplacements,
    ...tail,
    { find: "@", replacement: clientAlias },
  ];
}

/** Vite options merged into Storybook’s config: client root, prod defines, base `@`. */
function createViteBaseConfig()
{
  return {
    // The config lives under `tests/`, but Vite root must be the client package.
    root: clientRoot,
    // Force production mode to disable Vue devtools hooks in Pinia and vue-router.
    // In Storybook preview/docs iframes, partial devtools bridges can crash during setup.
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      // Keep Vue production devtools explicitly off in Storybook bundles.
      "__VUE_PROD_DEVTOOLS__": JSON.stringify(false),
    },
    resolve: {
      alias: {
        "@": clientSrc,
      },
    },
  };
}

/**
 * Prepends `plugin-vue` and normalizes aliases after `mergeConfig` so Storybook
 * matches the client app’s resolution (mocks + `@`).
 */
function applyStorybookViteFixups(merged: Awaited<ReturnType<typeof mergeConfig>>)
{
  // With configDir outside `client`, `@vitejs/plugin-vue` may be missing from the pipeline.
  merged.plugins = [...clientPlugins(), ...((merged.plugins ?? []) as [])];
  // Ensure specific mock aliases win over the generic `@` alias.
  merged.resolve ??= {};
  merged.resolve.alias = buildResolveAlias(merged.resolve.alias, clientSrc);
  return merged;
}

/** Storybook 10 + Vue 3 + Vite; `viteFinal` aligns resolution with the real app. */
const config: StorybookConfig = {
  stories: ["./stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: createAddons(),
  framework: {
    name: getAbsolutePath("@storybook/vue3-vite"),
    options: {},
  },
  viteFinal: async (config) =>
  {
    const merged = mergeConfig(config, createViteBaseConfig());
    return applyStorybookViteFixups(merged);
  },
};

export default config;
