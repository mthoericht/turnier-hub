import { defineConfig, type TestProjectConfiguration } from "vitest/config";
import path from "node:path";
import { createStorybookVitestProject } from "./storybookVitestProject";
import { clientPlugins, clientAlias, clientRoot } from "./vite.shared";
const vitestSetupFile = path.join(clientRoot, "vitest.setup.ts");

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: clientPlugins(),
  resolve: {
    alias: clientAlias,
  },
  test: {
    // Integration tests share one SQLite file (server/.env.test); parallel files
    // would race on resetDatabase() and invalidate JWT user rows (P2003 / hangs).
    fileParallelism: false,
    projects: (() =>
    {
      const baseProjects: TestProjectConfiguration[] = [
        {
          test: {
            environment: "node",
            include: ["../tests/client/**/*.test.ts"],
            globals: true,
            setupFiles: [vitestSetupFile],
          },
        },
      ];

      // CLI: `STORYBOOK_TESTS=true` (see client/package.json). Storybook UI addon child sets
      // `VITEST_STORYBOOK=true` and filters Vitest with `project: storybook:<configDir>`.
      if (process.env.STORYBOOK_TESTS === "true" || process.env.VITEST_STORYBOOK === "true")
      {
        baseProjects.push(createStorybookVitestProject());
      }

      return baseProjects;
    })(),
  },
});