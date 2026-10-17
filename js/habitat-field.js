(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  const REGION_TILES = 52;
  const TRANSITION_TILES = 8;
  const START_MEADOW_RADIUS = 11;

  function clamp(v,a,b) {
    return Math.max(a,Math.min(b,v));
  }

  function hash2(x,y,seed=1337) {
    let h = Math.imul((x|0) ^ seed, 374761393) + Math.imul((y|0), 668265263);
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function valueNoise(x,y,seed) {
    const xi=Math.floor(x), yi=Math.floor(y);
    const xf=x-xi, yf=y-yi;
    const sx=xf*xf*(3-2*xf);
    const sy=yf*yf*(3-2*yf);

    const a=hash2(xi,yi,seed);
    const b=hash2(xi+1,yi,seed);
    const c=hash2(xi,yi+1,seed);
    const d=hash2(xi+1,yi+1,seed);

    const ab=a+(b-a)*sx;
    const cd=c+(d-c)*sx;
    return ab+(cd-ab)*sy;
  }

  function fbm(x,y,seed) {
    return (
      valueNoise(x,y,seed)*0.56 +
      valueNoise(x*2.07+17.3,y*2.07-11.9,seed+1)*0.29 +
      valueNoise(x*4.11-5.7,y*4.11+8.2,seed+2)*0.15
    );
  }

  function unlockedHabitats(licenseLevel) {
    const order=NS.HABITAT_ORDER || NS.TERRAIN_ORDER;
    return order.filter(id => {
      const h=NS.HABITATS?.[id];
      return !h || (h.minLicense||0) <= (licenseLevel|0);
    });
  }

  function weightedHabitat(cellX,cellY,licenseLevel) {
    /*
      Cada macrocelda tiene una semilla/hábitat, pero las fronteras no siguen
      la cuadrícula: los centros se desplazan y la consulta se deforma con ruido.
    */
    if (cellX===0 && cellY===0) return 'meadow';

    const unlocked=unlockedHabitats(licenseLevel);
    const weights={
      meadow:30,
      forest:28,
      water:15,
      mountain:11,
      volcano:9,
      special:6
    };

    let total=0;
    for(const id of unlocked) total+=weights[id]||1;

    let r=hash2(cellX,cellY,4001)*total;

    for(const id of unlocked) {
      r-=weights[id]||1;
      if(r<=0) return id;
    }

    return unlocked[0] || 'meadow';
  }

  function site(cellX,cellY,licenseLevel) {
    const jitterX=.18+hash2(cellX,cellY,4101)*.64;
    const jitterY=.18+hash2(cellX,cellY,4102)*.64;

    return {
      x:(cellX+jitterX)*REGION_TILES,
      y:(cellY+jitterY)*REGION_TILES,
      habitat:weightedHabitat(cellX,cellY,licenseLevel)
    };
  }

  const tileCache=new Map();
  const MAX_CACHE=50000;

  function sampleTile(tx,ty,licenseLevel=0) {
    const key=`${licenseLevel|0}:${tx|0},${ty|0}`;
    const cached=tileCache.get(key);
    if(cached) return cached;

    const distanceFromStart=Math.hypot(tx,ty);

    // Claro inicial estable y fácil de leer.
    if(distanceFromStart < START_MEADOW_RADIUS) {
      const forced={
        primary:'meadow',
        secondary:'meadow',
        transition:0,
        dominance:1,
        distance:0
      };
      tileCache.set(key,forced);
      return forced;
    }

    /*
      Domain warp: deforma el espacio antes de consultar el Voronoi.
      Así las regiones dejan de tener bordes rectos o rectangulares.
    */
    const warpX=(fbm(tx/72,ty/72,4201)-.5)*15;
    const warpY=(fbm(tx/72+31,ty/72-19,4207)-.5)*15;
    const x=tx+warpX;
    const y=ty+warpY;

    const baseX=Math.floor(x/REGION_TILES);
    const baseY=Math.floor(y/REGION_TILES);

    const bestByHabitat=new Map();

    for(let cy=baseY-2;cy<=baseY+2;cy++) {
      for(let cx=baseX-2;cx<=baseX+2;cx++) {
        const s=site(cx,cy,licenseLevel);
        const dx=x-s.x, dy=y-s.y;
        const dist=Math.hypot(dx,dy);
        const prev=bestByHabitat.get(s.habitat);

        if(prev==null || dist<prev) {
          bestByHabitat.set(s.habitat,dist);
        }
      }
    }

    const ranked=[...bestByHabitat.entries()]
      .sort((a,b)=>a[1]-b[1]);

    const primary=ranked[0]?.[0] || 'meadow';
    const d1=ranked[0]?.[1] ?? 0;
    const secondary=ranked[1]?.[0] || primary;
    const d2=ranked[1]?.[1] ?? d1+REGION_TILES;

    /*
      transition:
        0 = interior de un hábitat
        1 = frontera con el segundo hábitat

      No se usa como un degradado borroso. terrain-renderer lo transforma en
      dithering pixelado.
    */
    const difference=Math.max(0,d2-d1);
    const transition=clamp(1-difference/TRANSITION_TILES,0,1);

    const result={
      primary,
      secondary,
      transition,
      dominance:1-transition,
      distance:d1
    };

    if(tileCache.size>MAX_CACHE) {
      const first=tileCache.keys().next().value;
      tileCache.delete(first);
    }

    tileCache.set(key,result);
    return result;
  }

  function clearCache() {
    tileCache.clear();
  }

  NS.HabitatField={
    REGION_TILES,
    TRANSITION_TILES,
    START_MEADOW_RADIUS,
    hash2,
    valueNoise,
    fbm,
    sampleTile,
    unlockedHabitats,
    clearCache
  };

  console.info('[Pokémon Safari] Campo orgánico de hábitats activado.');
})();
