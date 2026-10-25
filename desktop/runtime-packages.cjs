// Explicit copies bypass builder's default exclusion of node_modules resources.
// These are the generated client and the native driver's actual runtime imports.
module.exports = [
  "@prisma/client", ".prisma/client", "@prisma/client-runtime-utils",
  "better-sqlite3", "bindings", "file-uri-to-path",
];
