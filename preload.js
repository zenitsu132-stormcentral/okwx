// Exposes a small, safe API to the page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('okwx', {
  getWeather: (opts) => ipcRenderer.invoke('wx:get', opts),
  searchPlaces: (query) => ipcRenderer.invoke('wx:search', query),
  getModels: () => ipcRenderer.invoke('wx:models'),
  getCameras: () => ipcRenderer.invoke('cam:list'),
  cameraStatus: (ids) => ipcRenderer.invoke('cam:status', ids),
});
