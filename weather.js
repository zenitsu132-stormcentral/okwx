// Data layer (runs in the Electron main process).
//  - Forecast + current conditions: Open-Meteo (https://open-meteo.com, CC BY 4.0)
//  - Air quality: Open-Meteo Air Quality API
//  - Alerts: National Weather Service (api.weather.gov)
//  - Place search: Open-Meteo Geocoding API
//
// Each function takes a fetch function so main.js can pass Electron's net.fetch
// (which respects the user's system proxy settings).

// Sent with every request (NWS, ODOT cameras) so server admins can see who we
// are and how to reach us. Add an email address here if you'd rather be emailed.
const USER_AGENT = `okwx/${require('./package.json').version} (contact: https://github.com/zenitsu132-stormcentral/okwx)`;

const MODELS = {
  best_match: 'Best match',
  gfs_seamless: 'NOAA GFS',
  gfs_hrrr: 'NOAA HRRR (2 days)',
  ecmwf_ifs025: 'ECMWF IFS',
  icon_seamless: 'DWD ICON',
  gem_seamless: 'Canada GEM',
};

const CURRENT = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'dew_point_2m',
  'weather_code', 'is_day', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'pressure_msl', 'precipitation',
];
const HOURLY = [
  'temperature_2m', 'weather_code', 'is_day', 'precipitation_probability',
  'precipitation', 'pressure_msl', 'uv_index', 'visibility',
];
const DAILY = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min',
  'precipitation_probability_max', 'precipitation_sum', 'sunrise', 'sunset',
];

async function getJson(fetchFn, url, headers = {}) {
  const res = await fetchFn(url, { headers: { 'User-Agent': USER_AGENT, ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

const fix = (n) => Number(n).toFixed(4);

async function getWeather(fetchFn, { lat, lon, model = 'best_match' }) {
  if (!MODELS[model]) model = 'best_match';
  const q = new URLSearchParams({
    latitude: fix(lat),
    longitude: fix(lon),
    current: CURRENT.join(','),
    hourly: HOURLY.join(','),
    daily: DAILY.join(','),
    minutely_15: 'precipitation',
    past_days: '1',
    forecast_days: '10',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto',
    timeformat: 'unixtime',
    models: model,
  });

  const [forecast, air, alerts] = await Promise.allSettled([
    getJson(fetchFn, `https://api.open-meteo.com/v1/forecast?${q}`),
    getJson(fetchFn, `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${fix(lat)}&longitude=${fix(lon)}&current=us_aqi`),
    getJson(fetchFn, `https://api.weather.gov/alerts/active?point=${fix(lat)},${fix(lon)}`,
      { Accept: 'application/geo+json' }),
  ]);

  if (forecast.status === 'rejected') throw forecast.reason;

  return {
    model,
    modelName: MODELS[model],
    forecast: forecast.value,
    aqi: air.status === 'fulfilled' ? air.value?.current?.us_aqi ?? null : null,
    // Lets the page tell "no alerts" apart from "couldn't check for alerts".
    alertsError: alerts.status === 'rejected',
    alerts: alerts.status === 'fulfilled'
      ? alerts.value.features.map((f) => ({
          event: f.properties.event,
          severity: f.properties.severity,
          headline: f.properties.headline,
          description: f.properties.description,
          instruction: f.properties.instruction,
          ends: f.properties.ends || f.properties.expires,
        }))
      : [],
  };
}

async function searchPlaces(fetchFn, query) {
  const q = new URLSearchParams({ name: query, count: '8', language: 'en', format: 'json', countryCode: 'US' });
  const data = await getJson(fetchFn, `https://geocoding-api.open-meteo.com/v1/search?${q}`);
  return (data.results || []).map((r) => ({
    name: r.name,
    region: r.admin1 || '',
    lat: r.latitude,
    lon: r.longitude,
  }));
}

module.exports = { getWeather, searchPlaces, MODELS, USER_AGENT };
