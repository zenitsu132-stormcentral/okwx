// Page logic: picks a city, asks the main process for weather, renders it.

const CITIES = [
  { name: 'Oklahoma City', lat: 35.4676, lon: -97.5164 },
  { name: 'Tulsa', lat: 36.154, lon: -95.9928 },
  { name: 'Norman', lat: 35.2226, lon: -97.4395 },
  { name: 'Broken Arrow', lat: 36.0526, lon: -95.7908 },
  { name: 'Edmond', lat: 35.6528, lon: -97.4781 },
  { name: 'Lawton', lat: 34.6036, lon: -98.3959 },
  { name: 'Moore', lat: 35.3395, lon: -97.4867 },
  { name: 'Stillwater', lat: 36.1156, lon: -97.0584 },
  { name: 'Enid', lat: 36.3956, lon: -97.8784 },
  { name: 'Muskogee', lat: 35.7479, lon: -95.3697 },
  { name: 'Ardmore', lat: 34.1743, lon: -97.1436 },
  { name: 'Woodward', lat: 36.4337, lon: -99.3904 },
  { name: 'Guymon', lat: 36.6828, lon: -101.4816 },
  { name: 'McAlester', lat: 34.9334, lon: -95.7697 },
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function loadSavedCity() {
  try { return localStorage.getItem('okwx.city'); } catch { return null; }
}
function saveCity(name) {
  try { localStorage.setItem('okwx.city', name); } catch { /* ignore */ }
}

function setupCityPicker() {
  const sel = $('city');
  sel.innerHTML = CITIES.map((c) => `<option>${esc(c.name)}</option>`).join('');
  const saved = loadSavedCity();
  if (saved && CITIES.some((c) => c.name === saved)) sel.value = saved;
  sel.addEventListener('change', () => { saveCity(sel.value); load(); });
  $('refresh').addEventListener('click', load);
}

function hourLabel(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric' });
}

function render(city, data) {
  $('place').textContent = city.name;

  const now = data.hourly[0];
  $('temp').textContent = `${now.temperature}°${now.temperatureUnit}`;
  $('cond').textContent = now.shortForecast;
  const pop = now.probabilityOfPrecipitation?.value ?? 0;
  const hum = now.relativeHumidity?.value;
  $('details').innerHTML = `
    <span>Wind</span><b>${esc(now.windSpeed)} ${esc(now.windDirection)}</b>
    <span>Rain chance</span><b>${pop}%</b>
    ${hum != null ? `<span>Humidity</span><b>${hum}%</b>` : ''}
    <span>NWS office</span><b>${esc(data.office)}</b>`;

  $('hourly').innerHTML = data.hourly.map((h) => `
    <div class="hour">
      <small>${hourLabel(h.startTime)}</small>
      <div class="t">${h.temperature}°</div>
      <small>${h.probabilityOfPrecipitation?.value ?? 0}% rain</small>
    </div>`).join('');

  $('daily').innerHTML = data.forecast.map((d) => `
    <div class="day" title="${esc(d.detailedForecast)}">
      <span class="name">${esc(d.name)}</span>
      <span>${d.temperature}°${esc(d.temperatureUnit)}</span>
      <span class="short">${esc(d.shortForecast)}</span>
      <span class="pop">${d.probabilityOfPrecipitation?.value ?? 0}%</span>
    </div>`).join('');

  const alerts = $('alerts');
  alerts.hidden = data.alerts.length === 0;
  alerts.innerHTML = data.alerts.map((a) => `
    <details class="alert ${esc(a.severity)}">
      <summary>${esc(a.event)}: ${esc(a.headline)}</summary>
      <p>${esc(a.description)}</p>
    </details>`).join('');

  $('updated').textContent = new Date().toLocaleTimeString();
}

function renderCameras(city) {
  const box = $('cameras');
  if (!window.OKWX_CAMERAS_ENABLED) {
    box.innerHTML = '<p class="muted">Traffic cameras are coming soon. They will appear here once the Oklahoma DOT approves their use.</p>';
    return;
  }
  const list = window.OKWX_CAMERAS.filter((c) => !c.city || c.city === city.name);
  if (list.length === 0) {
    box.innerHTML = `<p class="muted">No cameras listed for ${esc(city.name)}.</p>`;
    return;
  }
  const bust = Date.now();
  box.innerHTML = `<div class="cams">${list.map((c) => `
    <div class="cam">
      <img src="${esc(c.imageUrl)}${c.imageUrl.includes('?') ? '&' : '?'}t=${bust}" alt="${esc(c.name)}" loading="lazy" />
      <div>${esc(c.name)}</div>
    </div>`).join('')}</div>
    <p class="muted">${esc(window.OKWX_CAMERA_ATTRIBUTION)}</p>`;
}

async function load() {
  const city = CITIES.find((c) => c.name === $('city').value) || CITIES[0];
  $('cond').textContent = 'Loading…';
  $('cond').classList.remove('error');
  try {
    const data = await window.okwx.getWeather(city.lat, city.lon);
    render(city, data);
  } catch (err) {
    $('cond').textContent = 'Could not load weather. Check your internet connection and try Refresh.';
    $('cond').classList.add('error');
    console.error(err);
  }
  renderCameras(city);
}

setupCityPicker();
load();
setInterval(load, 10 * 60 * 1000); // refresh every 10 minutes
if (window.OKWX_CAMERAS_ENABLED) {
  setInterval(() => renderCameras(CITIES.find((c) => c.name === $('city').value)), window.OKWX_CAMERA_REFRESH * 1000);
}
