const { contextBridge, ipcRenderer } = require("electron");

// No filesystem, raw IPC, credentials or caller-provided paths are exposed.
contextBridge.exposeInMainWorld("turnierHost", {
  open: () => ipcRenderer.invoke("host:open"),
  info: () => ipcRenderer.invoke("host:info"),
  run: (action) => ipcRenderer.invoke("host:run", action),
});
