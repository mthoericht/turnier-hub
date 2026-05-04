import { defineConfig } from "vitest/config";
import { createStorybookVitestProject } from "../../client/storybookVitestProject";
import { clientPlugins, clientAlias } from "../../client/vite.shared";

/**
 * Vitest entry used by @storybook/addon-vitest: it searches upward from
 * `dirname(storybook config dir)` (= this folder) for a file containing `storybookTest`.
 * `client/vitest.config.ts` is not on that path, so Storybook would start Vitest with
 * the wrong root and no `storybook:<configDir>` project.
 */
export default defineConfig({
  // Vitest 3 pins Vite 7 types; client uses Vite 8 (Rolldown). Runtime is fine — `never` satisfies both plugin list types.
  plugins: clientPlugins() as never,
  resolve: {
    alias: clientAlias,
  },
  test: {
    fileParallelism: false,
    projects: [createStorybookVitestProject()],
  },
});
