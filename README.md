# okwx

A Windows desktop weather app for Oklahoma. It shows current conditions, a 12-hour and 7-day forecast, and active alerts from the National Weather Service. ODOT traffic cameras will be added once permission is granted.

## Features

- 14 Oklahoma cities, and the app remembers your last pick
- Current conditions, hourly and 7-day forecast
- Active NWS watches and warnings
- Refreshes on its own every 10 minutes
- Traffic camera panel, turned off until ODOT approves it (see below)

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

- In `main.js`, replace `you@example.com` in `USER_AGENT` with your own contact. The NWS API asks apps to identify themselves.

## Traffic cameras

Camera settings live in `src/cameras.js`. Keep `OKWX_CAMERAS_ENABLED = false` until the Oklahoma Department of Transportation gives you written permission. After that:

1. Set `OKWX_CAMERAS_ENABLED = true`.
2. Add cameras to `OKWX_CAMERAS` using the image URLs or feed ODOT gives you.
3. Set `OKWX_CAMERA_REFRESH` and the attribution text to match ODOT's terms.

## Project layout

```
main.js            Electron main process (window + NWS requests)
preload.js         Safe bridge between the page and main process
src/index.html     App layout
src/styles.css     Styling
src/app.js         City picker, rendering, auto-refresh
src/cameras.js     Traffic camera settings
.github/workflows/build.yml   Builds the Windows .exe on GitHub Actions
```

## Credits

Weather data from the [National Weather Service API](https://www.weather.gov/documentation/services-web-api). Not affiliated with NWS or ODOT.

## License

MIT
