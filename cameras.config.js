// Traffic camera configuration (read by the Electron main process only, so
// camera image URLs never reach the page).
//
// IMPORTANT: Keep `enabled: false` until the Oklahoma DOT gives written
// permission to display their camera images, and follow any terms they set
// (attribution, refresh rate, caching, commercial use).
//
// Once approved, set `enabled: true` and fill in `cameras` with the snapshot
// image URLs or feed ODOT tells you to use.

module.exports = {
  enabled: false,

  attribution: 'Camera images courtesy of the Oklahoma Department of Transportation (OKTraffic.org)',

  // Official camera page. The app links here so people can still see the
  // cameras if our feed stops working (for example after a format change).
  officialUrl: 'https://oktraffic.org/',

  // How often a camera image may be fetched from ODOT, in seconds.
  // Clamped to 300–600 (5–10 minutes) no matter what is set here.
  refreshSeconds: 300,

  // Cameras within 50 km of the selected city are shown, nearest first.
  // `id` must be unique. `pageUrl` (optional) is that camera's official page.
  // Example:
  //   { id: 'i35-main-norman', name: 'I-35 @ Main St', lat: 35.2226, lon: -97.4395, imageUrl: 'https://...' },
  cameras: [],
};
