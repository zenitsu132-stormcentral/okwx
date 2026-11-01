// Exposes a small, safe API to the page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('okwx', {
  getWeather: (lat, lon) => ipcRenderer.invoke('weather:get', lat, lon),
});
