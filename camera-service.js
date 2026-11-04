// Traffic camera snapshots (runs in the Electron main process).
//
// The page never talks to ODOT directly. It loads okwx-cam://cam/<id>, and this
// service answers from its cache. ODOT's server is asked for a camera image at
// most once per refresh window (5–10 minutes), however often the page asks:
//  - Images are cached in memory and on disk, so restarting the app doesn't refetch.
//  - Requests for the same camera at the same time share one download.
//  - Cameras are only fetched when someone is looking at them.
//  - Re-checks send If-None-Match / If-Modified-Since so unchanged images cost ~nothing.
//  - Failures are remembered for a full window too, so a broken feed isn't retried in a loop.
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const MIN_REFRESH_S = 300;
const MAX_REFRESH_S = 600;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_PARALLEL = 3;

function createCameraService({ fetchFn, userAgent, cacheDir, config, now = Date.now }) {
  const refreshS = Math.min(MAX_REFRESH_S, Math.max(MIN_REFRESH_S, Number(config.refreshSeconds) || MIN_REFRESH_S));
  const refreshMs = refreshS * 1000;
  const cams = new Map((config.cameras || []).map((c) => [String(c.id), c]));
  const mem = new Map();      // id -> { body, type, checkedAt, imageAt, etag, lastModified }
  const errors = new Map();   // id -> { message, at }
  const inflight = new Map(); // id -> Promise<entry>

  // Limit how many downloads run at once.
  let active = 0;
  const waiting = [];
  const acquire = () => (active < MAX_PARALLEL ? (active++, Promise.resolve()) : new Promise((r) => waiting.push(r)));
  const release = () => { const next = waiting.shift(); if (next) next(); else active--; };

  const fileBase = (id) => path.join(cacheDir, crypto.createHash('sha1').update(id).digest('hex'));

  async function loadDisk(id) {
    try {
      const base = fileBase(id);
      const meta = JSON.parse(await fs.readFile(`${base}.json`, 'utf8'));
      if (meta.url !== cams.get(id).imageUrl) return null; // camera URL changed since it was cached
      return { ...meta, body: await fs.readFile(`${base}.img`) };
    } catch {
      return null;
    }
  }

  async function saveDisk(id, e) {
    const base = fileBase(id);
    const { body, ...meta } = e;
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(`${base}.img`, body);
    await fs.writeFile(`${base}.json`, JSON.stringify({ ...meta, url: cams.get(id).imageUrl }));
  }

  async function download(id, prev) {
    await acquire();
    try {
      const headers = { 'User-Agent': userAgent, Accept: 'image/*' };
      if (prev?.etag) headers['If-None-Match'] = prev.etag;
      if (prev?.lastModified) headers['If-Modified-Since'] = prev.lastModified;
      const res = await fetchFn(cams.get(id).imageUrl, { headers });

      let entry;
      if (res.status === 304 && prev) {
        entry = { ...prev, checkedAt: now() };
      } else {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Anything other than an image means the feed changed format.
        const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (!type.startsWith('image/')) throw new Error(`Expected an image but got ${type || 'an unknown type'}`);
        const body = Buffer.from(await res.arrayBuffer());
        if (!body.length || body.length > MAX_BYTES) throw new Error(`Unexpected image size (${body.length} bytes)`);
        const t = now();
        entry = { body, type, checkedAt: t, imageAt: t, etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified') };
      }
      mem.set(id, entry);
      errors.delete(id);
      saveDisk(id, entry).catch(() => { /* the memory cache still works */ });
      return entry;
    } catch (err) {
      errors.set(id, { message: err.message, at: now() });
      // Keep showing the last good image, and wait a full window before trying again.
      if (prev) { prev.checkedAt = now(); return prev; }
      throw err;
    } finally {
      release();
    }
  }

  async function get(id) {
    if (!config.enabled || !cams.has(id)) throw new Error('Unknown camera');
    let entry = mem.get(id);
    if (!entry) {
      entry = await loadDisk(id);
      if (entry) mem.set(id, entry);
    }
    if (entry && now() - entry.checkedAt < refreshMs) return entry;
    const err = errors.get(id);
    if (!entry && err && now() - err.at < refreshMs) throw new Error(err.message);
    if (!inflight.has(id)) inflight.set(id, download(id, entry).finally(() => inflight.delete(id)));
    return inflight.get(id);
  }

  // Handler for the okwx-cam:// protocol.
  async function handle(request) {
    const id = decodeURIComponent(new URL(request.url).pathname.slice(1));
    try {
      const e = await get(id);
      return new Response(e.body, { headers: { 'Content-Type': e.type, 'Cache-Control': 'no-store' } });
    } catch {
      return new Response('', { status: 502 });
    }
  }

  const https = (u) => (/^https:\/\//i.test(u || '') ? u : null);

  // What the page needs to know. Image URLs stay in the main process.
  function list() {
    return {
      enabled: !!config.enabled,
      attribution: config.attribution || '',
      officialUrl: https(config.officialUrl),
      refreshSeconds: refreshS,
      cameras: config.enabled
        ? [...cams.values()].map((c) => ({ id: String(c.id), name: c.name, city: c.city, lat: c.lat, lon: c.lon, pageUrl: https(c.pageUrl) }))
        : [],
    };
  }

  // When each camera's image last changed, and whether its last fetch failed.
  function status(ids) {
    const out = {};
    for (const id of ids || []) {
      const e = mem.get(id), err = errors.get(id);
      out[id] = { imageAt: e?.imageAt ?? null, error: err ? err.message : null };
    }
    return out;
  }

  return { get, handle, list, status };
}

module.exports = { createCameraService, MIN_REFRESH_S, MAX_REFRESH_S };
