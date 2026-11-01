// Electron main process: creates the window and fetches weather data.
// Network calls happen here (not in the page) so we can send the
// User-Agent header the National Weather Service API asks for.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// NWS asks apps to identify themselves with a contact address.
// Replace this with your own email or project URL.
const USER_AGENT = 'okwx/0.1 (contact: you@example.com)';
const NWS = 'https://api.weather.gov';

async function nws(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
  });
  if (!res.ok) throw new Error(`NWS ${res.status} for ${url}`);
  return res.json();
}

ipcMain.handle('weather:get', async (_event, lat, lon) => {
  const point = await nws(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
  const p = point.properties;
  const [forecast, hourly, alerts] = await Promise.all([
    nws(p.forecast),
    nws(p.forecastHourly),
    nws(`${NWS}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`),
  ]);
  return {
    office: p.cwa,
    radarStation: p.radarStation,
    forecast: forecast.properties.periods,
    hourly: hourly.properties.periods.slice(0, 12),
    alerts: alerts.features.map((f) => ({
      event: f.properties.event,
      severity: f.properties.severity,
      headline: f.properties.headline,
      description: f.properties.description,
      ends: f.properties.ends || f.properties.expires,
    })),
  };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    title: 'okwx',
    backgroundColor: '#0f1720',
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
    shell.openExternal(url);
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
