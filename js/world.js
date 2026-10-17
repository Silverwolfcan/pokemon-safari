(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  const TILE=NS.TerrainRenderer.WORLD_TILE;
  const GROUND_CHUNK=NS.TerrainRenderer.WORLD_CHUNK;

  function clamp(v,a,b) {
    return Math.max(a,Math.min(b,v));
  }


  const WATER_LAGOON_CELL = 15;
  const LAVA_POOL_CELL = 12;

  function waterLagoonField(tx,ty) {
    const HF=NS.HabitatField;

    const warpX=(HF.fbm(tx/9.0,ty/9.0,6111)-.5)*1.8;
    const warpY=(HF.fbm(tx/9.0+17.0,ty/9.0-13.0,6112)-.5)*1.8;
    const x=tx+warpX;
    const y=ty+warpY;

    const baseX=Math.floor(x/WATER_LAGOON_CELL);
    const baseY=Math.floor(y/WATER_LAGOON_CELL);

    let best=-999;

    for(let cy=baseY-1;cy<=baseY+1;cy++) {
      for(let cx=baseX-1;cx<=baseX+1;cx++) {
        const jx=(0.18+HF.hash2(cx,cy,6113)*0.64)*WATER_LAGOON_CELL;
        const jy=(0.18+HF.hash2(cx,cy,6114)*0.64)*WATER_LAGOON_CELL;
        const px=cx*WATER_LAGOON_CELL+jx;
        const py=cy*WATER_LAGOON_CELL+jy;

        const angle=HF.hash2(cx,cy,6115)*Math.PI*2;
        const ca=Math.cos(angle), sa=Math.sin(angle);

        const dx=x-px;
        const dy=y-py;
        const qx= dx*ca + dy*sa;
        const qy=-dx*sa + dy*ca;

        const rx=4.6+HF.hash2(cx,cy,6116)*2.7;
        const ry=3.8+HF.hash2(cx,cy,6117)*2.3;
        const ellipse=Math.sqrt((qx*qx)/(rx*rx)+(qy*qy)/(ry*ry));

        const lobe=(HF.fbm((x+cx*3)/10.5,(y-cy*2)/10.5,6118)-.5)*0.22;
        const score=(1-ellipse)+lobe;
        if(score>best) best=score;
      }
    }

    // Rompe uniones excesivas y preserva caminos de arena entre lagunas.
    const separators=(HF.fbm(tx/18.0+31.0,ty/18.0-17.0,6119)-.5)*0.18;
    return best-separators;
  }


  function lavaPoolField(tx,ty) {
    const HF=NS.HabitatField;

    /*
      Charcos deliberadamente pequeños y separados.
      Cada celda puede contener como máximo un charco y muchas celdas quedan
      vacías para que el volcán siga siendo principalmente terreno caminable.
    */
    const warpX=(HF.fbm(tx/7.5,ty/7.5,6121)-.5)*0.85;
    const warpY=(HF.fbm(tx/7.5+9.0,ty/7.5-7.0,6122)-.5)*0.85;
    const x=tx+warpX;
    const y=ty+warpY;

    const baseX=Math.floor(x/LAVA_POOL_CELL);
    const baseY=Math.floor(y/LAVA_POOL_CELL);
    let best=-999;

    for(let cy=baseY-1;cy<=baseY+1;cy++) {
      for(let cx=baseX-1;cx<=baseX+1;cx++) {
        // Solo ~36% de las celdas generan charco.
        if(HF.hash2(cx,cy,6123)>.36) continue;

        const jx=(0.28+HF.hash2(cx,cy,6124)*0.44)*LAVA_POOL_CELL;
        const jy=(0.28+HF.hash2(cx,cy,6125)*0.44)*LAVA_POOL_CELL;
        const px=cx*LAVA_POOL_CELL+jx;
        const py=cy*LAVA_POOL_CELL+jy;

        const angle=HF.hash2(cx,cy,6126)*Math.PI*2;
        const ca=Math.cos(angle), sa=Math.sin(angle);
        const dx=x-px, dy=y-py;
        const qx= dx*ca + dy*sa;
        const qy=-dx*sa + dy*ca;

        // Aproximadamente 3-6 tiles de diámetro, bastante menos que una laguna.
        const rx=1.75+HF.hash2(cx,cy,6127)*1.25;
        const ry=1.35+HF.hash2(cx,cy,6128)*0.95;
        const ellipse=Math.sqrt((qx*qx)/(rx*rx)+(qy*qy)/(ry*ry));
        const wobble=(HF.fbm((x+cx*2)/5.8,(y-cy*2)/5.8,6129)-.5)*0.16;
        const score=(1-ellipse)+wobble;

        if(score>best) best=score;
      }
    }

    return best;
  }


  function hasHabitatMargin(world,tx,ty,habitat,radius) {
    /*
      Reserva un cinturón limpio alrededor de los límites de cada hábitat.
      Agua/lava solo pueden aparecer si el tile está suficientemente dentro
      de su bioma, evitando charcas cortadas por la transición exterior.
    */
    for(let oy=-radius;oy<=radius;oy++) {
      for(let ox=-radius;ox<=radius;ox++) {
        // Forma casi circular para no ensanchar demasiado el margen diagonal.
        if(Math.hypot(ox,oy)>radius+.35) continue;
        if(world.habitatSampleAtTile(tx+ox,ty+oy).primary!==habitat) {
          return false;
        }
      }
    }

    return true;
  }

  class World {
    constructor(config,licenseLevel=0) {
      this.cfg=config;
      this.licenseLevel=licenseLevel|0;

      this.objectCache=new Map();
      this.groundCache=new Map();
      this.singleTileCache=new Map();
      this.terrainCache=new Map();

      // Precarga de chunks durante tiempos muertos del navegador.
      this.groundPrewarmQueue=[];
      this.groundPrewarmSet=new Set();
      this.groundPrewarmHandle=null;

      this.objectPrewarmQueue=[];
      this.objectPrewarmSet=new Set();
      this.objectPrewarmHandle=null;
    }

    setLicense(level) {
      level|=0;
      if(level===this.licenseLevel) return;

      this.licenseLevel=level;
      this.objectCache.clear();
      this.groundCache.clear();
      this.singleTileCache.clear();
      this.terrainCache.clear();
      this.groundPrewarmQueue.length=0;
      this.groundPrewarmSet.clear();
      this.objectPrewarmQueue.length=0;
      this.objectPrewarmSet.clear();

      if(this.groundPrewarmHandle!=null) {
        if(typeof cancelIdleCallback==='function') cancelIdleCallback(this.groundPrewarmHandle);
        else clearTimeout(this.groundPrewarmHandle);
      }
      if(this.objectPrewarmHandle!=null) {
        if(typeof cancelIdleCallback==='function') cancelIdleCallback(this.objectPrewarmHandle);
        else clearTimeout(this.objectPrewarmHandle);
      }
      this.groundPrewarmHandle=null;
      this.objectPrewarmHandle=null;

      NS.PropSystem?.clearWorldCache?.(this);
      NS.HabitatField.clearCache();
    }

    habitatSampleAtTile(tx,ty) {
      return NS.HabitatField.sampleTile(
        tx,
        ty,
        this.licenseLevel
      );
    }

    habitatAt(x,y) {
      return this.habitatSampleAtTile(
        Math.floor(x/TILE),
        Math.floor(y/TILE)
      ).primary;
    }

    /*
      Compatibilidad con scripts que todavía consultan el bioma del chunk.
      El nuevo mundo ya NO está dividido por chunks de bioma.
    */
    biomeForChunk(cx,cy) {
      const size=this.cfg.chunkSize;
      return this.habitatAt(
        cx*size+size/2,
        cy*size+size/2
      );
    }

    terrainAtTile(tx,ty) {
      const key=`${this.licenseLevel}:${tx|0},${ty|0}`;
      const cached=this.terrainCache.get(key);
      if(cached) return cached;

      const sample=this.habitatSampleAtTile(tx,ty);
      let terrain='floor';

      if(sample.primary==='water') {
        /*
          Costa / Humedal:
          las lagunas necesitan un cinturón de arena antes de llegar a la
          frontera del hábitat. De esta forma nunca quedan partidas por una
          transición Pradera/Bosque/etc.
        */
        if(hasHabitatMargin(this,tx,ty,'water',3)) {
          const lagoon=waterLagoonField(tx,ty);
          const interiorBias=sample.dominance*0.12;
          const shapeNoise=(NS.HabitatField.fbm(tx/7.5,ty/7.5,6101)-.5)*.08;
          const score=lagoon+interiorBias+shapeNoise;

          if(score>.10) terrain='liquid';
        }
      } else if(sample.primary==='volcano') {
        /*
          Volcán:
          los charcos de lava también respetan un margen interior, aunque
          algo menor porque son mucho más pequeños que las lagunas de agua.
        */
        if(hasHabitatMargin(this,tx,ty,'volcano',2)) {
          const lava=lavaPoolField(tx,ty);
          if(lava>.08) terrain='lava';
        }
      }

      if(this.terrainCache.size>50000) {
        const first=this.terrainCache.keys().next().value;
        this.terrainCache.delete(first);
      }

      this.terrainCache.set(key,terrain);
      return terrain;
    }

    terrainAtPoint(x,y) {
      return this.terrainAtTile(
        Math.floor(x/TILE),
        Math.floor(y/TILE)
      );
    }

    isLiquidAtPoint(x,y) {
      return this.terrainAtPoint(x,y)==='liquid';
    }


    isLavaAtPoint(x,y) {
      return this.terrainAtPoint(x,y)==='lava';
    }

    isBlockedPlayerTerrainAtPoint(x,y) {
      const terrain=this.terrainAtPoint(x,y);
      return terrain==='liquid' || terrain==='lava';
    }

    circleTouchesBlockedPlayerTerrain(x,y,radius) {
      /*
        Colisión círculo-vs-tile exacta para agua y lava.
        Se usa únicamente con el jugador; los Pokémon acuáticos pueden seguir
        apareciendo y moviéndose dentro de las lagunas.
      */
      const minTx=Math.floor((x-radius)/TILE);
      const maxTx=Math.floor((x+radius)/TILE);
      const minTy=Math.floor((y-radius)/TILE);
      const maxTy=Math.floor((y+radius)/TILE);
      const r2=radius*radius;

      for(let ty=minTy;ty<=maxTy;ty++) {
        for(let tx=minTx;tx<=maxTx;tx++) {
          const terrain=this.terrainAtTile(tx,ty);
          if(terrain!=='liquid' && terrain!=='lava') continue;

          const left=tx*TILE;
          const top=ty*TILE;
          const right=left+TILE;
          const bottom=top+TILE;

          const nearestX=clamp(x,left,right);
          const nearestY=clamp(y,top,bottom);
          const dx=x-nearestX;
          const dy=y-nearestY;

          if(dx*dx+dy*dy<r2) return true;
        }
      }

      return false;
    }

    movementMultiplierAt(x,y,swimLevel=0) {
      if(!this.isLiquidAtPoint(x,y)) return 1;

      const base=this.cfg.waterSpeedMultiplier||.45;
      const per=this.cfg.waterSpeedPerUpgrade||.11;

      return Math.min(
        1,
        base+Math.max(0,swimLevel|0)*per
      );
    }

    pokemonMovementMultiplierAt(species,x,y) {
      const habitat=this.habitatAt(x,y);

      if(species?.habitats?.includes(habitat)) {
        return 1;
      }

      return this.cfg.offHabitatSpeedMultiplier||.62;
    }

    /*
      Los props se distribuyen mediante PropSystem. Mantener la lógica fuera de
      World evita volver a convertir world.js en una cadena de reglas por bioma.
    */
    objectForTile(tx,ty) {
      return NS.PropSystem?.objectForTile(this,tx,ty) || null;
    }

    chunk(cx,cy) {
      const key=`${this.licenseLevel}:${cx},${cy}`;
      const cached=this.objectCache.get(key);
      if(cached) return cached;

      const size=this.cfg.chunkSize;
      const minX=cx*size;
      const minY=cy*size;
      const maxX=minX+size;
      const maxY=minY+size;

      /*
        Solo el chunk que contiene el CENTRO del tile es dueño de ese objeto.
        Así tampoco hay duplicados en los bordes.
      */
      const minTx=Math.ceil((minX-TILE/2)/TILE);
      const maxTx=Math.ceil((maxX-TILE/2)/TILE)-1;
      const minTy=Math.ceil((minY-TILE/2)/TILE);
      const maxTy=Math.ceil((maxY-TILE/2)/TILE)-1;

      const objects=[];

      for(let ty=minTy;ty<=maxTy;ty++) {
        for(let tx=minTx;tx<=maxTx;tx++) {
          const object=this.objectForTile(tx,ty);
          if(object) objects.push(object);
        }
      }

      if(this.objectCache.size>260) {
        const first=this.objectCache.keys().next().value;
        this.objectCache.delete(first);
      }

      this.objectCache.set(key,objects);
      this.objectPrewarmSet.delete(key);
      return objects;
    }

    queueObjectPrewarm(cx,cy) {
      const key=`${this.licenseLevel}:${cx},${cy}`;
      if(this.objectCache.has(key)||this.objectPrewarmSet.has(key)) return;
      this.objectPrewarmSet.add(key);
      this.objectPrewarmQueue.push({cx,cy,key});
    }

    runObjectPrewarm(deadline=null) {
      this.objectPrewarmHandle=null;

      if(deadline && !deadline.didTimeout && typeof deadline.timeRemaining==='function' && deadline.timeRemaining()<5) {
        this.scheduleObjectPrewarmWorker();
        return;
      }

      const next=this.objectPrewarmQueue.shift();
      if(next) {
        if(!this.objectCache.has(next.key)) this.chunk(next.cx,next.cy);
        else this.objectPrewarmSet.delete(next.key);
      }

      if(this.objectPrewarmQueue.length) this.scheduleObjectPrewarmWorker();
    }

    scheduleObjectPrewarmWorker() {
      if(this.objectPrewarmHandle!=null) return;
      if(typeof requestIdleCallback==='function') {
        this.objectPrewarmHandle=requestIdleCallback(deadline=>this.runObjectPrewarm(deadline));
      } else {
        this.objectPrewarmHandle=setTimeout(()=>this.runObjectPrewarm(null),16);
      }
    }

    prewarmObjectsAround(camera,w,h) {
      const size=this.cfg.chunkSize;
      const pad=520;
      const minCx=Math.floor((camera.x-w/2-pad)/size)-1;
      const maxCx=Math.floor((camera.x+w/2+pad)/size)+1;
      const minCy=Math.floor((camera.y-h/2-pad)/size)-1;
      const maxCy=Math.floor((camera.y+h/2+pad)/size)+1;
      const ccx=Math.floor(camera.x/size);
      const ccy=Math.floor(camera.y/size);
      const pending=[];

      for(let cy=minCy;cy<=maxCy;cy++) {
        for(let cx=minCx;cx<=maxCx;cx++) {
          const key=`${this.licenseLevel}:${cx},${cy}`;
          if(this.objectCache.has(key)||this.objectPrewarmSet.has(key)) continue;
          pending.push({cx,cy,d:Math.abs(cx-ccx)+Math.abs(cy-ccy)});
        }
      }

      pending.sort((a,b)=>a.d-b.d);
      for(const p of pending) this.queueObjectPrewarm(p.cx,p.cy);
      if(this.objectPrewarmQueue.length) this.scheduleObjectPrewarmWorker();
    }

    obstaclesAround(x,y,radius=120) {
      const size=this.cfg.chunkSize;

      const minX=Math.floor((x-radius)/size);
      const maxX=Math.floor((x+radius)/size);
      const minY=Math.floor((y-radius)/size);
      const maxY=Math.floor((y+radius)/size);

      const result=[];

      for(let cy=minY;cy<=maxY;cy++) {
        for(let cx=minX;cx<=maxX;cx++) {
          result.push(...this.chunk(cx,cy));
        }
      }

      return result;
    }

    visibleObjects(camera,w,h) {
      /*
        V2.7 rendimiento: consulta rectangular exacta de chunks visibles.
        Antes obstaclesAround() usaba el radio de la diagonal de pantalla y
        terminaba generando chunks que estaban muy lejos de las esquinas reales
        del viewport.
      */
      const pad=88;
      const size=this.cfg.chunkSize;
      const minCx=Math.floor((camera.x-w/2-pad)/size);
      const maxCx=Math.floor((camera.x+w/2+pad)/size);
      const minCy=Math.floor((camera.y-h/2-pad)/size);
      const maxCy=Math.floor((camera.y+h/2+pad)/size);
      const result=[];

      for(let cy=minCy;cy<=maxCy;cy++) {
        for(let cx=minCx;cx<=maxCx;cx++) {
          for(const o of this.chunk(cx,cy)) {
            if(
              Math.abs(o.x-camera.x)<w/2+pad &&
              Math.abs(o.y-camera.y)<h/2+pad
            ) result.push(o);
          }
        }
      }

      return result;
    }

    collectLooseResources(x,y,radius=30) {
      let stones=0;
      let bait=0;

      for(const object of this.obstaclesAround(x,y,radius+30)) {
        if(
          object.used ||
          !['stonePickup','baitPickup'].includes(object.type)
        ) {
          continue;
        }

        if(
          Math.hypot(x-object.x,y-object.y) <=
          radius+object.radius
        ) {
          object.used=true;

          if(object.type==='stonePickup') stones++;
          else bait++;
        }
      }

      return {stones,bait};
    }

    resolveCircle(x,y,radius) {
      let px=x;
      let py=y;

      for(const object of this.obstaclesAround(px,py,radius+70)) {
        if(!object.solid) continue;

        if(object.collisionShape==='box') {
          const halfW=object.collisionHalfW||14;
          const halfH=object.collisionHalfH||7;

          // AABB expandido por el radio del jugador. Funciona especialmente
          // bien para troncos horizontales sin crear una colisión circular enorme.
          const left=object.x-halfW-radius;
          const right=object.x+halfW+radius;
          const top=object.y-halfH-radius;
          const bottom=object.y+halfH+radius;

          if(px>left && px<right && py>top && py<bottom) {
            const dl=px-left;
            const dr=right-px;
            const dt=py-top;
            const db=bottom-py;
            const min=Math.min(dl,dr,dt,db);

            if(min===dl) px=left;
            else if(min===dr) px=right;
            else if(min===dt) py=top;
            else py=bottom;
          }

          continue;
        }

        const obstacleRadius=
          object.collisionRadius ??
          object.radius;

        const dx=px-object.x;
        const dy=py-object.y;
        const distance=Math.hypot(dx,dy);
        const minimum=radius+obstacleRadius;

        if(distance<minimum) {
          const nx=distance>.001?dx/distance:1;
          const ny=distance>.001?dy/distance:0;

          px=object.x+nx*minimum;
          py=object.y+ny*minimum;
        }
      }

      return {x:px,y:py};
    }

    /*
      Busca un punto del mismo hábitat alrededor de una posición.
      region-gameplay.js lo usa para que los spawns no aparezcan en la región
      vecina al estar cerca de una frontera.
    */
    findHabitatPoint(x,y,habitat,options={}) {
      const liquidOnly=!!options.liquidOnly;
      const minRadius=options.minRadius??0;
      const maxRadius=options.maxRadius??160;

      const valid=(px,py)=>{
        if(this.habitatAt(px,py)!==habitat) return false;
        if(this.isLavaAtPoint(px,py)) return false;
        if(liquidOnly && !this.isLiquidAtPoint(px,py)) return false;

        const resolved=this.resolveCircle(px,py,20);

        if(this.habitatAt(resolved.x,resolved.y)!==habitat) return false;
        if(this.isLavaAtPoint(resolved.x,resolved.y)) return false;
        if(liquidOnly && !this.isLiquidAtPoint(resolved.x,resolved.y)) return false;

        return resolved;
      };

      const direct=valid(x,y);
      if(direct) return direct;

      for(let ring=minRadius||32;ring<=maxRadius;ring+=32) {
        for(let i=0;i<20;i++) {
          const a=(Math.PI*2*i)/20;
          const found=valid(
            x+Math.cos(a)*ring,
            y+Math.sin(a)*ring
          );
          if(found) return found;
        }
      }

      return null;
    }

    groundChunk(cx,cy) {
      const key=`${this.licenseLevel}:${cx},${cy}`;
      let canvas=this.groundCache.get(key);

      if(canvas) return canvas;

      canvas=NS.TerrainRenderer.paintChunk(this,cx,cy);

      if(this.groundCache.size>128) {
        const first=this.groundCache.keys().next().value;
        this.groundCache.delete(first);
      }

      this.groundCache.set(key,canvas);
      this.groundPrewarmSet.delete(key);
      return canvas;
    }

    queueGroundPrewarm(cx,cy) {
      const key=`${this.licenseLevel}:${cx},${cy}`;

      if(
        this.groundCache.has(key) ||
        this.groundPrewarmSet.has(key)
      ) {
        return;
      }

      this.groundPrewarmSet.add(key);
      this.groundPrewarmQueue.push({cx,cy,key});
    }

    runGroundPrewarm(deadline=null) {
      this.groundPrewarmHandle=null;

      // Un solo chunk por ventana idle evita picos largos de CPU.
      if(deadline && !deadline.didTimeout && typeof deadline.timeRemaining==='function' && deadline.timeRemaining()<6) {
        this.scheduleGroundPrewarmWorker();
        return;
      }

      const next=this.groundPrewarmQueue.shift();
      if(next) {
        if(!this.groundCache.has(next.key)) this.groundChunk(next.cx,next.cy);
        else this.groundPrewarmSet.delete(next.key);
      }

      if(this.groundPrewarmQueue.length) this.scheduleGroundPrewarmWorker();
    }

    scheduleGroundPrewarmWorker() {
      if(this.groundPrewarmHandle!=null) return;

      if(typeof requestIdleCallback==='function') {
        // Sin timeout forzado: nunca generamos terreno en mitad de un frame ocupado.
        this.groundPrewarmHandle=requestIdleCallback(deadline=>this.runGroundPrewarm(deadline));
      } else {
        this.groundPrewarmHandle=setTimeout(()=>this.runGroundPrewarm(null),16);
      }
    }

    prewarmGroundAround(camera,w,h) {
      const minCx=Math.floor((camera.x-w/2)/GROUND_CHUNK)-3;
      const maxCx=Math.floor((camera.x+w/2)/GROUND_CHUNK)+3;
      const minCy=Math.floor((camera.y-h/2)/GROUND_CHUNK)-3;
      const maxCy=Math.floor((camera.y+h/2)/GROUND_CHUNK)+3;

      const ccx=Math.floor(camera.x/GROUND_CHUNK);
      const ccy=Math.floor(camera.y/GROUND_CHUNK);
      const pending=[];

      for(let cy=minCy;cy<=maxCy;cy++) {
        for(let cx=minCx;cx<=maxCx;cx++) {
          const key=`${this.licenseLevel}:${cx},${cy}`;
          if(this.groundCache.has(key)||this.groundPrewarmSet.has(key)) continue;

          pending.push({
            cx,cy,
            d:Math.abs(cx-ccx)+Math.abs(cy-ccy)
          });
        }
      }

      pending.sort((a,b)=>a.d-b.d);
      for(const p of pending) this.queueGroundPrewarm(p.cx,p.cy);

      if(this.groundPrewarmQueue.length) {
        this.scheduleGroundPrewarmWorker();
      }
    }

    servicePrewarmFrame(maxJobs=1) {
      /*
        requestIdleCallback puede recibir muy pocas ventanas mientras el jugador
        mantiene movimiento continuo. Este pequeño servicio reparte la precarga
        en frames sucesivos: como máximo un trabajo por frame y siempre prioriza
        terreno, evitando que una nueva columna de chunks se genere toda de golpe.
      */
      let jobs=0;

      while(jobs<maxJobs) {
        const ground=this.groundPrewarmQueue.shift();
        if(ground) {
          if(!this.groundCache.has(ground.key)) this.groundChunk(ground.cx,ground.cy);
          else this.groundPrewarmSet.delete(ground.key);
          jobs++;
          continue;
        }

        const object=this.objectPrewarmQueue.shift();
        if(object) {
          if(!this.objectCache.has(object.key)) this.chunk(object.cx,object.cy);
          else this.objectPrewarmSet.delete(object.key);
          jobs++;
          continue;
        }

        break;
      }
    }

    drawGroundOnly(ctx,camera,w,h) {
      ctx.save();
      ctx.imageSmoothingEnabled=false;

      const camX=Math.floor(camera.x);
      const camY=Math.floor(camera.y);
      const minCx=Math.floor((camX-w/2)/GROUND_CHUNK)-1;
      const maxCx=Math.floor((camX+w/2)/GROUND_CHUNK)+1;
      const minCy=Math.floor((camY-h/2)/GROUND_CHUNK)-1;
      const maxCy=Math.floor((camY+h/2)/GROUND_CHUNK)+1;

      for(let cy=minCy;cy<=maxCy;cy++) {
        for(let cx=minCx;cx<=maxCx;cx++) {
          const image=this.groundChunk(cx,cy);

          const worldX=cx*GROUND_CHUNK;
          const worldY=cy*GROUND_CHUNK;

          const sx=Math.floor(worldX-camX+w/2);
          const sy=Math.floor(worldY-camY+h/2);

          /*
            +1 evita pequeñas juntas entre chunks si el navegador acaba
            situándolos en medio píxel.
          */
          ctx.drawImage(
            image,
            sx,
            sy,
            GROUND_CHUNK+1,
            GROUND_CHUNK+1
          );
        }
      }

      ctx.restore();

      // V2.7: la precarga ya no se recalcula en cada render. performance-tuning.js
      // la actualiza de forma predictiva y espaciada mientras el jugador se mueve.
    }

    /*
      Compatibilidad con APIs anteriores. El render principal ya no usa
      drawGroundTile() en cada frame.
    */
    drawGroundTile(ctx,habitat,sx,sy,wx,wy) {
      const tx=Math.floor(wx/TILE);
      const ty=Math.floor(wy/TILE);
      const key=`${this.licenseLevel}:${tx},${ty}`;

      let tile=this.singleTileCache.get(key);

      if(!tile) {
        tile=NS.TerrainRenderer.paintSingleTile(this,tx,ty);

        if(this.singleTileCache.size>256) {
          const first=this.singleTileCache.keys().next().value;
          this.singleTileCache.delete(first);
        }

        this.singleTileCache.set(key,tile);
      }

      ctx.save();
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(tile,sx,sy,TILE,TILE);
      ctx.restore();
    }

    draw(ctx,camera,w,h) {
      this.drawGroundOnly(ctx,camera,w,h);

      const objects=this.visibleObjects(camera,w,h)
        .sort((a,b)=>a.y-b.y);

      for(const object of objects) {
        this.drawObstacle(ctx,object,camera,w,h);
      }
    }

    drawObstacle(ctx,o,camera,w,h) {
      if(NS.PropRenderer?.drawObject(ctx,o,camera,w,h)) return;

      // Fallback mínimo para que un tipo nuevo no desaparezca si aún no tiene arte.
      const camX=Math.floor(camera.x);
      const camY=Math.floor(camera.y);
      const x=Math.floor(o.x-camX+w/2);
      const y=Math.floor(o.y-camY+h/2);
      ctx.save();
      ctx.imageSmoothingEnabled=false;
      ctx.fillStyle=o.solid?'#6f786f':'#4e8052';
      ctx.fillRect(x-10,y-16,20,16);
      ctx.restore();
    }
  }

  NS.World=World;

  console.info('[Pokémon Safari] Mundo procedural V2.7: precarga predictiva y consultas visibles optimizadas y cámara alineada a píxel.');
})();
