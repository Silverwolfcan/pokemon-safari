(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  const ART_TILE=16;
  const WORLD_TILE=32;

  /*
    V1.3: chunks visuales más pequeños.
    Reducimos el pico de trabajo al entrar en una nueva zona del mapa.
  */
  const CHUNK_TILES=8;
  const ART_CHUNK=ART_TILE*CHUNK_TILES;
  const WORLD_CHUNK=WORLD_TILE*CHUNK_TILES;

  const HABITAT_RANK={
    meadow:0,
    forest:1,
    water:2,
    mountain:3,
    volcano:4,
    special:5
  };

  function rgb(hex) {
    const n=parseInt(hex.slice(1),16);
    return [(n>>16)&255,(n>>8)&255,n&255];
  }

  function pack(hex,a=255) {
    const [r,g,b]=rgb(hex);
    return ((a<<24)|(b<<16)|(g<<8)|r)>>>0;
  }

  function mixHex(a,b,t) {
    const A=rgb(a), B=rgb(b);
    const C=A.map((v,i)=>Math.round(v+(B[i]-v)*t));
    return '#'+C.map(v=>v.toString(16).padStart(2,'0')).join('');
  }

  function pixelCanvas(w,h) {
    const canvas=document.createElement('canvas');
    canvas.width=w;
    canvas.height=h;

    const ctx=canvas.getContext('2d');
    const image=ctx.createImageData(w,h);
    const buf=new Uint32Array(image.data.buffer);

    return {
      width:w,
      height:h,
      set(x,y,color) {
        if(x<0||y<0||x>=w||y>=h) return;
        buf[y*w+x]=color;
      },
      finish() {
        ctx.putImageData(image,0,0);
        return canvas;
      }
    };
  }

  function paletteFor(theme) {
    const T=NS.TERRAIN_THEMES[theme] || NS.TERRAIN_THEMES.meadow;

    return {
      floor:T.floor.map(h=>pack(h)),
      patch:T.patch.map(h=>pack(h)),
      speck:pack(T.speck),
      light:pack(T.light),
      accent:T.accent.map(h=>pack(h)),
      liquid:T.liquid ? pack(T.liquid) : null,
      liquidDeep:T.liquidDeep ? pack(T.liquidDeep) : null,
      liquidLight:T.liquidLight ? pack(T.liquidLight) : null,
      foam:T.foam ? pack(T.foam) : null,
      shore:T.shore ? pack(T.shore) : null,
      lava:T.lava ? pack(T.lava) : null,
      lavaDeep:T.lavaDeep ? pack(T.lavaDeep) : null,
      lavaLight:T.lavaLight ? pack(T.lavaLight) : null,
      lavaGlow:T.lavaGlow ? pack(T.lavaGlow) : null,
      lavaCrust:T.lavaCrust ? pack(T.lavaCrust) : null
    };
  }

  const PALETTE_CACHE={};
  function pal(id) {
    return PALETTE_CACHE[id] || (PALETTE_CACHE[id]=paletteFor(id));
  }

  function patchBiasFor(habitat) {
    return habitat==='meadow' ? .67 :
      habitat==='forest' ? .72 :
      habitat==='water' ? .70 :
      habitat==='mountain' ? .62 :
      habitat==='volcano' ? .61 : .70;
  }

  /*
    V1.4:
    El problema de los "minicuadrados" venía de decidir floor/patch por tile.
    Ahora el patrón base se decide en coordenadas globales de píxel con ruido
    ancho y direccional, de forma continua entre tiles. Así el suelo se siente
    más parecido a un tileset pintado y menos a una cuadrícula procedural.
  */
  function makeTileSampler(habitat,tx,ty) {
    const P=pal(habitat);
    const HF=NS.HabitatField;

    return (x,y)=>{
      const gx=tx*ART_TILE+x;
      const gy=ty*ART_TILE+y;

      const broad = HF.fbm(gx/42.0, gy/42.0, 5201);
      const drift = HF.fbm((gx+gy*0.45)/26.0, (gy-gx*0.18)/26.0, 5203);
      const micro = HF.hash2(gx>>2, gy>>2, 5205)*0.16 - 0.08;
      const patchScore = broad*0.60 + drift*0.40 + micro;
      const source = patchScore>patchBiasFor(habitat) ? P.patch : P.floor;

      const band =
        HF.hash2(gx>>2, gy>>2, 5207)*0.50 +
        HF.hash2((gx+gy)>>2, gy>>1, 5211)*0.30 +
        HF.hash2(gx, gy, 5213)*0.20;

      let color=source[Math.min(source.length-1,Math.floor(band*source.length))];

      const detail=HF.hash2(gx,gy,5227);
      if(detail<.018) color=P.speck;
      else if(detail>.992) color=P.light;
      else if((habitat==='meadow' || habitat==='forest') && detail>.76 && detail<.79) {
        color=(gx+y)%2===0 ? P.light : color;
      }

      return color;
    };
  }

  function rawNeighbor(world,tx,ty,dx,dy) {
    return world.habitatSampleAtTile(tx+dx,ty+dy).primary;
  }

  /*
    IMPORTANTE:
    Una frontera tiene un único "dueño" visual.

    V1.2 dibujaba A dentro de B Y B dentro de A, generando la sensación de
    dos capas superpuestas. Ahora solo un lado dibuja la transición.

    - Water siempre posee su costa: la arena recibe una pequeña franja del
      hábitat terrestre vecino.
    - Para el resto, el hábitat de mayor rango recibe una franja del menor.

    Así ambos tiles encajan como dos piezas de un autotile en vez de cruzarse.
  */
  function transitionSource(primary,neighbor) {
    if(!neighbor || neighbor===primary) return null;

    if(primary==='water') {
      return neighbor==='water' ? null : neighbor;
    }

    if(neighbor==='water') {
      return null;
    }

    return (HABITAT_RANK[primary]??0) > (HABITAT_RANK[neighbor]??0)
      ? neighbor
      : null;
  }

  function widthSeries(tx,ty,edge,source) {
    const HF=NS.HabitatField;
    const seed={n:5501,s:5507,w:5513,e:5519,nw:5525,ne:5531,sw:5537,se:5543}[edge] || 5599;
    const sourceRank=HABITAT_RANK[source]??0;
    const widths=new Uint8Array(ART_TILE);

    for(let i=0;i<ART_TILE;i++) {
      // Bloques de 3-4 píxeles: aspecto de tileset dibujado a mano, no ruido fino.
      const segment=Math.floor(i/4);
      const raw=HF.hash2(tx*13+segment,ty*17+segment,seed+sourceRank*31);
      widths[i]=2+Math.floor(raw*3); // 2..4 px
    }

    return widths;
  }

  function buildBorderProfile(world,tx,ty,primary) {
    const neighbors={
      n:rawNeighbor(world,tx,ty,0,-1),
      s:rawNeighbor(world,tx,ty,0, 1),
      w:rawNeighbor(world,tx,ty,-1,0),
      e:rawNeighbor(world,tx,ty, 1,0),
      nw:rawNeighbor(world,tx,ty,-1,-1),
      ne:rawNeighbor(world,tx,ty, 1,-1),
      sw:rawNeighbor(world,tx,ty,-1, 1),
      se:rawNeighbor(world,tx,ty, 1, 1)
    };

    const profile={primary,edges:{},corners:{}};

    for(const edge of ['n','s','w','e']) {
      const source=transitionSource(primary,neighbors[edge]);
      if(source) {
        profile.edges[edge]={source,widths:widthSeries(tx,ty,edge,source)};
      }
    }

    for(const corner of ['nw','ne','sw','se']) {
      const source=transitionSource(primary,neighbors[corner]);
      if(source) {
        profile.corners[corner]={source,widths:widthSeries(tx,ty,corner,source)};
      }
    }

    return profile;
  }

  function borderPixel(profile,x,y) {
    const candidates=[];

    const add=(edge,source,depth,width,priority)=>{
      if(!source || depth>=width) return;
      candidates.push({edge,source,depth,width,priority});
    };

    const n=profile.edges.n;
    const s=profile.edges.s;
    const w=profile.edges.w;
    const e=profile.edges.e;

    if(n) add('n',n.source,y,n.widths[x],1);
    if(s) add('s',s.source,ART_TILE-1-y,s.widths[x],1);
    if(w) add('w',w.source,x,w.widths[y],1);
    if(e) add('e',e.source,ART_TILE-1-x,e.widths[y],1);

    /*
      Las diagonales solo rellenan la esquina cuando no hay ya un borde cardinal
      que la esté resolviendo. Evita manchas apiladas en cruces de tres biomas.
    */
    const cNW=profile.corners.nw;
    const cNE=profile.corners.ne;
    const cSW=profile.corners.sw;
    const cSE=profile.corners.se;

    if(cNW && !n && !w) add('nw',cNW.source,x+y,cNW.widths[Math.min(15,x+y)],2);
    if(cNE && !n && !e) add('ne',cNE.source,(ART_TILE-1-x)+y,cNE.widths[Math.min(15,(ART_TILE-1-x)+y)],2);
    if(cSW && !s && !w) add('sw',cSW.source,x+(ART_TILE-1-y),cSW.widths[Math.min(15,x+(ART_TILE-1-y))],2);
    if(cSE && !s && !e) add('se',cSE.source,(ART_TILE-1-x)+(ART_TILE-1-y),cSE.widths[Math.min(15,(ART_TILE-1-x)+(ART_TILE-1-y))],2);

    if(!candidates.length) return null;

    candidates.sort((a,b)=>
      a.depth-b.depth ||
      b.priority-a.priority ||
      (HABITAT_RANK[a.source]??0)-(HABITAT_RANK[b.source]??0)
    );

    return candidates[0];
  }

  function paintEdgeTufts(P,ox,oy,tx,ty,profile) {
    const HF=NS.HabitatField;
    const primaryPal=pal(profile.primary);

    const draw=(edge,entry)=>{
      if(!entry) return;
      if(HF.hash2(tx,ty,5701+(edge.charCodeAt(0)||0))>.52) return;

      const along=3+Math.floor(HF.hash2(tx,ty,5711+(edge.charCodeAt(0)||0))*10);
      const width=entry.widths[along];
      const c=primaryPal.speck;

      if(edge==='n') {
        const y=oy+Math.min(ART_TILE-1,width);
        P.set(ox+along,y,c); P.set(ox+along+1,y-1,c);
      } else if(edge==='s') {
        const y=oy+ART_TILE-1-Math.min(ART_TILE-1,width);
        P.set(ox+along,y,c); P.set(ox+along+1,y+1,c);
      } else if(edge==='w') {
        const x=ox+Math.min(ART_TILE-1,width);
        P.set(x,oy+along,c); P.set(x-1,oy+along+1,c);
      } else if(edge==='e') {
        const x=ox+ART_TILE-1-Math.min(ART_TILE-1,width);
        P.set(x,oy+along,c); P.set(x+1,oy+along+1,c);
      }
    };

    draw('n',profile.edges.n);
    draw('s',profile.edges.s);
    draw('w',profile.edges.w);
    draw('e',profile.edges.e);
  }

  function isLiquid(world,tx,ty) {
    return world.terrainAtTile(tx,ty)==='liquid';
  }


  function isLava(world,tx,ty) {
    return world.terrainAtTile(tx,ty)==='lava';
  }

  function paintGroundTile(P,world,ox,oy,tx,ty,sample) {
    const profile=buildBorderProfile(world,tx,ty,sample.primary);
    const samplers=new Map();

    const sampler=(habitat)=>{
      let fn=samplers.get(habitat);
      if(!fn) {
        fn=makeTileSampler(habitat,tx,ty);
        samplers.set(habitat,fn);
      }
      return fn;
    };

    const primarySampler=sampler(sample.primary);

    for(let y=0;y<ART_TILE;y++) {
      for(let x=0;x<ART_TILE;x++) {
        const border=borderPixel(profile,x,y);
        const color=border
          ? sampler(border.source)(x,y)
          : primarySampler(x,y);

        P.set(ox+x,oy+y,color);
      }
    }

    paintEdgeTufts(P,ox,oy,tx,ty,profile);

    const theme=NS.TERRAIN_THEMES[sample.primary];
    const palette=pal(sample.primary);
    const d=NS.HabitatField.hash2(tx,ty,5301);

    const dx=ox+3+Math.floor(NS.HabitatField.hash2(tx,ty,5302)*10);
    const dy=oy+4+Math.floor(NS.HabitatField.hash2(tx,ty,5303)*8);

    // Menos decoración justo en fronteras para que el autotile siga legible.
    const hasEdge=Object.keys(profile.edges).length>0;
    if(hasEdge || sample.transition>.92) return;

    if(sample.primary==='volcano' && d<.20) {
      const hot=pack(theme.accent[0]);
      const hot2=pack(theme.accent[1]);
      for(let i=0;i<6;i++) {
        P.set(dx+i,dy+Math.floor(i/2),i%3===0?hot2:hot);
      }
      return;
    }

    if(sample.primary==='special' && d<.16) {
      const c=palette.accent[Math.floor(NS.HabitatField.hash2(tx,ty,5304)*palette.accent.length)];
      P.set(dx,dy,c);
      P.set(dx+1,dy-1,c);
      P.set(dx+2,dy,c);
      P.set(dx+1,dy+1,c);
      return;
    }

    if(d<.12) {
      P.set(dx,dy,palette.light);
      P.set(dx-1,dy-1,palette.light);
      P.set(dx+1,dy-1,palette.light);
      P.set(dx,dy-2,palette.light);
      P.set(dx,dy+1,palette.speck);
    } else if(d<.18 && sample.primary!=='mountain' && sample.primary!=='volcano') {
      const fc=palette.accent[Math.floor(NS.HabitatField.hash2(tx,ty,5305)*palette.accent.length)];
      P.set(dx,dy-1,fc);
      P.set(dx-1,dy,fc);
      P.set(dx+1,dy,fc);
      P.set(dx,dy+1,fc);
      P.set(dx,dy,palette.light);
    } else if(d<.24) {
      P.set(dx,dy,palette.light);
      P.set(dx+1,dy,palette.light);
      P.set(dx,dy+1,palette.speck);
      P.set(dx+1,dy+1,palette.speck);
    }
  }

  function paintLiquidTile(P,world,ox,oy,tx,ty,sample) {
    // Debajo del agua sigue existiendo la costa procedural.
    paintGroundTile(P,world,ox,oy,tx,ty,sample);

    const W=NS.TERRAIN_THEMES.water;
    const water={
      liquid:pack(W.liquid),
      deep:pack(W.liquidDeep),
      light:pack(W.liquidLight),
      foam:pack(W.foam),
      shore:pack(W.shore)
    };

    const L=(x,y)=>isLiquid(world,x,y);
    const n=L(tx,ty-1), s=L(tx,ty+1), w=L(tx-1,ty), e=L(tx+1,ty);
    const nw=L(tx-1,ty-1), ne=L(tx+1,ty-1), sw=L(tx-1,ty+1), se=L(tx+1,ty+1);

    const BIG=99;

    for(let y=0;y<ART_TILE;y++) {
      for(let x=0;x<ART_TILE;x++) {
        if(!n&&!w&&x+y<3) continue;
        if(!n&&!e&&(ART_TILE-1-x)+y<3) continue;
        if(!s&&!w&&x+(ART_TILE-1-y)<3) continue;
        if(!s&&!e&&(ART_TILE-1-x)+(ART_TILE-1-y)<3) continue;

        let dist=Math.min(
          n?BIG:y,
          s?BIG:ART_TILE-1-y,
          w?BIG:x,
          e?BIG:ART_TILE-1-x
        );

        if(n&&w&&!nw) dist=Math.min(dist,Math.hypot(x,y)-.5);
        if(n&&e&&!ne) dist=Math.min(dist,Math.hypot(ART_TILE-1-x,y)-.5);
        if(s&&w&&!sw) dist=Math.min(dist,Math.hypot(x,ART_TILE-1-y)-.5);
        if(s&&e&&!se) dist=Math.min(dist,Math.hypot(ART_TILE-1-x,ART_TILE-1-y)-.5);

        const gx=tx*ART_TILE+x;
        const gy=ty*ART_TILE+y;
        const r=NS.HabitatField.hash2(gx,gy,5401);

        let color;
        if(dist<1) color=water.shore;
        else if(dist<2) color=water.foam;
        else if(dist<4) color=water.light;
        else if(dist<7) color=r<.52?water.liquid:water.light;
        else color=r<.16?water.liquid:water.deep;

        if(dist>=3 && NS.HabitatField.hash2(gx>>2,gy,5402)<.038 && (gx&3)!==3) {
          color=water.light;
        }

        P.set(ox+x,oy+y,color);
      }
    }
  }


  function paintLavaTile(P,world,ox,oy,tx,ty,sample) {
    // El suelo volcánico queda debajo para que las esquinas/bordes tengan costra.
    paintGroundTile(P,world,ox,oy,tx,ty,sample);

    const V=pal('volcano');
    const lava={
      main:V.lava,
      deep:V.lavaDeep,
      light:V.lavaLight,
      glow:V.lavaGlow,
      crust:V.lavaCrust
    };

    const L=(x,y)=>isLava(world,x,y);
    const n=L(tx,ty-1), s=L(tx,ty+1), w=L(tx-1,ty), e=L(tx+1,ty);
    const nw=L(tx-1,ty-1), ne=L(tx+1,ty-1), sw=L(tx-1,ty+1), se=L(tx+1,ty+1);
    const BIG=99;

    for(let y=0;y<ART_TILE;y++) {
      for(let x=0;x<ART_TILE;x++) {
        // Pequeñas esquinas redondeadas, igual que el agua pero más compactas.
        if(!n&&!w&&x+y<3) continue;
        if(!n&&!e&&(ART_TILE-1-x)+y<3) continue;
        if(!s&&!w&&x+(ART_TILE-1-y)<3) continue;
        if(!s&&!e&&(ART_TILE-1-x)+(ART_TILE-1-y)<3) continue;

        let dist=Math.min(
          n?BIG:y,
          s?BIG:ART_TILE-1-y,
          w?BIG:x,
          e?BIG:ART_TILE-1-x
        );

        if(n&&w&&!nw) dist=Math.min(dist,Math.hypot(x,y)-.5);
        if(n&&e&&!ne) dist=Math.min(dist,Math.hypot(ART_TILE-1-x,y)-.5);
        if(s&&w&&!sw) dist=Math.min(dist,Math.hypot(x,ART_TILE-1-y)-.5);
        if(s&&e&&!se) dist=Math.min(dist,Math.hypot(ART_TILE-1-x,ART_TILE-1-y)-.5);

        const gx=tx*ART_TILE+x;
        const gy=ty*ART_TILE+y;
        const r=NS.HabitatField.hash2(gx,gy,5451);

        let color;
        if(dist<1.2) color=lava.crust;
        else if(dist<2.4) color=lava.deep;
        else if(dist<4.5) color=r<.40?lava.main:lava.light;
        else color=r<.12?lava.deep:lava.main;

        // Vetillas brillantes: pocas y cortas para que no parezca agua naranja.
        const vein=NS.HabitatField.hash2(gx>>1,gy>>1,5452);
        if(dist>=2 && vein>.965 && ((gx+gy)&3)!==0) color=lava.glow;
        else if(dist>=3 && vein>.91) color=lava.light;

        P.set(ox+x,oy+y,color);
      }
    }
  }

  function paintChunk(world,cx,cy) {
    const P=pixelCanvas(ART_CHUNK,ART_CHUNK);
    const tx0=cx*CHUNK_TILES;
    const ty0=cy*CHUNK_TILES;

    for(let j=0;j<CHUNK_TILES;j++) {
      for(let i=0;i<CHUNK_TILES;i++) {
        const tx=tx0+i;
        const ty=ty0+j;
        const sample=world.habitatSampleAtTile(tx,ty);
        const ox=i*ART_TILE;
        const oy=j*ART_TILE;

        const terrain=world.terrainAtTile(tx,ty);
        if(terrain==='liquid') {
          paintLiquidTile(P,world,ox,oy,tx,ty,sample);
        } else if(terrain==='lava') {
          paintLavaTile(P,world,ox,oy,tx,ty,sample);
        } else {
          paintGroundTile(P,world,ox,oy,tx,ty,sample);
        }
      }
    }

    return P.finish();
  }

  function paintSingleTile(world,tx,ty) {
    const P=pixelCanvas(ART_TILE,ART_TILE);
    const sample=world.habitatSampleAtTile(tx,ty);

    const terrain=world.terrainAtTile(tx,ty);
    if(terrain==='liquid') {
      paintLiquidTile(P,world,0,0,tx,ty,sample);
    } else if(terrain==='lava') {
      paintLavaTile(P,world,0,0,tx,ty,sample);
    } else {
      paintGroundTile(P,world,0,0,tx,ty,sample);
    }

    return P.finish();
  }

  NS.TerrainRenderer={
    ART_TILE,
    WORLD_TILE,
    CHUNK_TILES,
    ART_CHUNK,
    WORLD_CHUNK,
    paintChunk,
    paintSingleTile,
    mixHex
  };

  console.info('[Pokémon Safari] Renderer procedural v1.6: charcos de lava volcánicos.');
})();