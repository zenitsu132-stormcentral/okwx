# okwx

A Windows desktop weather app focused on Oklahoma. ODOT traffic cameras will be added once permission is granted.

## Features

- Current conditions with feels-like, high and low
- 24-hour forecast with icons and an interactive temperature chart
- Precipitation for the next 3 hours in 15-minute steps
- Conditions: wind compass and gusts, humidity and dew point, pressure trend, UV, visibility, air quality, precipitation
- 10-day forecast with temperature range bars
- "Forecast from" picker: Best match, NOAA GFS, NOAA HRRR, ECMWF, DWD ICON, Canada GEM
- City search for any US location, and the app remembers your last pick
- Active NWS watches and warnings
- Animated NEXRAD radar loop you can pan, zoom and expand
- Refreshes on its own every 10 minutes
- Traffic camera viewer: a large live image, nearby camera thumbnails and a "View all" grid. It's turned off until ODOT approves it (see below)

## Get the .exe

Every push to `main` builds the app on GitHub:

1. Open the **Actions** tab and click the latest **Build Windows .exe** run.
2. Download **okwx-windows** under *Artifacts*. It contains:
   - `okwx Setup x.y.z.exe`: the installer
   - `okwx-portable-x.y.z.exe`: runs without installing

To publish a release, push a version tag (for example `git tag v0.1.0 && git push --tags`). The .exe files will be attached to a GitHub Release.

> Windows SmartScreen may warn about an unknown publisher because the app isn't code-signed. Click **More info → Run anyway**.

## Run it from source

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm start        # open the app
npm run dist     # build the .exe into dist/ (run this on Windows)
```

## Before you ship

- `USER_AGENT` in `weather.js` gives the NWS this repo's URL as the contact, because the NWS API asks apps to identify themselves. Change it to an email address if you'd rather be contacted that way.
- **Data license:** Open-Meteo's free API is for **non-commercial use**. If you sell the app or add ads, get an Open-Meteo API plan (or switch providers).

## Traffic cameras

Camera settings live in `cameras.config.js`. Keep `enabled: false` until the Oklahoma Department of Transportation gives you written permission. After that:

1. Set `enabled: true`.
2. Add cameras to `cameras` using the snapshot image URLs or feed ODOT gives you. Give each one a unique `id` and a `lat`/`lon` so the app can show the cameras within 50 km of the selected city, nearest first. `pageUrl` (optional) links to that camera's official page.
3. Set `refreshSeconds` and `attribution` to match ODOT's terms.

As of November 2026, OKTraffic.org publishes no public API or developer feed, and ODOT's open data portal has no camera dataset. Ask ODOT which URLs or feed to use when you ask for permission, rather than pulling from the site's internal endpoints.

**How the app protects ODOT's servers** (`camera-service.js`):

- The page never contacts ODOT. It loads `okwx-cam://cam/<id>`, which the main process answers from its cache.
- Each camera is fetched from ODOT **at most once every 5–10 minutes**. `refreshSeconds` is clamped to 300–600, however often the page asks.
- The cache is kept on disk, so restarting the app doesn't refetch. Requests for the same camera at the same time share one download, and at most 3 downloads run at once.
- Only cameras someone is looking at are fetched. Re-checks send `If-None-Match` / `If-Modified-Since`, so an unchanged image costs almost nothing.
- If a fetch fails, or ODOT sends something that isn't an image (a format change), the app keeps the last good image and doesn't try again until the next window.
- Every request sends `User-Agent: okwx/<version> (contact: <repo URL>)` from `weather.js`.

**Limits:** each installed copy has its own cache, so 100 users can mean up to 100 requests per camera per window. If the app gets many users, run a small shared server that does this caching once for everyone and point the app at it.

The camera card credits ODOT and OKTraffic.org, and an **Official camera page** button always links to OKTraffic.org. If a camera image fails to load, the card shows **View on OKTraffic.org** instead.

## Project layout

```
main.js            Electron main process (window + data requests)
weather.js         Data layer: Open-Meteo forecast/AQI/search, NWS alerts
camera-service.js  Camera image cache (ODOT is fetched at most once per 5–10 min)
cameras.config.js  Traffic camera settings
preload.js         Safe bridge between the page and main process
src/index.html     App layout
src/styles.css     Styling
src/app.js         Search, model picker, rendering, auto-refresh
src/icons.js       Weather icons
src/radar.js       Radar map (no map library)
.github/workflows/build.yml   Builds the Windows .exe on GitHub Actions
```

## Credits

- Forecast, air quality and place search: [Open-Meteo](https://open-meteo.com) (CC BY 4.0)
- Alerts: [National Weather Service API](https://www.weather.gov/documentation/services-web-api)
- Radar: [Iowa Environmental Mesonet](https://mesonet.agron.iastate.edu/) NEXRAD tiles
- Map: Esri World Dark Gray Canvas (Esri, HERE, Garmin, © OpenStreetMap contributors)

Not affiliated with any of these providers or with ODOT.

## License

MIT
