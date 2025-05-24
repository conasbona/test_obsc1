// Expose secure IPC methods to renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('obscuraAPI', {
  getProtectionConfig: () => ipcRenderer.invoke('get-protection-config'),
  setProtectionConfig: (newConfig) => ipcRenderer.invoke('set-protection-config', newConfig),
  reloadProtections: () => ipcRenderer.invoke('reload-protections')
});
