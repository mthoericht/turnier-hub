/**
 * Import first in `preview.ts` so `@vue/devtools-kit` sees a stub hook early.
 * Prevents crashes when the iframe has no real browser devtools bridge.
 */
{
  const g = globalThis as unknown as Record<string, unknown>;
  g.__VUE_DEVTOOLS_GLOBAL_HOOK__ ??= {
    id: "vue-devtools-next",
    devtoolsVersion: "test",
    apps: [],
    on: () => {},
    once: () => {},
    off: () => {},
    emit: () => {},
  };
}

