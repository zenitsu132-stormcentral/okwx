// Page logic: location search, model picker, data loading and rendering.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };
  const r = (n) => (n == null || Number.isNaN(n) ? '--' : Math.round(n));
  const ok = (n) => n != null && !Number.isNaN(n);

  const STATES = {
    Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO',
    Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID',
    Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA',
    Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
    Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR',
    Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
    Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA',
    'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY', 'District of Columbia': 'DC',
  };
  const placeLabel = (p) => (p.region ? `${p.name}, ${STATES[p.region] || p.region}` : p.name);

  const DEFAULT_PLACE = { name: 'Oklahoma City', region: 'Oklahoma', lat: 35.4676, lon: -97.5164 };
  let place = store.get('okwx.place', DEFAULT_PLACE);
  let model = store.get('okwx.model', 'best_match');
  let data = null;
  let updatedAt = 0;
  let idx = { h: 0, d: 0 };
  let radar = null;
  let radarBig = null;

  // ---- Time helpers (shown in the location's own time zone) ----
  let utcOffset = 0;
  const fmt = (t, o) => new Date((t + utcOffset) * 1000).toLocaleString('en-US', { ...o, timeZone: 'UTC' });
  const hourLbl = (t) => fmt(t, { hour: 'numeric' });
  const timeLbl = (t) => fmt(t, { hour: 'numeric', minute: '2-digit' });
  const dayLbl = (t) => fmt(t, { weekday: 'short' });
  const lastIndexLE = (arr, v) => { let i = -1; for (let k = 0; k < arr.length; k++) if (arr[k] <= v) i = k; return i; };

  // ---- Color scale for temperatures (°F) ----
  const STOPS = [[10, '#9a8cff'], [32, '#5aaaf5'], [50, '#33cdb3'], [62, '#9bd34b'], [72, '#ffc83d'], [84, '#ff9a3c'], [98, '#ff4d4d']];
  function tempColor(t) {
    if (t <= STOPS[0][0]) return STOPS[0][1];
    for (let i = 1; i < STOPS.length; i++) {
      if (t <= STOPS[i][0]) {
        const [t0, c0] = STOPS[i - 1], [t1, c1] = STOPS[i];
        const k = (t - t0) / (t1 - t0);
        const a = parseInt(c0.slice(1), 16), b = parseInt(c1.slice(1), 16);
        const mix = (sh) => Math.round(((a >> sh) & 255) * (1 - k) + ((b >> sh) & 255) * k);
        return `rgb(${mix(16)},${mix(8)},${mix(0)})`;
      }
    }
    return STOPS[STOPS.length - 1][1];
  }

  // ---- Loading ----
  async function load() {
    document.body.classList.add('loading');
    $('place').textContent = placeLabel(place);
    $('modalPlace').textContent = placeLabel(place);
    radar.setLocation(place.lat, place.lon);
    renderCameras();
    try {
      data = await window.okwx.getWeather({ lat: place.lat, lon: place.lon, model });
      updatedAt = Date.now();
      $('error').hidden = true;
      renderAll();
    } catch (err) {
      console.error(err);
      const e = $('error');
      e.hidden = false;
      e.innerHTML = 'Could not load the forecast. Check your internet connection. <button type="button" id="retry">Try again</button>';
      $('retry').onclick = load;
    } finally {
      document.body.classList.remove('loading');
    }
  }

  function renderAll() {
    const f = data.forecast;
    utcOffset = f.utc_offset_seconds || 0;
    const now = f.current.time;
    idx.h = Math.max(0, lastIndexLE(f.hourly.time, now));
    idx.d = Math.max(0, lastIndexLE(f.daily.time, now));
    renderNow();
    renderAlerts();
    renderHourly();
    drawTempChart();
    renderPrecip();
    renderConditions();
    renderDaily();
    renderUpdated();
  }

  // ---- Current conditions ----
  function renderNow() {
    const f = data.forecast, c = f.current, D = f.daily;
    $('temp').textContent = `${r(c.temperature_2m)}°`;
    $('cond').textContent = wxText(c.weather_code);
    $('nowIcon').innerHTML = wxIcon(c.weather_code, c.is_day, 96);
    $('hilo').innerHTML = `
      <span>Feels like <b>${r(c.apparent_temperature)}°</b></span>
      <span>High <b>${r(D.temperature_2m_max[idx.d])}°</b></span>
      <span>Low <b>${r(D.temperature_2m_min[idx.d])}°</b></span>`;
  }

  function renderUpdated() {
    if (!updatedAt) return;
    const mins = Math.round((Date.now() - updatedAt) / 60000);
    const when = mins < 1 ? 'just now' : `${mins} min ago`;
    $('updated').textContent = `Updated ${when} · Open-Meteo${data.model !== 'best_match' ? ` (${data.modelName})` : ''}`;
  }

  function renderAlerts() {
    const box = $('alerts');
    box.hidden = data.alerts.length === 0;
    box.innerHTML = data.alerts.map((a) => `
      <details class="alert ${esc(a.severity)}">
        <summary>${esc(a.event)}${a.ends ? ` · until ${esc(new Date(a.ends).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }))}` : ''}</summary>
        <p>${esc(a.headline)}\n\n${esc(a.description)}${a.instruction ? `\n\n${esc(a.instruction)}` : ''}</p>
      </details>`).join('');
  }

  // ---- Hourly strip + temperature chart ----
  function renderHourly() {
    const f = data.forecast, H = f.hourly, c = f.current;
    let html = '';
    for (let i = 0; i < 24 && idx.h + i < H.time.length; i++) {
      const k = idx.h + i;
      const first = i === 0;
      const t = first ? c.temperature_2m : H.temperature_2m[k];
      const code = first ? c.weather_code : H.weather_code[k];
      const day = first ? c.is_day : H.is_day[k];
      const pp = H.precipitation_probability?.[k];
      html += `<div class="hour${first ? ' first' : ''}">
        <div class="h">${first ? 'Now' : hourLbl(H.time[k])}</div>
        ${wxIcon(code, day, 26)}
        <div class="p">${ok(pp) && pp >= 20 ? `${pp}%` : ''}</div>
        <div class="t">${r(t)}°</div>
      </div>`;
    }
    $('hourly').innerHTML = html;
  }

  function smoothPath(p) {
    let d = `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }

  function drawTempChart() {
    const el = $('tchart');
    if (!data) return;
    const W = el.clientWidth, Hh = el.clientHeight;
    if (!W) return;
    const H = data.forecast.hourly;
    const pts = [];
    for (let i = 0; i <= 24 && idx.h + i < H.time.length; i++) {
      const v = H.temperature_2m[idx.h + i];
      if (ok(v)) pts.push({ t: H.time[idx.h + i], v });
    }
    if (pts.length < 2) { el.innerHTML = ''; return; }

    const padL = 30, padR = 8, padT = 8, padB = 22;
    const vals = pts.map((p) => p.v);
    let lo = Math.floor((Math.min(...vals) - 1) / 2) * 2;
    let hi = Math.ceil((Math.max(...vals) + 1) / 2) * 2;
    if (hi - lo < 8) { const m = (hi + lo) / 2; lo = Math.floor(m - 4); hi = lo + 8; }
    const step = hi - lo <= 14 ? 2 : hi - lo <= 30 ? 5 : 10;
    const x = (i) => padL + (i * (W - padL - padR)) / (pts.length - 1);
    const y = (v) => padT + ((hi - v) / (hi - lo)) * (Hh - padT - padB);
    const xy = pts.map((p, i) => ({ x: x(i), y: y(p.v) }));
    const line = smoothPath(xy);
    const area = `${line}L${xy[xy.length - 1].x},${Hh - padB}L${xy[0].x},${Hh - padB}Z`;

    let axes = '';
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      axes += `<text class="axis" x="${padL - 6}" y="${y(v) + 3}" text-anchor="end">${v}°</text>`;
    }
    const every = W < 520 ? 4 : W < 760 ? 3 : 2;
    pts.forEach((p, i) => {
      if (i % every === 0) axes += `<text class="axis" x="${x(i)}" y="${Hh - 4}" text-anchor="middle">${hourLbl(p.t)}</text>`;
    });

    el.innerHTML = `
      <svg width="${W}" height="${Hh}">
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f06a2a" stop-opacity=".35"/>
            <stop offset="1" stop-color="#f06a2a" stop-opacity=".05"/>
          </linearGradient>
        </defs>
        ${axes}
        <path d="${area}" fill="url(#tg)"/>
        <path d="${line}" fill="none" stroke="#f06a2a" stroke-width="2"/>
        <line id="tLine" y1="${padT}" y2="${Hh - padB}" stroke="#5b6470" stroke-dasharray="3 3" visibility="hidden"/>
        <circle id="tDot" r="4" fill="#f06a2a" stroke="#fff" stroke-width="2" visibility="hidden"/>
      </svg>
      <div class="tip" id="tTip" hidden></div>`;

    const svg = el.querySelector('svg');
    const lineEl = $('tLine'), dot = $('tDot'), tip = $('tTip');
    svg.addEventListener('mousemove', (e) => {
      const rect = svg.getBoundingClientRect();
      const i = Math.max(0, Math.min(pts.length - 1, Math.round(((e.clientX - rect.left - padL) / (W - padL - padR)) * (pts.length - 1))));
      const px = xy[i].x, py = xy[i].y;
      lineEl.setAttribute('x1', px); lineEl.setAttribute('x2', px); lineEl.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.style.left = `${Math.max(40, Math.min(W - 40, px))}px`;
      tip.textContent = `${hourLbl(pts[i].t)} · ${r(pts[i].v)}°`;
    });
    svg.addEventListener('mouseleave', () => {
      lineEl.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true;
    });
  }

  // ---- Precipitation, next 3 hours ----
  function precipSeries() {
    const f = data.forecast, now = f.current.time;
    const M = f.minutely_15;
    if (M?.time && M?.precipitation) {
      const s = [];
      for (let k = 0; k < M.time.length && s.length < 12; k++) {
        if (M.time[k] > now - 900 && ok(M.precipitation[k])) s.push({ t: M.time[k], v: M.precipitation[k] });
      }
      if (s.length >= 8) return { s, per: '15 minutes' };
    }
    const H = f.hourly;
    const s = [0, 1, 2].map((i) => ({ t: H.time[idx.h + i], v: H.precipitation[idx.h + i] ?? 0 }));
    return { s, per: 'hour' };
  }

  function renderPrecip() {
    const { s, per } = precipSeries();
    const wet = (v) => v >= 0.005;
    const first = s.findIndex((p) => wet(p.v));
    let head;
    if (first === -1) head = 'No precipitation expected in the next 3 hours';
    else if (first === 0) {
      const stop = s.findIndex((p) => !wet(p.v));
      head = stop === -1 ? 'Precipitation continuing for the next 3 hours' : `Precipitation ending around ${timeLbl(s[stop].t)}`;
    } else head = `Precipitation starting around ${timeLbl(s[first].t)}`;
    $('pHead').textContent = head;
    $('pHead').nextElementSibling.textContent = `Next 3 hours, inches per ${per}`;
    drawPrecipChart(s);
  }

  function drawPrecipChart(s) {
    const el = $('pchart');
    const W = el.clientWidth, Hh = el.clientHeight;
    if (!W) return;
    const padL = 40, padR = 8, padT = 6, padB = 20;
    const max = Math.max(0.04, Math.ceil(Math.max(...s.map((p) => p.v)) * 50) / 50);
    const fmtIn = (v) => (v === 0 ? '0' : v.toFixed(2).replace(/0$/, ''));
    const cw = (W - padL - padR) / s.length;
    const y = (v) => padT + (1 - v / max) * (Hh - padT - padB);
    let out = '';
    [0, max / 2, max].forEach((v) => {
      out += `<text class="axis" x="${padL - 10}" y="${y(v) + 3}" text-anchor="end">${fmtIn(v)}</text>`;
    });
    s.forEach((p, i) => {
      const h = Math.max(0, (Hh - padT - padB) - (y(p.v) - padT));
      if (p.v > 0) out += `<rect x="${padL + i * cw + 2}" y="${y(p.v)}" width="${Math.max(2, cw - 4)}" height="${h}" rx="2" fill="#3ea6ff"/>`;
      const mins = Number(fmt(p.t, { minute: 'numeric' }));
      if (s.length <= 3 || mins === 0) out += `<text class="axis" x="${padL + i * cw + cw / 2}" y="${Hh - 4}" text-anchor="middle">${hourLbl(p.t)}</text>`;
    });
    out += `<line x1="${padL}" x2="${W - padR}" y1="${Hh - padB}" y2="${Hh - padB}" stroke="#24282f"/>`;
    el.innerHTML = `<svg width="${W}" height="${Hh}">${out}</svg>`;
  }

  // ---- Conditions grid ----
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const dirName = (deg) => COMPASS[Math.round(deg / 22.5) % 16];
  const uvCat = (u) => (u < 3 ? 'Low' : u < 6 ? 'Moderate' : u < 8 ? 'High' : u < 11 ? 'Very high' : 'Extreme');
  const aqiCat = (a) => (a <= 50 ? 'Good' : a <= 100 ? 'Moderate' : a <= 150 ? 'Unhealthy for sensitive groups' : a <= 200 ? 'Unhealthy' : a <= 300 ? 'Very unhealthy' : 'Hazardous');

  function compass(deg) {
    let ticks = '';
    for (let i = 0; i < 36; i++) {
      const a = (i * 10 * Math.PI) / 180, long = i % 9 === 0;
      const r1 = long ? 25 : 27, r2 = 30;
      ticks += `<line x1="${32 + Math.sin(a) * r1}" y1="${32 - Math.cos(a) * r1}" x2="${32 + Math.sin(a) * r2}" y2="${32 - Math.cos(a) * r2}" stroke="${long ? '#8a94a2' : '#3a414b'}" stroke-width="1.5"/>`;
    }
    const letters = [['N', 32, 15], ['E', 50, 35], ['S', 32, 54], ['W', 14, 35]]
      .map(([t, x, y]) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="8" fill="#8a94a2">${t}</text>`).join('');
    const arrow = ok(deg)
      ? `<g transform="rotate(${deg + 180} 32 32)"><line x1="32" y1="46" x2="32" y2="20" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M32 15l-5 8h10z" fill="#fff"/><circle cx="32" cy="46" r="2.5" fill="#fff"/></g>`
      : '';
    return `<svg class="compass" width="64" height="64" viewBox="0 0 64 64">${ticks}${letters}${arrow}</svg>`;
  }

  function renderConditions() {
    const f = data.forecast, c = f.current, H = f.hourly, D = f.daily, h = idx.h, d = idx.d;
    const hPa = ok(c.pressure_msl) ? c.pressure_msl : H.pressure_msl[h];
    const inHg = ok(hPa) ? hPa * 0.02953 : null;
    let trend = '';
    const past = H.pressure_msl[h - 3];
    if (ok(inHg) && ok(past)) {
      const diff = inHg - past * 0.02953;
      const ad = Math.abs(diff);
      const word = ad < 0.015 ? 'Steady' : `${diff > 0 ? 'Rising' : 'Falling'} ${ad < 0.06 ? 'slowly' : 'quickly'}`;
      trend = `${word}<br>${diff >= 0 ? '+' : '−'}${ad.toFixed(2)} inHg in 3 h`;
    }
    const uv = H.uv_index?.[h];
    let vis = H.visibility?.[h];
    if (ok(vis)) vis = (f.hourly_units?.visibility || 'm').includes('ft') ? vis / 5280 : vis / 1609.34;
    const aqi = data.aqi;
    const rain = D.precipitation_sum?.[d];
    const rainPp = D.precipitation_probability_max?.[d];
    const gust = ok(c.wind_gusts_10m) ? `, gusts ${r(c.wind_gusts_10m)} mph` : '';

    $('conds').innerHTML = `
      <div class="cell wide">
        ${compass(c.wind_direction_10m)}
        <div>
          <div class="k">Wind</div>
          <div class="v">${r(c.wind_speed_10m)} mph</div>
          <div class="d">${ok(c.wind_direction_10m) ? `From ${dirName(c.wind_direction_10m)}` : ''}${gust}</div>
        </div>
      </div>
      <div class="cell">
        <div class="k">Humidity</div>
        <div class="v">${r(c.relative_humidity_2m)}%</div>
        <div class="d">Dew point ${r(c.dew_point_2m)}°</div>
      </div>
      <div class="cell">
        <div class="k">Pressure</div>
        <div class="v">${ok(inHg) ? inHg.toFixed(2) : '--'} inHg</div>
        <div class="d">${trend}</div>
      </div>
      <div class="cell">
        <div class="k">UV index</div>
        <div class="v">${r(uv)} <small>${ok(uv) ? uvCat(uv) : ''}</small></div>
      </div>
      <div class="cell">
        <div class="k">Visibility</div>
        <div class="v">${ok(vis) ? Math.min(vis, 99).toFixed(1) : '--'} mi</div>
      </div>
      <div class="cell">
        <div class="k">Air quality (US AQI)</div>
        <div class="v">${r(aqi)}</div>
        <div class="d">${ok(aqi) ? aqiCat(aqi) : 'Not available'}</div>
      </div>
      <div class="cell">
        <div class="k">Precipitation today</div>
        <div class="v">${ok(rain) ? rain.toFixed(2) : '--'} in</div>
        <div class="d">${ok(rainPp) ? `${rainPp}% chance` : ''}</div>
      </div>`;
  }

  // ---- 10-day forecast ----
  function renderDaily() {
    const f = data.forecast, D = f.daily, c = f.current;
    const days = [];
    for (let i = idx.d; i < D.time.length && days.length < 10; i++) {
      if (ok(D.temperature_2m_max[i]) && ok(D.temperature_2m_min[i])) days.push(i);
    }
    if (!days.length) { $('daily').innerHTML = '<p class="muted">No daily data for this model.</p>'; return; }
    const lo = Math.min(...days.map((i) => D.temperature_2m_min[i]));
    const hi = Math.max(...days.map((i) => D.temperature_2m_max[i]));
    const pct = (v) => ((v - lo) / Math.max(1, hi - lo)) * 100;

    $('daily').innerHTML = days.map((i, n) => {
      const mn = D.temperature_2m_min[i], mx = D.temperature_2m_max[i];
      const pp = D.precipitation_probability_max?.[i];
      const mid = (mn + mx) / 2;
      const dot = n === 0 && i === idx.d && ok(c.temperature_2m)
        ? `<b data-left="${Math.max(0, Math.min(100, pct(c.temperature_2m)))}"></b>` : '';
      return `<div class="day">
        <span class="n">${n === 0 && i === idx.d ? 'Today' : dayLbl(D.time[i])}</span>
        ${wxIcon(D.weather_code[i], 1, 26)}
        <span class="pp">${ok(pp) && pp >= 20 ? `${pp}%` : ''}</span>
        <span class="lo">${r(mn)}°</span>
        <div class="range"><i data-left="${pct(mn)}" data-width="${Math.max(2, pct(mx) - pct(mn))}"
          data-bg="linear-gradient(90deg,${tempColor(mn)},${tempColor(mid)},${tempColor(mx)})"></i>${dot}</div>
        <span class="hi">${r(mx)}°</span>
      </div>`;
    }).join('');

    // Inline style attributes are blocked by the page's security policy, so set them here.
    $('daily').querySelectorAll('[data-left]').forEach((el) => {
      el.style.left = `${el.dataset.left}%`;
      if (el.dataset.width) el.style.width = `${el.dataset.width}%`;
      if (el.dataset.bg) el.style.background = el.dataset.bg;
    });
  }

  // ---- Traffic cameras ----
  function distanceKm(a, b, c, d) {
    const R = 6371, rad = Math.PI / 180;
    const x = Math.sin(((c - a) * rad) / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function renderCameras() {
    const box = $('cameras');
    if (!window.OKWX_CAMERAS_ENABLED) {
      box.innerHTML = '<p class="muted">Traffic cameras are coming soon. They will appear here once the Oklahoma DOT approves their use.</p>';
      return;
    }
    const list = window.OKWX_CAMERAS.filter((c) =>
      ok(c.lat) && ok(c.lon) ? distanceKm(place.lat, place.lon, c.lat, c.lon) < 50 : c.city === place.name);
    if (!list.length) {
      box.innerHTML = `<p class="muted">No cameras near ${esc(placeLabel(place))}.</p>`;
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

  // ---- Search ----
  function setupSearch() {
    const input = $('search'), list = $('results');
    let timer, items = [], active = -1, seq = 0;
    const hide = () => { list.hidden = true; active = -1; };
    const paint = () => {
      list.innerHTML = items.length
        ? items.map((p, i) => `<li data-i="${i}" class="${i === active ? 'active' : ''}">${esc(p.name)}<span>${esc(p.region)}</span></li>`).join('')
        : '<li class="muted">No matches</li>';
      list.hidden = false;
    };
    const choose = (p) => {
      place = { name: p.name, region: p.region, lat: p.lat, lon: p.lon };
      store.set('okwx.place', place);
      input.value = '';
      input.blur();
      hide();
      load();
    };
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { hide(); return; }
      timer = setTimeout(async () => {
        const my = ++seq;
        try {
          const res = await window.okwx.searchPlaces(q);
          if (my !== seq) return;
          items = res; active = res.length ? 0 : -1; paint();
        } catch (e) { console.error(e); }
      }, 250);
    });
    input.addEventListener('keydown', (e) => {
      if (list.hidden) return;
      if (e.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); paint(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); paint(); e.preventDefault(); }
      else if (e.key === 'Enter' && items[active]) choose(items[active]);
      else if (e.key === 'Escape') hide();
    });
    list.addEventListener('mousedown', (e) => {
      const li = e.target.closest('li[data-i]');
      if (li) { e.preventDefault(); choose(items[+li.dataset.i]); }
    });
    input.addEventListener('blur', () => setTimeout(hide, 100));
  }

  // ---- Model picker ----
  async function setupModels() {
    const sel = $('model');
    let models = { best_match: 'Best match' };
    try { models = await window.okwx.getModels(); } catch { /* keep default */ }
    if (!models[model]) model = 'best_match';
    sel.innerHTML = Object.entries(models).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
    sel.value = model;
    sel.addEventListener('change', () => { model = sel.value; store.set('okwx.model', model); load(); });
  }

  // ---- Radar modal ----
  function setupRadar() {
    radar = new RadarMap($('radar'), { zoom: 6 });
    const modal = $('radarModal');
    const close = () => { modal.hidden = true; if (radarBig) { radarBig.destroy(); radarBig = null; } };
    $('openRadar').addEventListener('click', () => {
      modal.hidden = false;
      radarBig = new RadarMap($('radarBig'), { zoom: 7, maxZoom: 10 });
      radarBig.setLocation(place.lat, place.lon);
    });
    $('closeRadar').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
  }

  // ---- Start ----
  async function start() {
    setupRadar();
    setupSearch();
    $('hPrev').addEventListener('click', () => $('hourly').scrollBy({ left: -$('hourly').clientWidth * 0.8 }));
    $('hNext').addEventListener('click', () => $('hourly').scrollBy({ left: $('hourly').clientWidth * 0.8 }));
    let rt;
    new ResizeObserver(() => {
      clearTimeout(rt);
      rt = setTimeout(() => { if (data) { drawTempChart(); renderPrecip(); } }, 80);
    }).observe($('tchart'));
    await setupModels();
    await load();
    setInterval(load, 10 * 60 * 1000);
    setInterval(renderUpdated, 30 * 1000);
    if (window.OKWX_CAMERAS_ENABLED) setInterval(renderCameras, window.OKWX_CAMERA_REFRESH * 1000);
  }

  start();
})();
