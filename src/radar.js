// Animated NEXRAD radar map with a dark basemap. No map library needed.
//  - Radar: NEXRAD composite tiles from Iowa Environmental Mesonet (mesonet.agron.iastate.edu)
//  - Basemap + labels: CARTO dark tiles, © OpenStreetMap contributors © CARTO
(function () {
  const TILE = 256;
  const FRAME_MINUTES = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0];
  const BASE = (z, x, y) => `https://a.basemaps.cartocdn.com/dark_nolabels/${z}/${x}/${y}@2x.png`;
  const LABELS = (z, x, y) => `https://a.basemaps.cartocdn.com/dark_only_labels/${z}/${x}/${y}@2x.png`;
  const radarUrl = (mins, stamp) => {
    const layer = mins === 0 ? 'nexrad-n0q-900913' : `nexrad-n0q-900913-m${String(mins).padStart(2, '0')}m`;
    return (z, x, y) => `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/${layer}/${z}/${x}/${y}.png?_=${stamp}`;
  };

  const project = (lat, lon, z) => {
    const s = TILE * 2 ** z;
    const sin = Math.sin((lat * Math.PI) / 180);
    return {
      x: ((lon + 180) / 360) * s,
      y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s,
    };
  };

  const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  class RadarMap {
    constructor(el, { zoom = 6, minZoom = 4, maxZoom = 9 } = {}) {
      this.el = el;
      this.zoom = zoom;
      this.minZoom = minZoom;
      this.maxZoom = maxZoom;
      this.frame = FRAME_MINUTES.length - 1;
      this.playing = true;
      this.lat = 35.47;
      this.lon = -97.52;
      this.build();
      this.newFrames();
      this.timer = setInterval(() => this.tick(), 650);
      this.refreshTimer = setInterval(() => { this.newFrames(); this.render(); }, 5 * 60 * 1000);
      new ResizeObserver(() => this.render()).observe(this.view);
    }

    build() {
      this.el.classList.add('rmap');
      this.el.innerHTML = `
        <div class="rmap-view">
          <div class="rmap-layer" data-l="base"></div>
          <div class="rmap-frames"></div>
          <div class="rmap-layer" data-l="labels"></div>
          <div class="rmap-marker"></div>
          <div class="rmap-zoom">
            <button type="button" data-z="1" aria-label="Zoom in">+</button>
            <button type="button" data-z="-1" aria-label="Zoom out">&minus;</button>
          </div>
          <div class="rmap-attr">© OpenStreetMap © CARTO · NEXRAD via IEM</div>
        </div>
        <div class="rmap-bar">
          <button type="button" class="rmap-play" aria-label="Pause"></button>
          <div class="rmap-track">
            <div class="rmap-times"><b class="rmap-time"></b><span class="rmap-ago"></span></div>
            <div class="rmap-segs"></div>
          </div>
        </div>`;
      this.view = this.el.querySelector('.rmap-view');
      this.baseLayer = this.el.querySelector('[data-l="base"]');
      this.labelLayer = this.el.querySelector('[data-l="labels"]');
      this.framesEl = this.el.querySelector('.rmap-frames');
      this.marker = this.el.querySelector('.rmap-marker');
      this.playBtn = this.el.querySelector('.rmap-play');
      this.segs = this.el.querySelector('.rmap-segs');

      this.segs.innerHTML = FRAME_MINUTES.map((_, i) => `<button type="button" data-i="${i}"></button>`).join('');
      this.segs.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        this.playing = false;
        this.showFrame(+b.dataset.i);
      });
      this.playBtn.addEventListener('click', () => { this.playing = !this.playing; this.updateBar(); });
      this.el.querySelector('.rmap-zoom').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (b) this.setZoom(this.zoom + +b.dataset.z);
      });

      // Drag to pan
      let drag = null;
      this.view.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        drag = { x: e.clientX, y: e.clientY, cx: this.cx, cy: this.cy };
        this.view.setPointerCapture(e.pointerId);
        this.view.classList.add('dragging');
      });
      this.view.addEventListener('pointermove', (e) => {
        if (!drag) return;
        this.cx = drag.cx - (e.clientX - drag.x);
        this.cy = drag.cy - (e.clientY - drag.y);
        if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = null; this.render(); });
      });
      const end = () => { drag = null; this.view.classList.remove('dragging'); };
      this.view.addEventListener('pointerup', end);
      this.view.addEventListener('pointercancel', end);
      this.view.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.setZoom(this.zoom + (e.deltaY < 0 ? 1 : -1));
      }, { passive: false });
    }

    newFrames() {
      const stamp = Math.floor(Date.now() / 300000);
      this.latest = new Date(stamp * 300000);
      this.frames = FRAME_MINUTES.map((m) => ({
        mins: m,
        url: radarUrl(m, stamp),
        time: new Date(this.latest.getTime() - m * 60000),
      }));
      this.framesEl.innerHTML = this.frames.map(() => '<div class="rmap-layer rmap-radar"></div>').join('');
      this.frameLayers = [...this.framesEl.children];
      this.showFrame(this.frame);
    }

    setLocation(lat, lon) {
      this.lat = lat;
      this.lon = lon;
      const p = project(lat, lon, this.zoom);
      this.cx = p.x;
      this.cy = p.y;
      this.render();
    }

    setZoom(z) {
      z = Math.max(this.minZoom, Math.min(this.maxZoom, z));
      if (z === this.zoom) return;
      const f = 2 ** (z - this.zoom);
      this.cx *= f;
      this.cy *= f;
      this.zoom = z;
      [this.baseLayer, this.labelLayer, ...this.frameLayers].forEach((l) => { l.innerHTML = ''; l._tiles = null; });
      this.render();
    }

    tiles(layer, urlFn) {
      const W = this.view.clientWidth, H = this.view.clientHeight;
      if (!W || !H) return;
      const z = this.zoom, n = 2 ** z;
      const left = this.cx - W / 2, top = this.cy - H / 2;
      const x0 = Math.floor(left / TILE), x1 = Math.floor((left + W) / TILE);
      const y0 = Math.max(0, Math.floor(top / TILE)), y1 = Math.min(n - 1, Math.floor((top + H) / TILE));
      const old = layer._tiles || new Map();
      const next = new Map();
      for (let tx = x0; tx <= x1; tx++) {
        for (let ty = y0; ty <= y1; ty++) {
          const key = `${tx}/${ty}`;
          let img = old.get(key);
          if (!img) {
            img = new Image(TILE, TILE);
            img.draggable = false;
            img.alt = '';
            img.onerror = () => { img.style.visibility = 'hidden'; };
            img.src = urlFn(z, ((tx % n) + n) % n, ty);
            layer.appendChild(img);
          }
          img.style.transform = `translate(${Math.round(tx * TILE - left)}px, ${Math.round(ty * TILE - top)}px)`;
          next.set(key, img);
          old.delete(key);
        }
      }
      old.forEach((img) => img.remove());
      layer._tiles = next;
    }

    render() {
      if (this.cx == null) return;
      this.tiles(this.baseLayer, BASE);
      this.tiles(this.labelLayer, LABELS);
      this.frameLayers.forEach((l, i) => this.tiles(l, this.frames[i].url));
      const p = project(this.lat, this.lon, this.zoom);
      this.marker.style.transform = `translate(${Math.round(p.x - this.cx + this.view.clientWidth / 2)}px, ${Math.round(p.y - this.cy + this.view.clientHeight / 2)}px)`;
    }

    showFrame(i) {
      this.frame = i;
      this.frameLayers.forEach((l, j) => l.classList.toggle('on', j === i));
      this.updateBar();
    }

    updateBar() {
      const f = this.frames[this.frame];
      this.el.querySelector('.rmap-time').textContent = fmtTime(f.time);
      const ago = Math.round((Date.now() - f.time.getTime()) / 60000);
      this.el.querySelector('.rmap-ago').textContent = ago <= 1 ? 'Latest' : `${ago} min ago`;
      [...this.segs.children].forEach((b, j) => b.classList.toggle('on', j === this.frame));
      this.playBtn.classList.toggle('paused', !this.playing);
      this.playBtn.setAttribute('aria-label', this.playing ? 'Pause' : 'Play');
    }

    tick() {
      if (!this.playing) return;
      // Hold on the latest frame for an extra beat.
      if (this.frame === this.frames.length - 1 && !this.hold) { this.hold = true; return; }
      this.hold = false;
      this.showFrame((this.frame + 1) % this.frames.length);
    }

    destroy() {
      clearInterval(this.timer);
      clearInterval(this.refreshTimer);
      this.el.innerHTML = '';
    }
  }

  window.RadarMap = RadarMap;
})();
