// Sandboxed, so it is bundled to CommonJS and may require only Electron's renderer modules.
import { contextBridge, ipcRenderer } from "electron";

import { CHANNELS, type WeftBridge } from "../ipc/protocol.ts";

const bridge: WeftBridge = {
  call(call, message) {
    if (call !== "run" && call !== "read") {
      return Promise.reject(new Error(`Weft has no call "${String(call)}".`));
    }
    return ipcRenderer.invoke(CHANNELS[call], message);
  },
  onChanged(listener) {
    const handler = (_event: Electron.IpcRendererEvent, message: unknown) =>
      listener(message);
    ipcRenderer.on(CHANNELS.changed, handler);
    return () => {
      ipcRenderer.removeListener(CHANNELS.changed, handler);
    };
  },
};

contextBridge.exposeInMainWorld("weftBridge", bridge);
