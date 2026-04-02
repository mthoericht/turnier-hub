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

// Storybook/Vitest executes component rendering in non-browser builds in some cases.
// Vue logs a noisy warning about `decodeEntities` which we don't want to fail/obscure CI logs.
const originalWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) =>
{
  if (hasDecodeEntitiesWarning(args))
  {
    return;
  }
  originalWarn(...args);
};

const originalError = console.error.bind(console);
console.error = (...args: unknown[]) =>
{
  if (hasDecodeEntitiesWarning(args))
  {
    return;
  }
  originalError(...args);
};

