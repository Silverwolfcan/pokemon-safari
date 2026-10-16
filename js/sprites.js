(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  class SpriteRepository {
    constructor() {
      this.entries = new Map();
    }

    get(species, shiny = false) {
      const key = `${species.id}:${shiny ? 'shiny' : 'normal'}`;
      if (!this.entries.has(key)) this.entries.set(key, this.createEntry(species, shiny));
      return this.entries.get(key);
    }

    createEntry(species, shiny) {
      const entry = {
        walkImg: new Image(), idleImg: new Image(),
        walkShadowImg: new Image(), idleShadowImg: new Image(),
        walk: null, idle: null,
        walkAnchors: null, idleAnchors: null,
        walkBounds: null, idleBounds: null,
        ready: false, failed: false, shiny,
        usingNormalFallback: false
      };

      const setupImages = (useShiny) => {
        const prefix = useShiny ? 'shiny' : 'normal';
        entry.walkImg = this.makeImage(useShiny ? species.shinyWalkUrl : species.walkUrl);
        entry.idleImg = this.makeImage(useShiny ? species.shinyIdleUrl : species.idleUrl);
        entry.walkShadowImg = this.makeImage(useShiny ? species.shinyWalkShadowUrl : species.walkShadowUrl);
        entry.idleShadowImg = this.makeImage(useShiny ? species.shinyIdleShadowUrl : species.idleShadowUrl);
        return {
          metaUrl: useShiny ? species.shinyAnimDataUrl : species.animDataUrl,
          prefix
        };
      };

      const load = async (useShiny) => {
        const setup = setupImages(useShiny);
        const [meta] = await Promise.all([
          this.loadMeta(setup.metaUrl),
          this.waitImage(entry.walkImg),
          this.waitImage(entry.idleImg, true),
          this.waitImage(entry.walkShadowImg, true),
          this.waitImage(entry.idleShadowImg, true)
        ]);

        entry.walk = meta.Walk || this.fallbackMeta(entry.walkImg);
        entry.idle = meta.Idle || entry.walk;
        if (!entry.walk || !entry.idle) throw new Error('Metadatos de sprite no válidos');
        // Algunas especies de SpriteCollab (p. ej. Beedrill) declaran Idle como CopyOf Walk
        // y no tienen Idle-Anim.png independiente. En ese caso reutilizamos Walk.
        if (!entry.idleImg?.naturalWidth) entry.idleImg = entry.walkImg;
        if (!entry.idleShadowImg?.naturalWidth) entry.idleShadowImg = entry.walkShadowImg;

        entry.walkAnchors = this.extractGroundAnchors(entry.walkShadowImg, entry.walk);
        entry.idleAnchors = this.extractGroundAnchors(entry.idleShadowImg, entry.idle);
        entry.walkBounds = this.extractVisualBounds(entry.walkImg, entry.walk);
        entry.idleBounds = this.extractVisualBounds(entry.idleImg, entry.idle);
        entry.ready = true;
      };

      load(shiny).catch(() => {
        if (!shiny) {
          entry.failed = true;
          return;
        }
        entry.usingNormalFallback = true;
        load(false).catch(() => { entry.failed = true; });
      });

      return entry;
    }

    makeImage(url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      return img;
    }

    waitImage(img, optional = false) {
      return new Promise((resolve, reject) => {
        if (img.complete) {
          if (img.naturalWidth) return resolve(img);
          return optional ? resolve(null) : reject(new Error('Imagen no disponible'));
        }
        img.onload = () => resolve(img);
        img.onerror = () => optional ? resolve(null) : reject(new Error('Imagen no disponible'));
      });
    }

    async loadMeta(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error('AnimData no disponible');
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/xml');
      const out = {};
      for (const node of doc.querySelectorAll('Anim')) {
        const name = node.querySelector(':scope > Name')?.textContent?.trim();
        if (!name) continue;
        const copy = node.querySelector(':scope > CopyOf')?.textContent?.trim();
        if (copy) continue;
        const fw = Number(node.querySelector(':scope > FrameWidth')?.textContent || 0);
        const fh = Number(node.querySelector(':scope > FrameHeight')?.textContent || 0);
        const durations = [...node.querySelectorAll(':scope > Durations > Duration')]
          .map(n => Number(n.textContent || 4));
        if (fw && fh && durations.length) out[name] = { fw, fh, frames: durations.length, durations };
      }
      return out;
    }

    fallbackMeta(img) {
      if (!img || !img.naturalWidth || !img.naturalHeight) return null;
      const fh = Math.floor(img.naturalHeight / 8);
      const frames = Math.max(1, Math.round(img.naturalWidth / Math.max(1, fh)));
      const fw = Math.floor(img.naturalWidth / frames);
      return { fw, fh, frames, durations: Array(frames).fill(6) };
    }

    readPixels(img) {
      if (!img || !img.naturalWidth || !img.naturalHeight) return null;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
      } catch (_) {
        return null;
      }
    }

    extractGroundAnchors(shadowImg, meta) {
      const px = this.readPixels(shadowImg);
      if (!px || !meta) return null;
      const anchors = Array.from({ length: 8 }, () => []);
      for (let row = 0; row < 8; row++) {
        for (let frame = 0; frame < meta.frames; frame++) {
          const bounds = this.scanCell(px, frame * meta.fw, row * meta.fh, meta.fw, meta.fh);
          anchors[row][frame] = bounds
            ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
            : { x: meta.fw / 2, y: meta.fh * 0.82 };
        }
      }
      return anchors;
    }

    extractVisualBounds(img, meta) {
      const px = this.readPixels(img);
      if (!px || !meta) return null;
      const result = Array.from({ length: 8 }, () => []);
      for (let row = 0; row < 8; row++) {
        for (let frame = 0; frame < meta.frames; frame++) {
          result[row][frame] = this.scanCell(px, frame * meta.fw, row * meta.fh, meta.fw, meta.fh) || {
            minX: 0, minY: 0, maxX: meta.fw - 1, maxY: meta.fh - 1,
            width: meta.fw, height: meta.fh
          };
        }
      }
      return result;
    }

    scanCell(px, x0, y0, w, h) {
      let minX = w, minY = h, maxX = -1, maxY = -1;
      for (let y = 0; y < h; y++) {
        const py = y0 + y;
        if (py >= px.height) break;
        for (let x = 0; x < w; x++) {
          const xx = x0 + x;
          if (xx >= px.width) break;
          if (px.data[(py * px.width + xx) * 4 + 3] > 8) {
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          }
        }
      }
      if (maxX < 0) return null;
      return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
    }

    directionRow(dx, dy) {
      if (Math.abs(dx) < .01 && Math.abs(dy) < .01) return 0;
      const a = Math.atan2(dy, dx);
      const oct = Math.round(a / (Math.PI / 4));
      const map = { 2: 0, 1: 1, 0: 2, '-1': 3, '-2': 4, '-3': 5, 4: 6, 3: 7 };
      return map[oct] ?? map[oct === -4 ? 4 : oct] ?? 0;
    }

    frameAt(meta, t) {
      const total = meta.durations.reduce((a, b) => a + b, 0) || meta.frames * 6;
      let tick = (t * 60 / 1000) % total;
      let frame = 0;
      for (; frame < meta.durations.length - 1; frame++) {
        if (tick < meta.durations[frame]) break;
        tick -= meta.durations[frame];
      }
      return frame;
    }

    getFrameInfo(species, dx, dy, t, moving = true, shiny = false) {
      const e = this.get(species, shiny);
      if (!e.ready) return null;
      const meta = moving ? e.walk : e.idle;
      const img = moving ? e.walkImg : e.idleImg;
      const anchors = moving ? e.walkAnchors : e.idleAnchors;
      const boundsSet = moving ? e.walkBounds : e.idleBounds;
      const row = this.directionRow(dx, dy);
      const frame = this.frameAt(meta, t);
      const anchor = anchors?.[row]?.[frame] || { x: meta.fw / 2, y: meta.fh * .82 };
      const bounds = boundsSet?.[row]?.[frame] || { minX: 0, minY: 0, maxX: meta.fw - 1, maxY: meta.fh - 1, width: meta.fw, height: meta.fh };
      return { e, meta, img, row, frame, anchor, bounds };
    }

    draw(ctx, species, x, y, dx, dy, t, moving = true, scale = 1.45, alpha = 1, shiny = false) {
      const info = this.getFrameInfo(species, dx, dy, t, moving, shiny);
      if (!info) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#dbe7df';
        ctx.beginPath(); ctx.arc(x, y - 18, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#203128'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(species.name, x, y + 10);
        ctx.restore();
        return false;
      }
      const { meta, img, row, frame, anchor } = info;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        img,
        frame * meta.fw, row * meta.fh, meta.fw, meta.fh,
        x - anchor.x * scale, y - anchor.y * scale,
        meta.fw * scale, meta.fh * scale
      );
      ctx.restore();
      return true;
    }

    getCaptureProfile(species, shiny = false, scale = 1.5) {
      const e = this.get(species, shiny);
      if (!e.ready) return { offsetX: 0, offsetY: -22, radius: 20 };
      const row = 0, frame = 0;
      const meta = e.idle;
      const anchor = e.idleAnchors?.[row]?.[frame] || { x: meta.fw / 2, y: meta.fh * .82 };
      const b = e.idleBounds?.[row]?.[frame] || { minX: 0, minY: 0, maxX: meta.fw - 1, maxY: meta.fh - 1, width: meta.fw, height: meta.fh };
      const centerX = (b.minX + b.maxX) / 2;
      const centerY = (b.minY + b.maxY) / 2;
      const radius = Math.max(14, Math.min(38, Math.max(b.width * .42, b.height * .30) * scale));
      return {
        offsetX: (centerX - anchor.x) * scale,
        offsetY: (centerY - anchor.y) * scale,
        radius
      };
    }

    drawPreview(ctx, species, width, height, t, shiny = false, silhouette = false) {
      const info = this.getFrameInfo(species, 0, 1, t, false, shiny);
      ctx.clearRect(0, 0, width, height);
      if (!info) {
        ctx.save(); ctx.fillStyle = silhouette ? '#050807' : '#dbe7df';
        ctx.beginPath(); ctx.arc(width / 2, height / 2, 18, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        return;
      }
      const { meta, img, row, frame, bounds } = info;
      const pad = 12;
      const scale = Math.min((width - pad * 2) / Math.max(1, bounds.width), (height - pad * 2) / Math.max(1, bounds.height), 2.4);
      const visibleW = bounds.width * scale;
      const visibleH = bounds.height * scale;
      const dstX = (width - visibleW) / 2 - bounds.minX * scale;
      const dstY = (height - visibleH) / 2 - bounds.minY * scale;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (silhouette) {
        // Dibuja primero en un canvas temporal para convertir solo el Pokémon en silueta.
        const off = document.createElement('canvas'); off.width = width; off.height = height;
        const oc = off.getContext('2d'); oc.imageSmoothingEnabled = false;
        oc.drawImage(img, frame * meta.fw, row * meta.fh, meta.fw, meta.fh, dstX, dstY, meta.fw * scale, meta.fh * scale);
        oc.globalCompositeOperation = 'source-in'; oc.fillStyle = '#050807'; oc.fillRect(0, 0, width, height);
        ctx.drawImage(off, 0, 0);
      } else {
        ctx.drawImage(img, frame * meta.fw, row * meta.fh, meta.fw, meta.fh, dstX, dstY, meta.fw * scale, meta.fh * scale);
      }
      ctx.restore();
    }
  }

  NS.SpriteRepository = SpriteRepository;
})();
