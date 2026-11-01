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

// Example shape: { name: 'I-35 @ Main St, Norman', city: 'Norman', imageUrl: 'https://...' }
window.OKWX_CAMERAS = [];
