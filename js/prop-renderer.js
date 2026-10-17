(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  const images = {};

  function imageFor(atlasId) {
    if(images[atlasId]) return images[atlasId];
    const url=NS.PROP_ATLASES?.[atlasId];
    if(!url) return null;
    const img=new Image();
    img.src=url;
    img.decoding='async';
    images[atlasId]=img;
    return img;
  }


  function frameFor(type,variant=0) {
    const list=NS.PROP_ATLAS_FRAMES?.[type];
    if(!list?.length) return null;
    return list[Math.abs(variant|0)%list.length];
  }

  function drawAtlasProp(ctx,type,variant,x,y,meta) {
    const frame=frameFor(type,variant);
    if(!frame) return false;
    const img=imageFor(frame.atlas);
    if(!img || !img.complete || img.naturalWidth===0) return false;

    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(
      img,
      frame.x,frame.y,frame.w,frame.h,
      Math.round(x-meta.drawW/2),
      Math.round(y-meta.drawH),
      meta.drawW,
      meta.drawH
    );
    ctx.restore();
    return true;
  }

  function drawPlaceholder(ctx,x,y,meta,type) {
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.fillStyle=type.includes('Tree')||type==='charredTree'||type==='twistedTree'?'#486b46':'#6e756f';
    ctx.fillRect(Math.round(x-meta.drawW*.25),Math.round(y-meta.drawH*.45),Math.max(4,Math.round(meta.drawW*.5)),Math.max(4,Math.round(meta.drawH*.4)));
    ctx.restore();
  }

  function drawSpecialMarker(ctx,o,x,y) {
    if(!o.special||o.used) return;
    const iy=y-(o.markerOffset||36);
    ctx.save();
    ctx.fillStyle='rgba(18,28,21,.90)';
    ctx.beginPath(); ctx.arc(x,iy,12,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#f4dd67'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#f7e67b'; ctx.font='15px "m6x11", monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('!',x,iy+1);
    ctx.restore();
  }

  function drawPickup(ctx,o,x,y) {
    if(o.used) return true;
    if(!NS.ItemIcons?.drawGlyph) return true;

    const type=o.type==='baitPickup'?'bait':'stone';
    const t=performance.now();

    // Pulso suave. La escala nunca altera los colores internos del icono.
    const wave=.5+.5*Math.sin(t*.0065+(o.x+o.y)*.01);
    const scale=1 + wave*.09;

    const groundY=Math.round(y+1);
    const centerX=Math.round(x);
    const centerY=Math.round(groundY-10);

    ctx.save();
    ctx.imageSmoothingEnabled=false;

    // Sombra pequeña para mantener el pickup apoyado visualmente en el suelo.
    ctx.fillStyle='rgba(14,20,18,.24)';
    ctx.beginPath();
    ctx.ellipse(centerX,groundY+2,9*scale,3.2*scale,0,0,Math.PI*2);
    ctx.fill();

    ctx.translate(centerX,centerY);
    ctx.scale(scale,scale);

    // Halo dorado MUY sutil. No tiñe el icono.
    ctx.shadowColor=`rgba(255,210,55,${.22 + wave*.12})`;
    ctx.shadowBlur=4 + wave*3;

    // Outline dorado independiente del relleno para conservar piedra gris / cebo marrón.
    ctx.strokeStyle='#f3c94e';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(0,0,10.5,0,Math.PI*2);
    ctx.stroke();

    // Segundo borde interior más claro para mejorar lectura sin cambiar el color original.
    ctx.shadowBlur=0;
    ctx.strokeStyle=`rgba(255,244,168,${.55 + wave*.22})`;
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.arc(0,0,9.5,0,Math.PI*2);
    ctx.stroke();

    // Icono ORIGINAL compartido con el HUD del jugador.
    NS.ItemIcons.drawGlyph(ctx,0,0,type);

    ctx.restore();
    return true;
  }


  function drawObject(ctx,o,camera,w,h) {
    const camX=Math.floor(camera.x);
    const camY=Math.floor(camera.y);
    const x=Math.floor(o.x-camX+w/2);
    const y=Math.floor(o.y-camY+h/2);

    if(o.type==='stonePickup'||o.type==='baitPickup') return drawPickup(ctx,o,x,y);

    if(o.type==='waterSpot') {
      ctx.save();
      ctx.fillStyle=o.used?'rgba(39,91,116,.18)':'rgba(24,71,100,.48)';
      ctx.beginPath(); ctx.ellipse(x,y-4,25,13,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(205,244,246,.62)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(x,y-4,17,8,0,0,Math.PI*2); ctx.stroke();
      ctx.restore();
      drawSpecialMarker(ctx,o,x,y);
      return true;
    }

    const type=o.visualType;
    const meta=NS.PROP_VISUAL_META[type];
    if(!type||!meta) return false;

    if(!drawAtlasProp(ctx,type,o.variant||0,x,y,meta)) {
      drawPlaceholder(ctx,x,y,meta,type);
    }

    drawSpecialMarker(ctx,o,x,y);
    return true;
  }

  // Iniciamos las cargas sin bloquear el arranque. El dibujo usa cada PNG en cuanto termina.
  for(const atlasId of Object.keys(NS.PROP_ATLASES||{})) imageFor(atlasId);

  NS.PropRenderer={drawObject,images,frameFor};
  console.info('[Pokémon Safari] Renderer multi-atlas V2.9.1: iconos originales preservados con outline dorado sutil.');
})();
