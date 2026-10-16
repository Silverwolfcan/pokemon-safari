(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      if (!url) return reject(new Error('Sin URL'));
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar el spritesheet'));
      img.src = url;
    });
  }

  class TrainerRepository {
    constructor(profile) {
      this.profile = profile || {};
      this.definitions = [];
      this.images = [];
      this.fallback = new Image();
      this.fallback.src = NS.VISUAL_ASSETS.trainerFallback.url;
      this.readyState = false;
      this.error = '';
      this.promise = this.load();
    }

    async ready() {
      await this.promise;
      return this;
    }

    hasOpenmonPack() {
      return this.definitions.length > 0;
    }

    get count() {
      return Math.max(1, this.definitions.length);
    }

    validateSheet(img, index) {
      const expectedW = NS.OPENMON.sheetW;
      const expectedH = NS.OPENMON.sheetH;
      if (img.naturalWidth !== expectedW || img.naturalHeight !== expectedH) {
        throw new Error(`Set ${index + 1}: tamaño ${img.naturalWidth}×${img.naturalHeight}; se esperaba ${expectedW}×${expectedH}.`);
      }
    }

    async load() {
      const entries = [
        { key: 'set1', url: this.profile?.trainerSheets?.set1 },
        { key: 'set2', url: this.profile?.trainerSheets?.set2 }
      ].filter(e => Boolean(e.url));

      if (!entries.length) {
        this.readyState = true;
        return;
      }

      try {
        this.images = await Promise.all(entries.map(e => loadImage(e.url)));
        this.images.forEach((img, i) => this.validateSheet(img, i));
        this.buildDefinitions();
      } catch (e) {
        this.images = [];
        this.definitions = [];
        this.error = e.message || 'Error cargando el pack Openmon.';
      }
      this.readyState = true;
    }

    buildDefinitions() {
      const o = NS.OPENMON;
      const blockW = o.frameW * o.framesPerDirection; // 54 px
      const blockH = o.frameH * o.directions;         // 104 px
      this.definitions = [];

      this.images.forEach((img, sheetIndex) => {
        for (let trainerRow = 0; trainerRow < o.trainerRows; trainerRow++) {
          for (let trainerCol = 0; trainerCol < o.trainersPerRow; trainerCol++) {
            this.definitions.push({
              sheetIndex,
              x: trainerCol * blockW,
              y: trainerRow * blockH,
              frameW: o.frameW,
              frameH: o.frameH,
              frames: o.framesPerDirection
            });
          }
        }
      });

      this.definitions = this.definitions.slice(0, o.targetTrainerCount);
    }

    directionRow(direction) {
      return NS.OPENMON.rows[direction] ?? 0;
    }

    drawOpenmon(ctx, trainerId, x, y, direction, moving, t, scale = 2.25) {
      if (!this.definitions.length) return false;
      const id = Math.max(0, Math.min(this.definitions.length - 1, trainerId | 0));
      const def = this.definitions[id];
      const img = this.images[def.sheetIndex];
      if (!img?.naturalWidth) return false;

      const row = this.directionRow(direction);
      // El frame central es la pose neutra de cada dirección.
      // Al caminar: 0 -> 1 -> 2 -> 1 para evitar un salto brusco al repetir.
      const walkCycle = [0, 1, 2, 1];
      const frame = moving ? walkCycle[Math.floor(t / 145) % walkCycle.length] : 1;
      const sx = def.x + frame * def.frameW;
      const sy = def.y + row * def.frameH;
      const dw = def.frameW * scale;
      const dh = def.frameH * scale;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, sx, sy, def.frameW, def.frameH, x - dw / 2, y - dh + 8, dw, dh);
      ctx.restore();
      return true;
    }

    drawFallback(ctx, x, y, direction, moving, t, scale = 2.15) {
      const a = NS.VISUAL_ASSETS.trainerFallback;
      if (this.fallback.complete && this.fallback.naturalWidth) {
        const row = a.rows[direction] ?? 0;
        const frame = moving ? Math.floor(t / 125) % a.frames : 0;
        const dw = a.frameW * scale, dh = a.frameH * scale;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.fallback, frame * a.frameW, row * a.frameH, a.frameW, a.frameH, x - dw / 2, y - dh + 10, dw, dh);
        ctx.restore();
        return true;
      }
      return false;
    }

    draw(ctx, trainerId, x, y, direction, moving, t, scale = 2.25) {
      if (this.drawOpenmon(ctx, trainerId, x, y, direction, moving, t, scale)) return true;
      return this.drawFallback(ctx, x, y, direction, moving, t, scale * .96);
    }

    drawPreview(ctx, trainerId, width, height, t) {
      ctx.clearRect(0, 0, width, height);
      // Va rotando por las cuatro direcciones para comprobar el atlas visualmente.
      const sequence = ['down', 'right', 'up', 'left'];
      const direction = sequence[Math.floor(t / 1400) % sequence.length];
      const x = width / 2;
      const y = height - 8;
      this.draw(ctx, trainerId, x, y, direction, true, t, 3.0);
    }
  }

  NS.TrainerRepository = TrainerRepository;
})();
