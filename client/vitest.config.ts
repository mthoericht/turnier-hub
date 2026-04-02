import { defineConfig, type TestProjectConfiguration } from "vitest/config";
import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
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

      if (process.env.STORYBOOK_TESTS === "true")
      {
        baseProjects.push({
          plugins: [
            // The plugin will run tests for the stories defined in your Storybook config
            // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
            storybookTest({
              configDir: path.join(clientRoot, "../tests/client/storybook"),
            }),
          ],
          test: {
            browser: {
              enabled: true,
              headless: true,
              provider: "playwright",
              instances: [
                {
                  browser: "chromium",
                },
              ],
            },
            setupFiles: [vitestSetupFile],
          },
        });
      }

      return baseProjects;
    })(),
  },
});