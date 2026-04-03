// This file has been automatically migrated to valid ESM format by Storybook.
import type { StorybookConfig } from "@storybook/vue3-vite";
import { dirname } from "path";
import { fileURLToPath } from "url";
import path from "node:path";
import vue from "@vitejs/plugin-vue";
import { mergeConfig } from "vite";

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

const clientRoot = path.resolve(__dirname, "../../../client");
// Same as client/vite.shared.ts; Storybook's Node main loader breaks relative imports to that file.
const clientSrc = path.resolve(clientRoot, "src");
function clientPlugins()
{
  return [vue()];
}
const dashboardStateMock = path.resolve(
  __dirname,
  "./mocks/useDashboardState.mock.ts",
);
const tournamentsListStateMock = path.resolve(
  __dirname,
  "./mocks/useTournamentsListState.mock.ts",
);
const playersManagementStateMock = path.resolve(
  __dirname,
  "./mocks/usePlayersManagementState.mock.ts",
);
const classesManagementStateMock = path.resolve(
  __dirname,
  "./mocks/useClassesManagementState.mock.ts",
);

function buildResolveAlias(
  raw: import("vite").AliasOptions | undefined,
  clientAlias: string,
): import("vite").Alias[]
{
  const tail: import("vite").Alias[] = [];
  if (Array.isArray(raw))
  {
    for (const entry of raw)
    {
      const f = entry.find;
      if (
        f === "@/composables/dashboard/useDashboardState" ||
        f === "@/composables/tournaments/useTournamentsListState" ||
        f === "@/composables/players/usePlayersManagementState" ||
        f === "@/composables/classes/useClassesManagementState" ||
        f === "@"
      )
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
      if (
        find === "@/composables/dashboard/useDashboardState" ||
        find === "@/composables/tournaments/useTournamentsListState" ||
        find === "@/composables/players/usePlayersManagementState" ||
        find === "@/composables/classes/useClassesManagementState" ||
        find === "@"
      )
      {
        continue;
      }
      tail.push({ find, replacement: replacement as string });
    }
  }
  return [
    { find: "@/composables/dashboard/useDashboardState", replacement: dashboardStateMock },
    {
      find: "@/composables/tournaments/useTournamentsListState",
      replacement: tournamentsListStateMock,
    },
    {
      find: "@/composables/players/usePlayersManagementState",
      replacement: playersManagementStateMock,
    },
    {
      find: "@/composables/classes/useClassesManagementState",
      replacement: classesManagementStateMock,
    },
    ...tail,
    { find: "@", replacement: clientAlias },
  ];
}

const vitestAddonDisabled = process.env.STORYBOOK_DISABLE_VITEST_ADDON === "1";

const config: StorybookConfig = {
  stories: ["./stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    getAbsolutePath("@chromatic-com/storybook"),
    ...(vitestAddonDisabled ? [] : [getAbsolutePath("@storybook/addon-vitest")]),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-docs"),
  ],
  framework: {
    name: getAbsolutePath("@storybook/vue3-vite"),
    options: {},
  },
  viteFinal: async (config) =>
  {
    const merged = mergeConfig(config, {
      // Config liegt unter tests/; Vite-Root = Client-Paket (wie früher unter client/.storybook).
      root: clientRoot,
      // Pinia + vue-router register @vue/devtools-kit when NODE_ENV !== "production".
      // Storybook's preview/docs iframe has no full devtools bridge → prepare.js throws
      // "Cannot read properties of undefined (reading 'app')".
      // Pinia treats NODE_ENV==="test" like tests (no devtools), but vue-router does not,
      // so "test" is not enough — compile-time "production" disables both integrations.
      define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
        // Ensure Vue devtools are fully disabled in Storybook if it's bundled as "production".
        "__VUE_PROD_DEVTOOLS__": JSON.stringify(false),
      },
      resolve: {
        alias: {
          "@": clientSrc,
        },
      },
    });
    // Mit configDir außerhalb von client fehlt mitunter plugin-vue in der Pipeline.
    merged.plugins = [...clientPlugins(), ...((merged.plugins ?? []) as [])];
    // Vite matches the short `@` alias before a longer `@/composables/...` key in a plain
    // object, so the dashboard mock never applied → real Pinia auth → HomeView login branch.
    merged.resolve ??= {};
    merged.resolve.alias = buildResolveAlias(merged.resolve.alias, clientSrc);
    return merged;
  },
};

export default config;
