(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if (!NS.World) {
    console.error("[Pokémon Safari] grid-objects.js: World no existe.");
    return;
  }

  const GRID = 32;
  const previousChunk = NS.World.prototype.chunk;

  function tileKey(x,y) {
    return `${Math.floor(x/GRID)},${Math.floor(y/GRID)}`;
  }

  function snap(value) {
    return Math.floor(value / GRID) * GRID + GRID / 2;
  }

  function centerOfTile(tx,ty) {
    return {
      x:tx*GRID+GRID/2,
      y:ty*GRID+GRID/2
    };
  }

  function candidateOffsets(maxRing=4) {
    const result=[[0,0]];

    for (let ring=1; ring<=maxRing; ring++) {
      for (let dx=-ring; dx<=ring; dx++) {
        result.push([dx,-ring]);
        result.push([dx, ring]);
      }

      for (let dy=-ring+1; dy<=ring-1; dy++) {
        result.push([-ring,dy]);
        result.push([ring,dy]);
      }
    }

    return result;
  }

  const OFFSETS=candidateOffsets(5);

  function priority(object) {
    if (object.type === 'tree') return 100;
    if (object.type === 'rock') return 90;
    if (object.type === 'bush') return 70;
    if (object.type === 'baitPickup') return 40;
    if (object.type === 'stonePickup') return 30;
    return 10;
  }

  function canUseTile(world,object,x,y) {
    const expectedBiome = object.biome || world.habitatAt(object.x,object.y);

    if (world.habitatAt(x,y) !== expectedBiome) {
      return false;
    }

    // Palmeras/objetos de costa no deben caer dentro de una laguna.
    if (
      expectedBiome === 'water' &&
      object.type !== 'waterSpot' &&
      NS.WaterBiome?.lagoonAtPoint?.(world,x,y)
    ) {
      return false;
    }

    return true;
  }

  NS.World.prototype.chunk = function (cx,cy) {
    const objects=previousChunk.call(this,cx,cy);

    /*
      Los torbellinos no forman parte del grid normal.
      Los demás objetos sí, y cada tile puede alojar como máximo un objeto.
    */
    const movable=objects
      .filter(o => o.type !== 'waterSpot')
      .sort((a,b) => priority(b)-priority(a));

    const occupied=new Set();

    for (const object of movable) {
      if (object.gridPlacedV2) {
        occupied.add(tileKey(object.x,object.y));
        continue;
      }

      const snappedX=snap(object.x);
      const snappedY=snap(object.y);

      const baseTx=Math.floor(snappedX/GRID);
      const baseTy=Math.floor(snappedY/GRID);

      let placed=false;

      for (const [dx,dy] of OFFSETS) {
        const tile=centerOfTile(baseTx+dx,baseTy+dy);
        const key=tileKey(tile.x,tile.y);

        if (occupied.has(key)) continue;
        if (!canUseTile(this,object,tile.x,tile.y)) continue;

        object.x=tile.x;
        object.y=tile.y;
        occupied.add(key);
        placed=true;
        break;
      }

      /*
        Si excepcionalmente no hay hueco libre, ocultamos primero recursos
        secundarios en vez de superponerlos sobre un árbol o roca.
      */
      if (!placed) {
        if (
          object.type === 'stonePickup' ||
          object.type === 'baitPickup' ||
          object.type === 'bush'
        ) {
          object.used=true;
          object.hiddenByPlacement=true;
        } else {
          object.x=snappedX;
          object.y=snappedY;
          occupied.add(tileKey(object.x,object.y));
        }
      }

      object.gridPlacedV2=true;
    }

    return objects;
  };

  console.info("[Pokémon Safari] Colocación sin superposición activada.");
})();
