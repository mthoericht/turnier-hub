const path = require("node:path");
const runtimePackages = require("./runtime-packages.cjs");

module.exports = {
  appId: "de.turnierhub.app",
  productName: "Turnier-Hub",
  directories: { app: "desktop/app", output: "release/desktop" },
  files: ["main.cjs", "storage.cjs", "diagnostics.cjs", "maintenance.cjs", "host-management.cjs", "host-preload.cjs", "management.html", "management.css", "management.js", "host.html", "host.css", "host.js", "package.json"],
  extraResources: [
    { from: "desktop/runtime", to: "runtime" },
    ...runtimePackages.map((name) => ({
      from: `desktop/runtime/node_modules/${name}`, to: `runtime/node_modules/${name}`,
    })),
    { from: "client/dist", to: "client" },
  ],
  asar: true,
  npmRebuild: false,
  electronDist: path.join(__dirname, "../node_modules/electron/dist"),
  mac: { icon: "client/src/assets/trophy.svg", target: [{ target: "zip", arch: ["arm64"] }], identity: null, minimumSystemVersion: "13.0.0", category: "public.app-category.education" },
  win: { icon: "client/src/assets/trophy.svg", target: [{ target: "nsis", arch: ["x64"] }] },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true, deleteAppDataOnUninstall: false },
};
