// Electron main process: creates the window and handles data requests.
// Network calls happen here (not in the page) so we can set headers and
// keep the page locked down.
const { app, BrowserWindow, ipcMain, shell, net, protocol } = require('electron');
const path = require('path');
const { getWeather, searchPlaces, MODELS, USER_AGENT } = require('./weather');
const { createCameraService } = require('./camera-service');
const cameraConfig = require('./cameras.config');

const fetchFn = (url, opts) => net.fetch(url, opts);

// Camera images are served to the page from our cache through okwx-cam://cam/<id>.
protocol.registerSchemesAsPrivileged([
  { scheme: 'okwx-cam', privileges: { standard: true, secure: true } },
]);
let cameras;

ipcMain.handle('wx:get', (_e, opts) => getWeather(fetchFn, opts));
ipcMain.handle('wx:search', (_e, query) => searchPlaces(fetchFn, query));
ipcMain.handle('wx:models', () => MODELS);
ipcMain.handle('cam:list', () => cameras.list());
ipcMain.handle('cam:status', (_e, ids) => cameras.status(ids));

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
  cameras = createCameraService({
    fetchFn,
    userAgent: USER_AGENT,
    cacheDir: path.join(app.getPath('userData'), 'camera-cache'),
    config: cameraConfig,
  });
  protocol.handle('okwx-cam', (req) => cameras.handle(req));

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
