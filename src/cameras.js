// Traffic camera configuration.
//
// IMPORTANT: Keep CAMERAS_ENABLED = false until the Oklahoma DOT gives
// written permission to display their camera images, and follow any
// terms they set (attribution, refresh rate, caching, commercial use).
//
// Once approved, set CAMERAS_ENABLED = true and fill in CAMERAS with the
// image URLs or feed ODOT tells you to use.

window.OKWX_CAMERAS_ENABLED = false;

window.OKWX_CAMERA_ATTRIBUTION = 'Camera images courtesy of the Oklahoma Department of Transportation';

// Refresh interval in seconds (match whatever ODOT allows).
window.OKWX_CAMERA_REFRESH = 60;

// Cameras within 50 km of the selected city are shown, nearest first.
// Give each camera a lat/lon (preferred) or a city name.
// Example:
//   { name: 'I-35 @ Main St', lat: 35.2226, lon: -97.4395, imageUrl: 'https://...' },
//   { name: 'I-44 @ Yale Ave', city: 'Tulsa', imageUrl: 'https://...' },
window.OKWX_CAMERAS = [];
