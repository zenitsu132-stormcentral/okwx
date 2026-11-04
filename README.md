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

Camera settings live in `src/cameras.js`. Keep `OKWX_CAMERAS_ENABLED = false` until the Oklahoma Department of Transportation gives you written permission. After that:

1. Set `OKWX_CAMERAS_ENABLED = true`.
2. Add cameras to `OKWX_CAMERAS` using the image URLs or feed ODOT gives you. Give each one a `lat`/`lon` so the app can show the cameras within 50 km of the selected city, nearest first.
3. Set `OKWX_CAMERA_REFRESH` and the attribution text to match ODOT's terms.

## Project layout

```
main.js            Electron main process (window + data requests)
weather.js         Data layer: Open-Meteo forecast/AQI/search, NWS alerts
preload.js         Safe bridge between the page and main process
src/index.html     App layout
src/styles.css     Styling
src/app.js         Search, model picker, rendering, auto-refresh
src/icons.js       Weather icons
src/radar.js       Radar map (no map library)
src/cameras.js     Traffic camera settings
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
