(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  function hash2(x,y,seed=1337) {
    let h = Math.imul(x ^ seed, 374761393) + Math.imul(y, 668265263);
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const PALETTES = {
    meadow:   ['#69a64a','#72ac50','#639b46','#83b95e'],
    forest:   ['#4f8e42','#568f44','#477f3c','#6aa254'],
    water:    ['#5a9eb4','#63a8bc','#4f91aa','#76b9c7'],
    mountain: ['#777b6d','#838778','#6c7064','#979a8a'],
    volcano:  ['#765343','#835a45','#65483d','#9b6848'],
    special:  ['#65597c','#71648a','#594f70','#88789d']
  };

  // Primera integración de Puny World: usamos la hoja base como tileset de
  // suelo con recolores por bioma. Los elementos grandes siguen teniendo una
  // representación propia/fallback para mantener la legibilidad y las hitboxes.
  const PUNY = {
    tile: 16,
    ground: {
      meadow:   [[0,0],[16,0],[32,0],[48,0],[64,0],[80,0]],
      forest:   [[0,0],[16,0],[32,0],[48,0],[64,0],[80,0]],
      water:    [[0,48],[16,48],[32,48],[48,48],[64,48],[80,48]],
      mountain: [[0,16],[16,16],[32,16],[48,16],[64,16],[80,16]],
      volcano:  [[0,16],[16,16],[32,16],[48,16],[64,16],[80,16]],
      special:  [[0,0],[16,0],[32,0],[48,0],[64,0],[80,0]]
    },
    overlay: {
      meadow:   'rgba(70,140,55,0.08)',
      forest:   'rgba(28,88,42,0.18)',
      water:    'rgba(48,122,163,0.22)',
      mountain: 'rgba(96,92,80,0.20)',
      volcano:  'rgba(125,58,35,0.30)',
      special:  'rgba(96,58,132,0.26)'
    }
  };

  class World {
    constructor(config, licenseLevel=0) {
      this.cfg = config;
      this.licenseLevel = licenseLevel|0;
      this.obstacleCache = new Map();
      this.tilesImg = new Image();
      this.tilesImg.crossOrigin='anonymous';
      this.tilesImg.src = NS.VISUAL_ASSETS.worldTiles.url;
    }

    setLicense(level) {
      if ((level|0) === this.licenseLevel) return;
      this.licenseLevel = level|0;
      this.obstacleCache.clear();
    }

    biomeForChunk(cx,cy) {
      const regionChunks=Math.max(1,this.cfg.biomeRegionChunks||4);
      const half=Math.floor(regionChunks/2);
      const rx=Math.floor((cx+half)/regionChunks);
      const ry=Math.floor((cy+half)/regionChunks);
      if (rx===0 && ry===0) return 'meadow';

      const unlocked = NS.HABITAT_ORDER.filter(id => NS.HABITATS[id].minLicense <= this.licenseLevel);
      const n = hash2(rx,ry,2027);
      const weights = {
        meadow: 31,
        forest: 28,
        water: this.licenseLevel>=1 ? 15 : 0,
        mountain: this.licenseLevel>=2 ? 11 : 0,
        volcano: this.licenseLevel>=3 ? 10 : 0,
        special: this.licenseLevel>=4 ? 6 : 0
      };
      let total = unlocked.reduce((a,id)=>a+(weights[id]||0),0);
      let r=n*total;
      for(const id of unlocked){
        r-=weights[id]||0;
        if(r<=0)return id;
      }
      return unlocked[0]||'meadow';
    }

    habitatAt(x,y) {
      const s=this.cfg.chunkSize;
      return this.biomeForChunk(Math.floor(x/s),Math.floor(y/s));
    }

    movementMultiplierAt(x,y,swimLevel=0) {
      const habitat=this.habitatAt(x,y);
      if(habitat==='water') {
        const base=this.cfg.waterSpeedMultiplier||0.45;
        const per=this.cfg.waterSpeedPerUpgrade||0.11;
        return Math.min(1,base+Math.max(0,swimLevel|0)*per);
      }
      return 1;
    }

    pokemonMovementMultiplierAt(species,x,y) {
      const habitat=this.habitatAt(x,y);
      if(species?.habitats?.includes(habitat)) return 1;
      return this.cfg.offHabitatSpeedMultiplier||0.62;
    }

    chunk(cx,cy) {
      const key = `${this.licenseLevel}:${cx},${cy}`;
      if (this.obstacleCache.has(key)) return this.obstacleCache.get(key);

      const size = this.cfg.chunkSize;
      const biome = this.biomeForChunk(cx,cy);
      const obs = [];

      let min=3,max=8;
      if(biome==='forest'){min=7;max=13;}
      if(biome==='water'){min=0;max=0;}
      if(biome==='mountain'){min=7;max=12;}
      if(biome==='volcano'){min=5;max=9;}
      if(biome==='special'){min=3;max=7;}

      const count=min+Math.floor(hash2(cx,cy,91)*(max-min+1));
      for(let i=0;i<count;i++) {
        const r1=hash2(cx*31+i,cy*17-i,7), r2=hash2(cx*13-i,cy*29+i,11), r3=hash2(cx*7+i,cy*37+i,19);
        const x=cx*size+50+r1*(size-100), y=cy*size+50+r2*(size-100);

        let type='bush';
        if(biome==='forest') type=r3>.36?'tree':'bush';
        else if(biome==='mountain') type=r3>.22?'rock':'bush';
        else if(biome==='volcano') type='rock';
        else if(biome==='water') type='bush';
        else if(biome==='special') type=r3>.55?'tree':r3>.22?'rock':'bush';
        else type=r3>.62?'tree':r3>.30?'rock':'bush';

        const solid=type!=='bush';
        const special = (type==='tree' && ['forest','meadow'].includes(biome) && hash2(cx*97+i,cy*61-i,301)>.72)
          || (type==='rock' && ['mountain','volcano'].includes(biome) && hash2(cx*71-i,cy*53+i,401)>.70);

        if(!(biome==='volcano' && type==='bush')){
          obs.push({
            x,y,type,solid,biome,special,used:false,
            radius:type==='tree'?28:type==='rock'?22:18,
            variant:Math.floor(r3*5)
          });
        }
      }

      if(biome==='water'){
        const spotCount=1+Math.floor(hash2(cx,cy,612)*2);
        for(let i=0;i<spotCount;i++){
          const rx=hash2(cx*67+i,cy*79-i,613), ry=hash2(cx*89-i,cy*71+i,614);
          obs.push({
            x:cx*size+70+rx*(size-140), y:cy*size+70+ry*(size-140),
            type:'waterSpot', solid:false, biome, special:true, used:false,
            radius:26, variant:i
          });
        }
      }

      if(biome!=='water'){
        const minLoose=this.cfg.looseStoneMinPerChunk||1;
        const maxLoose=this.cfg.looseStoneMaxPerChunk||3;
        const looseCount=minLoose+Math.floor(hash2(cx,cy,777)*(maxLoose-minLoose+1));
        for(let i=0;i<looseCount;i++){
          const rx=hash2(cx*43+i,cy*47-i,778), ry=hash2(cx*59-i,cy*31+i,779);
          obs.push({
            x:cx*size+42+rx*(size-84), y:cy*size+42+ry*(size-84),
            type:'stonePickup', solid:false, biome, special:false, used:false, radius:11, variant:i%3
          });
        }
        const baitChance=this.cfg.looseBaitChancePerChunk??0.22;
        if(hash2(cx,cy,881)<baitChance){
          const rx=hash2(cx*83+5,cy*89-3,882), ry=hash2(cx*97-7,cy*73+11,883);
          obs.push({
            x:cx*size+48+rx*(size-96), y:cy*size+48+ry*(size-96),
            type:'baitPickup', solid:false, biome, special:false, used:false, radius:11, variant:0
          });
        }
      }
      this.obstacleCache.set(key,obs);
      return obs;
    }

    obstaclesAround(x,y,radius=120) {
      const size=this.cfg.chunkSize;
      const minX=Math.floor((x-radius)/size), maxX=Math.floor((x+radius)/size);
      const minY=Math.floor((y-radius)/size), maxY=Math.floor((y+radius)/size);
      const arr=[];
      for(let cy=minY;cy<=maxY;cy++) for(let cx=minX;cx<=maxX;cx++) arr.push(...this.chunk(cx,cy));
      return arr;
    }

    collectLooseResources(x,y,radius=30) {
      let stones=0,bait=0;
      for(const o of this.obstaclesAround(x,y,radius+24)){
        if(!['stonePickup','baitPickup'].includes(o.type)||o.used)continue;
        if(Math.hypot(x-o.x,y-o.y)<=radius+o.radius){
          o.used=true;
          if(o.type==='stonePickup')stones++; else bait++;
        }
      }
      return {stones,bait};
    }

    resolveCircle(x,y,radius) {
      let px=x, py=y;
      for (const o of this.obstaclesAround(px,py,radius+45)) {
        if(!o.solid) continue;
        const dx=px-o.x, dy=py-o.y, d=Math.hypot(dx,dy), min=radius+o.radius;
        if(d<min) {
          const nx=d>.001?dx/d:1, ny=d>.001?dy/d:0;
          px=o.x+nx*min; py=o.y+ny*min;
        }
      }
      return {x:px,y:py};
    }

    drawGroundTile(ctx, habitat, sx, sy, wx, wy) {
      const n = hash2(wx>>5, wy>>5, 4);
      if(this.tilesImg.complete && this.tilesImg.naturalWidth > 0){
        const choices = PUNY.ground[habitat] || PUNY.ground.meadow;
        const c = choices[Math.floor(n * choices.length) % choices.length];
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.tilesImg, c[0], c[1], PUNY.tile, PUNY.tile, sx, sy, 32, 32);
        ctx.fillStyle = PUNY.overlay[habitat] || 'rgba(0,0,0,0)';
        ctx.fillRect(sx, sy, 32, 32);
        // pequeñas variaciones para que el suelo no se vea plano
        if(habitat==='forest' && n>.62){ctx.fillStyle='rgba(14,45,21,.14)';ctx.fillRect(sx+2,sy+2,28,28);}
        if(habitat==='special' && n>.76){ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(sx+8,sy+8,4,4);ctx.fillRect(sx+18,sy+14,3,3);}
        if(habitat==='water'){
          ctx.fillStyle='rgba(215,248,255,.18)';
          ctx.fillRect(sx+4, sy+10, 10, 2);
          ctx.fillRect(sx+17, sy+19, 9, 2);
        }
        ctx.restore();
        return;
      }

      const p=PALETTES[habitat]||PALETTES.meadow;
      ctx.fillStyle=n>.72?p[1]:n>.36?p[0]:p[2];
      ctx.fillRect(sx,sy,33,33);
      if(habitat==='water'){
        ctx.fillStyle='rgba(210,241,245,.28)';
        if(n>.3){ctx.fillRect(sx+6,sy+10,9,2);ctx.fillRect(sx+18,sy+20,8,2);}        
      } else if(habitat==='volcano'){
        if(n>.83){ctx.fillStyle='#d66b3e';ctx.fillRect(sx+8,sy+14,14,3);ctx.fillStyle='#f0a04a';ctx.fillRect(sx+12,sy+14,6,2);}        
      } else if(habitat==='mountain'){
        if(n>.70){ctx.fillStyle='rgba(220,220,205,.18)';ctx.fillRect(sx+7,sy+6,5,3);ctx.fillRect(sx+20,sy+22,4,3);}        
      } else {
        ctx.fillStyle=n>.5?p[3]:p[2];
        const ox=4+Math.floor(hash2(wx>>5,wy>>5,17)*22), oy=5+Math.floor(hash2(wx>>5,wy>>5,21)*20);
        if(n>.18){ctx.fillRect(sx+ox,sy+oy,2,6);ctx.fillRect(sx+ox+3,sy+oy+2,2,4);}        
      }
    }

    draw(ctx,camera,w,h) {
      const tile=32;
      const startX=Math.floor((camera.x-w/2)/tile)-1, endX=Math.floor((camera.x+w/2)/tile)+1;
      const startY=Math.floor((camera.y-h/2)/tile)-1, endY=Math.floor((camera.y+h/2)/tile)+1;

      for(let ty=startY;ty<=endY;ty++) for(let tx=startX;tx<=endX;tx++) {
        const wx=tx*tile, wy=ty*tile;
        const habitat=this.habitatAt(wx+tile/2,wy+tile/2);
        const sx=Math.floor(wx-camera.x+w/2), sy=Math.floor(wy-camera.y+h/2);
        this.drawGroundTile(ctx, habitat, sx, sy, wx, wy);
      }

      const size=this.cfg.chunkSize;
      const minCx=Math.floor((camera.x-w/2-80)/size), maxCx=Math.floor((camera.x+w/2+80)/size);
      const minCy=Math.floor((camera.y-h/2-80)/size), maxCy=Math.floor((camera.y+h/2+80)/size);
      const all=[];
      for(let cy=minCy;cy<=maxCy;cy++) for(let cx=minCx;cx<=maxCx;cx++) all.push(...this.chunk(cx,cy));
      all.sort((a,b)=>a.y-b.y);
      for(const o of all) this.drawObstacle(ctx,o,camera,w,h);
    }

    drawObstacle(ctx,o,camera,w,h) {
      if(o.used && ['stonePickup','baitPickup'].includes(o.type)) return;
      const x=Math.round(o.x-camera.x+w/2), y=Math.round(o.y-camera.y+h/2);

      if(o.type==='stonePickup'){
        ctx.save();
        ctx.imageSmoothingEnabled=false;
        ctx.fillStyle='rgba(245,228,139,.18)';ctx.beginPath();ctx.arc(x,y-5,14,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#5f6d67';ctx.fillRect(x-8,y-8,16,9);ctx.fillRect(x-5,y-12,10,5);
        ctx.fillStyle='#9aa69f';ctx.fillRect(x-5,y-10,7,3);
        ctx.restore();
      } else if(o.type==='baitPickup'){
        ctx.save();
        ctx.imageSmoothingEnabled=false;
        ctx.fillStyle='rgba(244,214,109,.16)';ctx.beginPath();ctx.arc(x,y-6,14,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#8b5b37';ctx.fillRect(x-7,y-10,14,12);
        ctx.fillStyle='#d7a04b';ctx.fillRect(x-9,y-15,18,8);
        ctx.fillStyle='#f1d369';ctx.fillRect(x-4,y-18,8,5);
        ctx.fillStyle='#fff1a0';ctx.fillRect(x-2,y-17,4,2);
        ctx.restore();
      } else if(o.type==='waterSpot') {
        ctx.save();
        ctx.fillStyle=o.used?'rgba(39,91,116,.22)':'rgba(29,70,101,.62)';
        ctx.beginPath();ctx.ellipse(x,y-4,30,18,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=o.used?'rgba(159,211,226,.22)':'rgba(154,221,236,.58)';
        ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(x,y-4,22,11,0,0,Math.PI*2);ctx.stroke();
        ctx.beginPath();ctx.ellipse(x+5,y-5,10,5,0,0,Math.PI*2);ctx.stroke();
        ctx.restore();
      } else if(o.type==='tree') {
        ctx.save();
        ctx.imageSmoothingEnabled=false;
        ctx.fillStyle='#6c4d2f';ctx.fillRect(x-6,y-24,12,26);
        const topColor = o.biome==='special' ? '#6f5a91' : o.biome==='forest' ? '#3f864a' : '#448d4e';
        const topColor2 = o.biome==='special' ? '#8a75af' : o.biome==='forest' ? '#5da068' : '#65a96c';
        ctx.fillStyle=topColor;ctx.fillRect(x-22,y-52,44,24);ctx.fillRect(x-16,y-60,32,10);
        ctx.fillStyle=topColor2;ctx.fillRect(x-14,y-47,12,8);ctx.fillRect(x+2,y-50,12,10);ctx.fillRect(x-2,y-58,10,6);
        ctx.restore();
      } else if(o.type==='rock') {
        ctx.save();
        ctx.imageSmoothingEnabled=false;
        const hot=o.biome==='volcano';
        ctx.fillStyle=hot?'#483331':'#56605b';ctx.fillRect(x-20,y-16,40,20);ctx.fillRect(x-10,y-22,20,8);
        ctx.fillStyle=hot?'#6f4b42':'#717d77';ctx.fillRect(x-14,y-18,14,10);ctx.fillRect(x+2,y-18,12,12);ctx.fillRect(x-3,y-24,6,8);
        ctx.fillStyle=hot?'#a96543':'#959f9a';ctx.fillRect(x-7,y-17,5,3);ctx.fillRect(x+6,y-12,4,2);
        ctx.restore();
      } else {
        ctx.save();
        ctx.imageSmoothingEnabled=false;
        const c1=o.biome==='special'?'#5b4678':'#2f6e3f', c2=o.biome==='special'?'#8266a4':'#4a9155';
        ctx.fillStyle=c1;ctx.fillRect(x-18,y-17,36,18);ctx.fillRect(x-10,y-23,20,8);
        ctx.fillStyle=c2;ctx.fillRect(x-13,y-18,10,7);ctx.fillRect(x+1,y-20,12,8);
        ctx.restore();
      }

      if(o.special && !o.used) {
        const iy=o.type==='tree'?y-72:o.type==='waterSpot'?y-38:y-39;
        ctx.save();
        ctx.fillStyle='rgba(18,28,21,.88)';ctx.beginPath();ctx.arc(x,iy,12,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#f4dd67';ctx.lineWidth=2;ctx.stroke();
        ctx.fillStyle='#f7e67b';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('!',x,iy+1);
        ctx.restore();
      }
    }
  }

  NS.World = World;
})();
