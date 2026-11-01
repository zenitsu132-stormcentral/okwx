// Electron main process: creates the window and handles data requests.
// Network calls happen here (not in the page) so we can set headers and
// keep the page locked down.
const { app, BrowserWindow, ipcMain, shell, net } = require('electron');
const path = require('path');
const { getWeather, searchPlaces, MODELS } = require('./weather');

const fetchFn = (url, opts) => net.fetch(url, opts);

ipcMain.handle('wx:get', (_e, opts) => getWeather(fetchFn, opts));
ipcMain.handle('wx:search', (_e, query) => searchPlaces(fetchFn, query));
ipcMain.handle('wx:models', () => MODELS);

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 760,
    minHeight: 560,
    title: 'okwx',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Open external links in the user's browser instead of inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
