(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if (!NS.World) {
    console.error("[Pokémon Safari] water-biome.js: NS.World todavía no existe.");
    return;
  }

  const TILE = 16;
  const DRAW = 32;

  const WATER_ATLAS = {
    /*
      Autotile arena/verde.
      Es el grupo que señalaste: arena sólida con verde únicamente
      en bordes y esquinas.
    */
    coast: {
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

    /*
      Autotile de agua.
      Grupo de 3x3 situado en la zona de lagunas del atlas.
    */
    lagoon: {
      tl: [192, 160],
      t:  [208, 160],
      tr: [224, 160],

      l:  [192, 176],
      c:  [208, 176],
      r:  [224, 176],

      bl: [192, 192],
      b:  [208, 192],
      br: [224, 192]
    }
  };

  function hash2(x, y, seed = 1337) {
    let h = Math.imul((x | 0) ^ seed, 374761393) + Math.imul((y | 0), 668265263);
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  function tileCenter(tx, ty) {
    return {
      x: tx * DRAW + DRAW / 2,
      y: ty * DRAW + DRAW / 2
    };
  }

  function isWaterBiomeTile(world, tx, ty) {
    const p = tileCenter(tx, ty);
    return world.habitatAt(p.x, p.y) === 'water';
  }

  /*
    Forma procedimental de la laguna.

    Sigue usando dos elipses combinadas para conseguir masas de agua
    irregulares, pero ahora esta función solo describe la forma matemática.
    Más abajo se añade un margen costero para impedir que el agua toque
    directamente el límite del bioma.
  */
  function rawLagoonAtTile(tx, ty) {
    const macro = 14;
    const mx = Math.floor(tx / macro);
    const my = Math.floor(ty / macro);
    const lx = mod(tx, macro);
    const ly = mod(ty, macro);

    const cx = 5.5 + hash2(mx, my, 1001) * 3.0;
    const cy = 5.2 + hash2(mx, my, 1002) * 3.3;
    const rx = 3.1 + hash2(mx, my, 1003) * 1.7;
    const ry = 2.6 + hash2(mx, my, 1004) * 1.5;

    const dx = (lx - cx) / rx;
    const dy = (ly - cy) / ry;
    let inside = dx * dx + dy * dy < 1;

    if (hash2(mx, my, 1005) > 0.36) {
      const cx2 = cx + (hash2(mx, my, 1006) - .5) * 4.2;
      const cy2 = cy + (hash2(mx, my, 1007) - .5) * 3.8;
      const rx2 = 1.8 + hash2(mx, my, 1008) * 1.3;
      const ry2 = 1.5 + hash2(mx, my, 1009) * 1.0;

      const dx2 = (lx - cx2) / rx2;
      const dy2 = (ly - cy2) / ry2;
      inside = inside || (dx2 * dx2 + dy2 * dy2 < 1);
    }

    if (lx < 1 || ly < 1 || lx > macro - 2 || ly > macro - 2) {
      return false;
    }

    return inside;
  }

  /*
    El agua solo existe si estamos suficientemente dentro del bioma costero.

    Comprobamos dos tiles en las cuatro direcciones. De esta forma siempre
    queda una franja de arena entre una laguna y el siguiente bioma.
  */
  function lagoonAtTile(world, tx, ty) {
    if (!isWaterBiomeTile(world, tx, ty)) return false;
    if (!rawLagoonAtTile(tx, ty)) return false;

    const margin = 2;

    return (
      isWaterBiomeTile(world, tx + margin, ty) &&
      isWaterBiomeTile(world, tx - margin, ty) &&
      isWaterBiomeTile(world, tx, ty + margin) &&
      isWaterBiomeTile(world, tx, ty - margin)
    );
  }

  function lagoonAtPoint(world, x, y) {
    return lagoonAtTile(
      world,
      Math.floor(x / DRAW),
      Math.floor(y / DRAW)
    );
  }

  function lagoonTile(world, tx, ty) {
    if (!lagoonAtTile(world, tx, ty)) return null;

    const n = lagoonAtTile(world, tx, ty - 1);
    const s = lagoonAtTile(world, tx, ty + 1);
    const w = lagoonAtTile(world, tx - 1, ty);
    const e = lagoonAtTile(world, tx + 1, ty);

    if (!n && !w) return WATER_ATLAS.lagoon.tl;
    if (!n && !e) return WATER_ATLAS.lagoon.tr;
    if (!s && !w) return WATER_ATLAS.lagoon.bl;
    if (!s && !e) return WATER_ATLAS.lagoon.br;

    if (!n) return WATER_ATLAS.lagoon.t;
    if (!s) return WATER_ATLAS.lagoon.b;
    if (!w) return WATER_ATLAS.lagoon.l;
    if (!e) return WATER_ATLAS.lagoon.r;

    return WATER_ATLAS.lagoon.c;
  }

  /*
    Tile visual de transición arena -> bioma vecino.

    El centro sigue siendo arena. Cuando un vecino deja de ser el bioma de
    costa utilizamos las piezas con borde verde del atlas, evitando el corte
    seco arena/hierba.
  */
  function coastTile(world, tx, ty) {
    const n = !isWaterBiomeTile(world, tx, ty - 1);
    const s = !isWaterBiomeTile(world, tx, ty + 1);
    const w = !isWaterBiomeTile(world, tx - 1, ty);
    const e = !isWaterBiomeTile(world, tx + 1, ty);

    if (n && w) return WATER_ATLAS.coast.tl;
    if (n && e) return WATER_ATLAS.coast.tr;
    if (s && w) return WATER_ATLAS.coast.bl;
    if (s && e) return WATER_ATLAS.coast.br;

    if (n) return WATER_ATLAS.coast.t;
    if (s) return WATER_ATLAS.coast.b;
    if (w) return WATER_ATLAS.coast.l;
    if (e) return WATER_ATLAS.coast.r;

    return WATER_ATLAS.coast.c;
  }

  function drawAtlasTile(ctx, img, source, sx, sy) {
    ctx.drawImage(
      img,
      source[0], source[1], TILE, TILE,
      sx, sy, DRAW, DRAW
    );
  }

  const previousDrawGroundTile = NS.World.prototype.drawGroundTile;
  const previousChunk = NS.World.prototype.chunk;

  NS.World.prototype.drawGroundTile = function (ctx, habitat, sx, sy, wx, wy) {
    if (habitat !== 'water') {
      return previousDrawGroundTile.call(this, ctx, habitat, sx, sy, wx, wy);
    }

    if (!this.tilesImg || !this.tilesImg.complete || this.tilesImg.naturalWidth <= 0) {
      return previousDrawGroundTile.call(this, ctx, habitat, sx, sy, wx, wy);
    }

    const tx = Math.floor(wx / DRAW);
    const ty = Math.floor(wy / DRAW);

    const source =
      lagoonTile(this, tx, ty) ||
      coastTile(this, tx, ty);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    drawAtlasTile(ctx, this.tilesImg, source, sx, sy);
    ctx.restore();
  };

  /*
    Devuelve true si un círculo del jugador toca agua.

    Se muestrean centro + ocho puntos alrededor del radio para evitar que el
    personaje pueda "recortar" por una esquina de la laguna.
  */
  NS.World.prototype.isBlockedWaterAt = function (x, y, radius = 14) {
    const sampleRadius = Math.max(6, radius * .72);

    const samples = [
      [0, 0],
      [ sampleRadius, 0],
      [-sampleRadius, 0],
      [0,  sampleRadius],
      [0, -sampleRadius],
      [ sampleRadius * .72,  sampleRadius * .72],
      [-sampleRadius * .72,  sampleRadius * .72],
      [ sampleRadius * .72, -sampleRadius * .72],
      [-sampleRadius * .72, -sampleRadius * .72]
    ];

    return samples.some(([dx, dy]) => lagoonAtPoint(this, x + dx, y + dy));
  };

  /*
    Ajusta los objetos del chunk.

    - Los torbellinos existentes que quedaron sobre arena se recolocan
      determinísticamente dentro de una laguna.
    - Las palmeras continúan colocándose solo sobre arena.
    */
  NS.World.prototype.chunk = function (cx, cy) {
    const objects = previousChunk.call(this, cx, cy);
    const biome = this.biomeForChunk(cx, cy);

    if (biome === 'meadow') {
      for (const o of objects) {
        if (o.type !== 'tree') continue;

        const roll = hash2(
          Math.round(o.x / 16),
          Math.round(o.y / 16),
          1210 + (o.variant || 0)
        );

        if (roll < 0.72) {
          o.type = 'bush';
          o.solid = false;
          o.radius = 18;
          o.special = false;
        } else {
          o.type = 'rock';
          o.solid = true;
          o.radius = 14;
          o.special = false;
          o.smallRock = true;
        }
      }
    }

    if (biome === 'water') {
      const size = this.cfg.chunkSize;

      // 1) Recolocar torbellinos sobre agua real.
      const spots = objects.filter(o => o.type === 'waterSpot');

      for (let i = 0; i < spots.length; i++) {
        const spot = spots[i];

        if (lagoonAtPoint(this, spot.x, spot.y)) continue;

        let found = false;

        for (let attempt = 0; attempt < 40; attempt++) {
          const rx = hash2(cx * 131 + i * 17 + attempt, cy * 73 - i, 1301);
          const ry = hash2(cx * 79 - i, cy * 137 + i * 11 + attempt, 1302);

          const x = cx * size + 35 + rx * (size - 70);
          const y = cy * size + 35 + ry * (size - 70);

          if (!lagoonAtPoint(this, x, y)) continue;

          spot.x = x;
          spot.y = y;
          found = true;
          break;
        }

        // Si este chunk concreto no contiene ninguna laguna útil,
        // ocultamos el torbellino en lugar de dejarlo sobre arena.
        if (!found) {
          spot.used = true;
          spot.hiddenWaterSpot = true;
        }
      }

      // 2) Palmeras únicamente sobre arena.
      if (!objects.some(o => o.generatedPalm)) {
        const palmCount = 2 + Math.floor(hash2(cx, cy, 1220) * 4);

        for (let i = 0; i < palmCount; i++) {
          for (let attempt = 0; attempt < 12; attempt++) {
            const rx = hash2(cx * 97 + i * 13 + attempt, cy * 61 - i, 1221);
            const ry = hash2(cx * 53 - i, cy * 89 + i * 17 + attempt, 1222);

            const x = cx * size + 55 + rx * (size - 110);
            const y = cy * size + 55 + ry * (size - 110);

            if (lagoonAtPoint(this, x, y)) continue;

            objects.push({
              x,
              y,
              type: 'tree',
              solid: true,
              biome: 'water',
              special: false,
              used: false,
              radius: 24,
              variant: i % 2,
              generatedPalm: true
            });

            break;
          }
        }
      }
    }

    return objects;
  };

  NS.WaterBiome = {
    lagoonAtTile: (world, tx, ty) => lagoonAtTile(world, tx, ty),
    lagoonAtPoint: (world, x, y) => lagoonAtPoint(world, x, y),
    atlas: WATER_ATLAS
  };

  console.info("[Pokémon Safari] Lagunas bloqueadas, torbellinos acuáticos y transición costera activados.");
})();
