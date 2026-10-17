(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if (!NS.World) {
    console.error("[Pokémon Safari] tile-patterns.js: NS.World todavía no existe.");
    return;
  }

  const TILE = 16;
  const DRAW = 32;

  /*
    ATLAS REAL: world-tileset.png
    432 x 1040 px
    cuadrícula de 16 x 16 px

    La zona superior tiene dos grupos distintos de tierra:

    - columnas 4-6: patrón decorativo con hierba dentro.
      NO lo usamos para manchas sólidas porque produce "agujeros".

    - columnas 10-12, filas 0-2:
      autotile de tierra sólida con verde únicamente en los bordes/esquinas.
      ÉSTE es el grupo correcto para construir manchas compactas.
  */
  const ATLAS = {
    grass: [
      [0, 0], [16, 0], [32, 0],
      [0, 16], [16, 16], [32, 16],
      [0, 32], [16, 32], [32, 32]
    ],

    // Autotile de tierra sólida: columnas 10-12 / filas 0-2.
    dirt: {
      tl: [160, 0],
      t:  [176, 0],
      tr: [192, 0],

      l:  [160, 16],
      c:  [176, 16],
      r:  [192, 16],

      bl: [160, 32],
      b:  [176, 32],
      br: [192, 32]
    },

    // Piezas pequeñas completas de la primera zona.
    vertical3: {
      top:    [48, 0],
      middle: [48, 16],
      bottom: [48, 32]
    },

    horizontal3: {
      left:   [64, 48],
      middle: [80, 48],
      right:  [96, 48]
    },

    dot: [48, 48],

    water: [
      [128, 176],
      [128, 224],
      [288, 176],
      [288, 224]
    ]
  };

  const BIOME_OVERLAY = {
    meadow:   'rgba(0,0,0,0)',
    forest:   'rgba(20,72,34,0.20)',
    water:    'rgba(35,111,148,0.06)',
    mountain: 'rgba(94,91,79,0.30)',
    volcano:  'rgba(126,58,34,0.35)',
    special:  'rgba(92,54,126,0.28)'
  };

  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  function hash2(x, y, seed = 1337) {
    let h = Math.imul(x ^ seed, 374761393) + Math.imul(y, 668265263);
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function drawAtlasTile(ctx, img, source, sx, sy) {
    ctx.drawImage(
      img,
      source[0], source[1], TILE, TILE,
      sx, sy, DRAW, DRAW
    );
  }

  function grassTile(tx, ty) {
    const n = hash2(tx, ty, 41);
    return ATLAS.grass[Math.floor(n * ATLAS.grass.length) % ATLAS.grass.length];
  }

  /*
    Devuelve la pieza correcta de un rectángulo redondeado.

    Gracias al grupo dirt de 3x3 podemos construir:
      2x2
      2x3
      3x2
      3x3

    sin agujeros interiores y sin cortar los bordes.
  */
  function roundedRectTile(x, y, w, h) {
    const left = x === 0;
    const right = x === w - 1;
    const top = y === 0;
    const bottom = y === h - 1;

    if (top && left) return ATLAS.dirt.tl;
    if (top && right) return ATLAS.dirt.tr;
    if (bottom && left) return ATLAS.dirt.bl;
    if (bottom && right) return ATLAS.dirt.br;

    if (top) return ATLAS.dirt.t;
    if (bottom) return ATLAS.dirt.b;
    if (left) return ATLAS.dirt.l;
    if (right) return ATLAS.dirt.r;

    return ATLAS.dirt.c;
  }

  /*
    Cada región pequeña usa una "estampa" de terreno completa.

    Ya no colocamos siempre un 3x3 centrado.
    Se mezclan manchas pequeñas y desplazadas para romper la cuadrícula visual.
  */
  function stampForMacro(mx, my, habitat) {
    const density =
      habitat === 'meadow' ? 0.34 :
      habitat === 'forest' ? 0.16 :
      habitat === 'special' ? 0.20 :
      habitat === 'mountain' ? 0.12 :
      habitat === 'volcano' ? 0.10 : 0;

    if (hash2(mx, my, 701) >= density) return null;

    const type = hash2(mx, my, 702);

    let stamp;

    if (type < 0.16) {
      stamp = { kind:'dot', w:1, h:1 };
    } else if (type < 0.30) {
      stamp = { kind:'horizontal', w:3, h:1 };
    } else if (type < 0.44) {
      stamp = { kind:'vertical', w:1, h:3 };
    } else if (type < 0.64) {
      stamp = { kind:'rect', w:2, h:2 };
    } else if (type < 0.79) {
      stamp = { kind:'rect', w:2, h:3 };
    } else if (type < 0.92) {
      stamp = { kind:'rect', w:3, h:2 };
    } else {
      stamp = { kind:'rect', w:3, h:3 };
    }

    // Macrocelda de 6x6: permite desplazar la mancha sin cortarla.
    const macroSize = 6;
    const maxX = macroSize - stamp.w;
    const maxY = macroSize - stamp.h;

    stamp.ox = Math.floor(hash2(mx, my, 711) * (maxX + 1));
    stamp.oy = Math.floor(hash2(mx, my, 712) * (maxY + 1));

    return stamp;
  }

  function stampTile(stamp, lx, ly) {
    if (!stamp) return null;

    const x = lx - stamp.ox;
    const y = ly - stamp.oy;

    if (x < 0 || y < 0 || x >= stamp.w || y >= stamp.h) return null;

    if (stamp.kind === 'dot') {
      return ATLAS.dot;
    }

    if (stamp.kind === 'horizontal') {
      if (x === 0) return ATLAS.horizontal3.left;
      if (x === stamp.w - 1) return ATLAS.horizontal3.right;
      return ATLAS.horizontal3.middle;
    }

    if (stamp.kind === 'vertical') {
      if (y === 0) return ATLAS.vertical3.top;
      if (y === stamp.h - 1) return ATLAS.vertical3.bottom;
      return ATLAS.vertical3.middle;
    }

    return roundedRectTile(x, y, stamp.w, stamp.h);
  }

  function terrainTile(tx, ty, habitat) {
    if (habitat === 'water') {
      const n = hash2(tx >> 2, ty >> 2, 801);
      return ATLAS.water[Math.floor(n * ATLAS.water.length) % ATLAS.water.length];
    }

    const macroSize = 6;
    const mx = Math.floor(tx / macroSize);
    const my = Math.floor(ty / macroSize);
    const lx = mod(tx, macroSize);
    const ly = mod(ty, macroSize);

    const stamp = stampForMacro(mx, my, habitat);
    const tile = stampTile(stamp, lx, ly);

    return tile || grassTile(tx, ty);
  }

  const originalDrawGroundTile = NS.World.prototype.drawGroundTile;

  NS.World.prototype.drawGroundTile = function (ctx, habitat, sx, sy, wx, wy) {
    if (!this.tilesImg || !this.tilesImg.complete || this.tilesImg.naturalWidth <= 0) {
      return originalDrawGroundTile.call(this, ctx, habitat, sx, sy, wx, wy);
    }

    const tx = Math.floor(wx / DRAW);
    const ty = Math.floor(wy / DRAW);
    const source = terrainTile(tx, ty, habitat);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    drawAtlasTile(ctx, this.tilesImg, source, sx, sy);

    const overlay = BIOME_OVERLAY[habitat];
    if (overlay && overlay !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = overlay;
      ctx.fillRect(sx, sy, DRAW, DRAW);
    }

    if (habitat === 'special' && hash2(tx, ty, 903) > 0.90) {
      ctx.fillStyle = 'rgba(245,230,255,.15)';
      ctx.fillRect(sx + 8, sy + 8, 3, 3);
      ctx.fillRect(sx + 20, sy + 18, 2, 2);
    }

    ctx.restore();
  };

  NS.TilePatterns = {
    atlas: ATLAS,
    terrainTile,
    roundedRectTile
  };

  console.info("[Pokémon Safari] Patrones de terreno v2 activados.");
})();
