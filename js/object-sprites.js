(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if (!NS.World) {
    console.error("[Pokémon Safari] object-sprites.js: NS.World todavía no existe.");
    return;
  }

  const TILE = 16;

  /*
    Selección visual deliberadamente limitada para mantener coherencia:

    Bosque:
      - árbol verde:      (0,27)
      - árbol verde/oliva:(3,27)

    Costa:
      - palmera frutal:   (2,28)
      - palmera:          (3,28)

    Rocas:
      - dos piedras:      (0,26), (1,26)

    Se evita el árbol rojo/frutal de (2,27) para que el bosque
    mantenga una paleta más uniforme.
  */
  const ATLAS_OBJECTS = {
    rocks: [
      [0, 416],
      [16, 416]
    ],

    forestTrees: [
      [0, 432],
      [48, 432]
    ],

    palms: [
      [32, 448],
      [48, 448]
    ]
  };

  function hash2(x, y, seed = 1337) {
    let h = Math.imul((x | 0) ^ seed, 374761393) + Math.imul((y | 0), 668265263);
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function pick(list, object, seed) {
    const n = hash2(
      Math.round(object.x / 16),
      Math.round(object.y / 16),
      seed + (object.variant || 0)
    );

    return list[Math.floor(n * list.length) % list.length];
  }

  function drawSprite(ctx, img, source, x, y, width, height) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
      img,
      source[0], source[1], TILE, TILE,
      Math.round(x - width / 2),
      Math.round(y - height),
      width,
      height
    );

    ctx.restore();
  }

  function drawSpecialMarker(ctx, object, x, y) {
    if (!object.special || object.used) return;

    const iy = object.type === 'tree' ? y - 61 : y - 36;

    ctx.save();
    ctx.fillStyle = 'rgba(18,28,21,.90)';
    ctx.beginPath();
    ctx.arc(x, iy, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#f4dd67';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#f7e67b';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', x, iy + 1);
    ctx.restore();
  }

  const originalDrawObstacle = NS.World.prototype.drawObstacle;

  NS.World.prototype.drawObstacle = function (ctx, object, camera, w, h) {
    if (!this.tilesImg || !this.tilesImg.complete || this.tilesImg.naturalWidth <= 0) {
      return originalDrawObstacle.call(this, ctx, object, camera, w, h);
    }

    if (object.type !== 'tree' && object.type !== 'rock') {
      return originalDrawObstacle.call(this, ctx, object, camera, w, h);
    }

    const x = Math.round(object.x - camera.x + w / 2);
    const y = Math.round(object.y - camera.y + h / 2);

    if (object.type === 'rock') {
      const source = pick(ATLAS_OBJECTS.rocks, object, 510);

      const size = object.smallRock || object.biome === 'meadow'
        ? 28
        : 42;

      drawSprite(
        ctx,
        this.tilesImg,
        source,
        x,
        y + 4,
        size,
        size
      );

      drawSpecialMarker(ctx, object, x, y);
      return;
    }

    if (object.type === 'tree') {
      // Las únicas "excepciones" al bosque son las palmeras costeras.
      const coastal = object.biome === 'water';

      const pool = coastal
        ? ATLAS_OBJECTS.palms
        : ATLAS_OBJECTS.forestTrees;

      const source = pick(pool, object, coastal ? 650 : 621);

      const size = coastal ? 60 : 56;

      drawSprite(
        ctx,
        this.tilesImg,
        source,
        x,
        y + 5,
        size,
        size
      );

      drawSpecialMarker(ctx, object, x, y);
      return;
    }
  };

  NS.ObjectSprites = {
    atlas: ATLAS_OBJECTS
  };

  console.info("[Pokémon Safari] Objetos del tileset por bioma activados.");
})();
