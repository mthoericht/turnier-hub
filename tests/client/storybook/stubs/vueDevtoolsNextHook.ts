// This file must be imported as the *first* dependency in Storybook preview,
// so Vue Devtools kit sees the hook before it initializes.

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

