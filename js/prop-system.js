(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  const WORLD_CACHE = new WeakMap();
  const MARGIN_OFFSETS = {
    1: [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],
    2: []
  };

  for(let oy=-2;oy<=2;oy++) {
    for(let ox=-2;ox<=2;ox++) {
      if(Math.hypot(ox,oy)<=2.35) MARGIN_OFFSETS[2].push([ox,oy]);
    }
  }

  function cacheFor(world) {
    let c=WORLD_CACHE.get(world);
    const license=world.licenseLevel|0;
    if(!c || c.license!==license) {
      c={
        license,
        margin:new Map(),
        density:new Map(),
        solid:new Map()
      };
      WORLD_CACHE.set(world,c);
    }
    return c;
  }

  function trimMap(map,max=60000) {
    if(map.size<=max) return;
    const remove=Math.ceil(max*.15);
    let n=0;
    for(const key of map.keys()) {
      map.delete(key);
      if(++n>=remove) break;
    }
  }

  function weightedPick(list,r) {
    if(!list?.length) return null;
    let total=0;
    for(const item of list) total+=item.weight||1;
    let value=r*total;
    for(const item of list) {
      value-=item.weight||1;
      if(value<=0) return item;
    }
    return list[list.length-1];
  }

  function sameHabitatMargin(world,tx,ty,habitat,radius) {
    const cache=cacheFor(world).margin;
    const key=`${radius}:${habitat}:${tx},${ty}`;
    if(cache.has(key)) return cache.get(key);

    const offsets=MARGIN_OFFSETS[radius] || [[0,0]];
    let ok=true;
    for(const [ox,oy] of offsets) {
      if(world.habitatSampleAtTile(tx+ox,ty+oy).primary!==habitat) {
        ok=false;
        break;
      }
    }

    cache.set(key,ok);
    trimMap(cache,70000);
    return ok;
  }

  function densityAt(tx,ty,habitat,world=null) {
    const HF=NS.HabitatField;
    const seed={meadow:7001,forest:7011,water:7021,mountain:7031,volcano:7041,special:7051}[habitat]||7091;

    if(world) {
      const cache=cacheFor(world).density;
      const key=`${habitat}:${tx},${ty}`;
      if(cache.has(key)) return cache.get(key);
      const value=HF.fbm(tx/11.5,ty/11.5,seed)*.68 + HF.fbm(tx/5.8+17,ty/5.8-13,seed+1)*.32;
      cache.set(key,value);
      trimMap(cache,60000);
      return value;
    }

    return HF.fbm(tx/11.5,ty/11.5,seed)*.68 + HF.fbm(tx/5.8+17,ty/5.8-13,seed+1)*.32;
  }

  function isNaturalClearance(tx,ty,habitat,theme,world=null) {
    const HF=NS.HabitatField;
    const density=densityAt(tx,ty,habitat,world);
    if(density<theme.clusterThreshold) return true;

    const corridor=Math.abs(HF.fbm(tx/18+23,ty/18-7,7161)-.5);
    return corridor<.045;
  }

  function macroAnchor(tx,ty,size,seed) {
    const HF=NS.HabitatField;
    const mx=Math.floor(tx/size);
    const my=Math.floor(ty/size);
    const lx=((tx%size)+size)%size;
    const ly=((ty%size)+size)%size;
    const chosen=Math.floor(HF.hash2(mx,my,seed)*size*size);
    return chosen===ly*size+lx;
  }

  function solidCandidate(world,tx,ty,habitat,theme) {
    const cache=cacheFor(world).solid;
    const key=`${habitat}:${tx},${ty}`;
    if(cache.has(key)) return cache.get(key);

    const HF=NS.HabitatField;
    let result=null;

    if(world.terrainAtTile(tx,ty)==='floor' &&
       sameHabitatMargin(world,tx,ty,habitat,2) &&
       !isNaturalClearance(tx,ty,habitat,theme,world) &&
       macroAnchor(tx,ty,theme.solidMacro,7201+(NS.TERRAIN_ORDER?.indexOf(habitat)||0)*31)) {

      const mx=Math.floor(tx/theme.solidMacro);
      const my=Math.floor(ty/theme.solidMacro);
      const chance=HF.hash2(mx,my,7211+(NS.TERRAIN_ORDER?.indexOf(habitat)||0)*37);
      if(chance<=theme.solidChance) {
        result=weightedPick(theme.solids,HF.hash2(tx,ty,7221));
      }
    }

    cache.set(key,result);
    trimMap(cache,60000);
    return result;
  }

  function neighboringSolid(world,tx,ty,habitat,theme) {
    for(let oy=-1;oy<=1;oy++) {
      for(let ox=-1;ox<=1;ox++) {
        if(ox===0&&oy===0) continue;
        if(solidCandidate(world,tx+ox,ty+oy,habitat,theme)) return true;
      }
    }
    return false;
  }

  function makeObject(world,tx,ty,habitat,item,variant) {
    const meta=NS.PROP_VISUAL_META[item.visual] || {};
    const type=item.type;
    const solid=!!item.solid || type==='tree'||type==='rock';
    const special=(
      type==='tree' && ['forest','water','special'].includes(habitat)
        ? NS.HabitatField.hash2(tx,ty,7301)>.92
        : type==='rock' && ['mountain','volcano','special'].includes(habitat)
          ? NS.HabitatField.hash2(tx,ty,7302)>.925
          : false
    );

    return {
      x:tx*32+16,
      y:ty*32+16,
      type,
      visualType:item.visual,
      biome:habitat,
      solid,
      special,
      used:false,
      radius:solid?(meta.collisionRadius||12):14,
      collisionRadius:solid?(meta.collisionRadius||12):0,
      collisionShape:solid?(meta.collisionShape||'circle'):null,
      collisionHalfW:solid?(meta.collisionHalfW||0):0,
      collisionHalfH:solid?(meta.collisionHalfH||0):0,
      renderLayer:meta.renderLayer||'depth',
      variant,
      markerOffset:meta.markerOffset||36
    };
  }

  function resourceObject(tx,ty,habitat) {
    const HF=NS.HabitatField;
    const r=HF.hash2(tx,ty,7390);

    if(r<.0045) {
      return {
        x:tx*32+16,y:ty*32+16,
        type:'stonePickup',visualType:'stonePickup',
        solid:false,biome:habitat,special:false,used:false,
        radius:11,collisionRadius:0,renderLayer:'depth',variant:Math.floor(HF.hash2(tx,ty,7391)*3)
      };
    }

    if(r>.99935) {
      return {
        x:tx*32+16,y:ty*32+16,
        type:'baitPickup',visualType:'baitPickup',
        solid:false,biome:habitat,special:false,used:false,
        radius:11,collisionRadius:0,renderLayer:'depth',variant:0
      };
    }

    return null;
  }

  function objectForTile(world,tx,ty) {
    const HF=NS.HabitatField;
    if(Math.hypot(tx,ty)<7) return null;

    const habitat=world.habitatSampleAtTile(tx,ty).primary;
    const terrain=world.terrainAtTile(tx,ty);
    const theme=NS.PROP_BIOMES[habitat];
    if(!theme) return null;

    if(terrain==='lava') return null;

    if(terrain==='liquid') {
      if(habitat==='water' && HF.hash2(tx,ty,7401)<.014) {
        return {
          x:tx*32+16,y:ty*32+16,
          type:'waterSpot',visualType:'waterSpot',
          solid:false,biome:'water',special:true,used:false,
          radius:26,collisionRadius:0,renderLayer:'depth',
          variant:Math.floor(HF.hash2(tx,ty,7402)*3),markerOffset:32
        };
      }
      return null;
    }

    const interior2=sameHabitatMargin(world,tx,ty,habitat,2);
    const interior1=interior2 || sameHabitatMargin(world,tx,ty,habitat,1);

    if(interior2) {
      const solid=solidCandidate(world,tx,ty,habitat,theme);
      if(solid) return makeObject(world,tx,ty,habitat,solid,Math.floor(HF.hash2(tx,ty,7410)*64));
    }

    if(interior1 && !neighboringSolid(world,tx,ty,habitat,theme)) {
      const density=densityAt(tx,ty,habitat,world);
      const decorRoll=HF.hash2(tx,ty,7420);
      const effectiveChance=theme.decorChance*Math.max(.35,Math.min(1.15,density+.25));

      if(decorRoll<effectiveChance) {
        const decor=weightedPick(theme.decor,HF.hash2(tx,ty,7421));
        if(decor) return makeObject(world,tx,ty,habitat,decor,Math.floor(HF.hash2(tx,ty,7422)*64));
      }
    }

    return resourceObject(tx,ty,habitat);
  }

  function clearWorldCache(world) {
    if(world) WORLD_CACHE.delete(world);
  }

  NS.PropSystem={
    objectForTile,
    sameHabitatMargin,
    densityAt,
    isNaturalClearance,
    clearWorldCache
  };

  console.info('[Pokémon Safari] Distribución procedural de props V2.6 optimizada con cachés.');
})();
