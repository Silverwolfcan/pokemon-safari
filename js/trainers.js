(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
      img.src = url;
    });
  }

  /*
    Los entrenadores pasan a ser assets internos del juego.

    El spritesheet incluido tiene:
      - 216 x 208 px
      - frames de 18 x 26 px
      - 3 frames por dirección
      - 4 direcciones
      - 4 entrenadores por fila
      - 2 filas de entrenadores
      - 8 entrenadores totales

    Ruta:
      assets/trainers/OpenmonSpriteSet2.png
  */
  const BUILT_IN_SHEETS = [
    'assets/trainers/OpenmonSpriteSet2.png'
  ];

  class TrainerRepository {
    constructor(profile) {
      this.profile = profile || {};
      this.definitions = [];
      this.images = [];
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
      return this.definitions.length;
    }

    validateSheet(img, index) {
      const expectedW = NS.OPENMON.sheetW;
      const expectedH = NS.OPENMON.sheetH;

      if (
        img.naturalWidth !== expectedW ||
        img.naturalHeight !== expectedH
      ) {
        throw new Error(
          `Spritesheet ${index + 1}: tamaño ${img.naturalWidth}×${img.naturalHeight}; ` +
          `se esperaba ${expectedW}×${expectedH}.`
        );
      }
    }

    async load() {
      try {
        this.images = await Promise.all(
          BUILT_IN_SHEETS.map(url => loadImage(url))
        );

        this.images.forEach((img, i) => this.validateSheet(img, i));
        this.buildDefinitions();
      } catch (error) {
        this.images = [];
        this.definitions = [];
        this.error = error.message || 'Error cargando los entrenadores.';
      }

      this.readyState = true;
    }

    buildDefinitions() {
      const o = NS.OPENMON;
      const blockW = o.frameW * o.framesPerDirection;
      const blockH = o.frameH * o.directions;

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
    }

    directionRow(direction) {
      return NS.OPENMON.rows[direction] ?? 0;
    }

    drawOpenmon(
      ctx,
      trainerId,
      x,
      y,
      direction,
      moving,
      t,
      scale = 2.25
    ) {
      if (!this.definitions.length) return false;

      const id = Math.max(
        0,
        Math.min(this.definitions.length - 1, trainerId | 0)
      );

      const def = this.definitions[id];
      const img = this.images[def.sheetIndex];

      if (!img?.naturalWidth) return false;

      const row = this.directionRow(direction);
      const walkCycle = [0, 1, 2, 1];
      const frame = moving
        ? walkCycle[Math.floor(t / 145) % walkCycle.length]
        : 1;

      const sx = def.x + frame * def.frameW;
      const sy = def.y + row * def.frameH;

      const dw = def.frameW * scale;
      const dh = def.frameH * scale;

      ctx.save();
      ctx.imageSmoothingEnabled = false;

      ctx.drawImage(
        img,
        sx,
        sy,
        def.frameW,
        def.frameH,
        x - dw / 2,
        y - dh + 8,
        dw,
        dh
      );

      ctx.restore();
      return true;
    }

    draw(ctx, trainerId, x, y, direction, moving, t, scale = 2.25) {
      return this.drawOpenmon(
        ctx,
        trainerId,
        x,
        y,
        direction,
        moving,
        t,
        scale
      );
    }

    drawPreview(ctx, trainerId, width, height, t) {
      ctx.clearRect(0, 0, width, height);

      const sequence = ['down', 'right', 'up', 'left'];
      const direction =
        sequence[Math.floor(t / 1400) % sequence.length];

      this.draw(
        ctx,
        trainerId,
        width / 2,
        height - 8,
        direction,
        true,
        t,
        3.0
      );
    }
  }

  NS.TrainerRepository = TrainerRepository;
})();
