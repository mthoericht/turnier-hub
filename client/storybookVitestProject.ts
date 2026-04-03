import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import type { TestProjectConfiguration } from "vitest/config";
import { clientRoot } from "./vite.shared";

const storybookConfigDir = path.resolve(clientRoot, "../tests/client/storybook");

/**
 * Vitest project for Storybook stories (browser + storybookTest plugin).
 * Shared by `client/vitest.config.ts` and `tests/client/vitest.config.ts` — the latter
 * exists so @storybook/addon-vitest can discover a config when walking up from
 * `tests/client/` (it never enters the `client/` subdirectory).
 */
export function createStorybookVitestProject(): TestProjectConfiguration
{
  const vitestSetupFile = path.join(clientRoot, "vitest.setup.ts");
  return {
    plugins: [
      storybookTest({
        configDir: storybookConfigDir,
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
  };
}
