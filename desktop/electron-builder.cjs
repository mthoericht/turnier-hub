const path = require("node:path");

module.exports = {
  appId: "de.turnierhub.app",
  productName: "Turnier-Hub",
  directories: { app: "desktop/app", output: "release/desktop" },
  files: ["main.cjs", "storage.cjs", "diagnostics.cjs", "maintenance.cjs", "host-management.cjs", "host-preload.cjs", "management.html", "management.css", "management.js", "host.html", "host.css", "host.js", "package.json"],
  extraResources: [
    { from: "desktop/runtime", to: "runtime" },
    // Root node_modules folders are deliberately skipped by builder's generic
    // resource filter. Copy these two runtime packages explicitly.
    { from: "desktop/runtime/node_modules/@prisma/client", to: "runtime/node_modules/@prisma/client" },
    { from: "desktop/runtime/node_modules/.prisma/client", to: "runtime/node_modules/.prisma/client" },
    { from: "client/dist", to: "client" },
  ],
  asar: true,
  npmRebuild: false,
  electronDist: path.join(__dirname, "../node_modules/electron/dist"),
  mac: { target: [{ target: "zip", arch: ["arm64"] }], identity: null, category: "public.app-category.education" },
  win: { target: [{ target: "nsis", arch: ["x64"] }] },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true, deleteAppDataOnUninstall: false },
};
