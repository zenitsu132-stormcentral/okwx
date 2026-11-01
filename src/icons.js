// Weather icons (inline SVG) and text for WMO weather codes.
(function () {
  const CLOUD = 'M19 50h28a11 11 0 0 0 1.5-21.9A15 15 0 0 0 19.6 24 13 13 0 0 0 19 50z';
  const CLOUD_FILL = '#5aaaf5';
  const CLOUD_DARK = '#7d8a99';

  const sun = (cx, cy, r) => {
    let rays = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const x1 = cx + Math.cos(a) * (r + 4), y1 = cy + Math.sin(a) * (r + 4);
      const x2 = cx + Math.cos(a) * (r + 9), y2 = cy + Math.sin(a) * (r + 9);
      rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
    }
    return `<g stroke="#ffc83d" stroke-width="3.5" stroke-linecap="round">${rays}</g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffc83d"/>`;
  };
  const moon = (cx, cy, r) =>
    `<path d="M${cx + r * 0.3} ${cy - r} a${r} ${r} 0 1 0 ${r * 0.7} ${r * 1.6} a${r * 0.85} ${r * 0.85} 0 0 1 -${r * 0.7} -${r * 1.6}z" fill="#c9d4e3"/>`;
  const cloud = (fill = CLOUD_FILL, dy = 0) =>
    `<path d="${CLOUD}" transform="translate(0 ${dy})" fill="${fill}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`;
  const drops = (n = 3, color = '#3ea6ff') => {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = 24 + i * 9;
      s += `<line x1="${x}" y1="53" x2="${x - 3}" y2="61" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>`;
    }
    return s;
  };
  const flakes = () =>
    [22, 32, 42].map((x) => `<circle cx="${x}" cy="57" r="3" fill="#e8f1ff"/>`).join('');
  const bolt = () =>
    '<path d="M34 46l-7 11h7l-4 9 11-13h-7l4-7z" fill="#ffc83d" stroke="#ffc83d" stroke-width="1.5" stroke-linejoin="round"/>';
  const fogLines = () =>
    [52, 58].map((y, i) => `<line x1="${14 + i * 6}" y1="${y}" x2="${50 + i * 4}" y2="${y}" stroke="#aab6c4" stroke-width="3.5" stroke-linecap="round"/>`).join('');

  function kind(code) {
    if (code === 0) return 'clear';
    if (code === 1) return 'mostly-clear';
    if (code === 2) return 'partly';
    if (code === 3) return 'cloudy';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'thunder';
    return 'cloudy';
  }

  function body(code, isDay) {
    const sky = isDay ? sun(24, 22, 10) : moon(22, 22, 12);
    switch (kind(code)) {
      case 'clear': return isDay ? sun(32, 32, 13) : moon(30, 32, 16);
      case 'mostly-clear': return sky + `<g transform="translate(18 18) scale(.7)">${cloud()}</g>`;
      case 'partly': return sky + `<g transform="translate(6 6) scale(.9)">${cloud()}</g>`;
      case 'cloudy': return cloud();
      case 'fog': return `<g transform="translate(0 -6)">${cloud(CLOUD_DARK)}</g>` + fogLines();
      case 'drizzle': return `<g transform="translate(0 -6)">${cloud()}</g>` + drops(2, '#6ec0ff');
      case 'rain': return `<g transform="translate(0 -6)">${cloud()}</g>` + drops(3);
      case 'snow': return `<g transform="translate(0 -6)">${cloud()}</g>` + flakes();
      case 'thunder': return `<g transform="translate(0 -8)">${cloud(CLOUD_DARK)}</g>` + bolt();
      default: return cloud();
    }
  }

  const TEXT = {
    0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Freezing fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
    56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    66: 'Freezing rain', 67: 'Heavy freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy showers',
    85: 'Snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorms', 96: 'Thunderstorms with hail', 99: 'Severe thunderstorms with hail',
  };

  window.wxIcon = (code, isDay = 1, size = 32) =>
    `<svg class="wx-icon" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">${body(code, isDay)}</svg>`;
  window.wxText = (code) => TEXT[code] || 'Unknown';
})();
