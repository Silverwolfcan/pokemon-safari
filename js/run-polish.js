(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if(!NS.Game || !NS.WildPokemon) {
    console.error('[Pokémon Safari] run-polish.js: Game/WildPokemon no disponibles.');
    return;
  }

  /* 1) Piedra = enfado visible de nuevo. gameplay-fixes antiguo la convertía
     directamente en huida, por eso desaparecía la exclamación roja. */
  NS.WildPokemon.prototype.applyRock=function () {
    this.state='angry';
    this.stateTimer=4.5;
    this.rockProvoked=true;
  };

  /* 2) Final de expedición silencioso. Conservamos el resto de SFX. */
  if(NS.Audio?.sfx && !NS.Audio.__silentRunEndPatched) {
    const originalSfx=NS.Audio.sfx.bind(NS.Audio);
    NS.Audio.sfx=function (name,...args) {
      if(name==='gameOver') return;
      return originalSfx(name,...args);
    };
    NS.Audio.__silentRunEndPatched=true;
  }

  /* 3) Recuperar PASOS en la parte superior del HUD de run. */
  function restoreStepsHud() {
    const value=document.getElementById('stepsHud');
    const box=value?.closest('.hud-box');
    if(!box) return;
    box.classList.remove('hud-hidden-runtime');
    box.classList.add('top-stat-box');
    box.removeAttribute('aria-hidden');
  }

  if(document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded',restoreStepsHud,{once:true});
  } else {
    restoreStepsHud();
  }

  /* 4) Mensajes redundantes de run desactivados.
     El HUD ya indica el bioma y el inventario ya muestra piedras/cebos. */
  if(!NS.Game.prototype.__quietRunToastsPatched) {
    const originalToast=NS.Game.prototype.toast;

    if(typeof originalToast==='function') {
      NS.Game.prototype.toast=function(msg,...args) {
        const text=String(msg||'');

        const biomeMessage=/^Has entrado en(?:\s+un|\s+una)?\s*:?/i.test(text);
        const stonePickupMessage=/^Has (?:encontrado|recogido)\b.*\bpiedra(?:s)?\b/i.test(text);
        const baitPickupMessage=/^Has (?:encontrado|recogido)\b.*\bcebo(?:s)?\b/i.test(text);

        if(biomeMessage || stonePickupMessage || baitPickupMessage) return;
        return originalToast.call(this,msg,...args);
      };
    }

    NS.Game.prototype.__quietRunToastsPatched=true;
  }

  /* 5) Brújula shiny alrededor del personaje.
     La señal queda a ~mitad de camino entre el jugador y el borde de pantalla,
     por lo que no queda escondida bajo la UI periférica. */
  function drawCrescentPointer(ctx,x,y,angle,t,index=0) {
    const pulse=1+Math.sin(t*.006+index*1.7)*.06;

    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle);
    ctx.scale(pulse,pulse);

    ctx.shadowColor='rgba(255,207,35,.68)';
    ctx.shadowBlur=9;
    ctx.fillStyle='#ffd52f';
    ctx.strokeStyle='#a64b16';
    ctx.lineWidth=2.5;
    ctx.lineJoin='round';

    // Media luna/boomerang con punta central orientada hacia el shiny.
    ctx.beginPath();
    ctx.moveTo(20,0);
    ctx.bezierCurveTo(7,-5,-3,-10,-17,-22);
    ctx.bezierCurveTo(-12,-8,-11,-3,-10,0);
    ctx.bezierCurveTo(-11,3,-12,8,-17,22);
    ctx.bezierCurveTo(-3,10,7,5,20,0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Brillo interior para mantener lectura sobre cualquier bioma.
    ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,248,170,.95)';
    ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.moveTo(11,0);
    ctx.bezierCurveTo(1,-4,-5,-8,-11,-14);
    ctx.moveTo(11,0);
    ctx.bezierCurveTo(1,4,-5,8,-11,14);
    ctx.stroke();

    ctx.restore();
  }

  NS.Game.prototype.drawShinyIndicators=function (ctx,t) {
    if(NS.activeGame && NS.activeGame!==this) return;
    const margin=36;
    const playerX=this.player.x-this.camera.x+this.width/2;
    const playerY=this.player.y-this.camera.y+this.height/2;
    let indicatorIndex=0;

    for(const p of this.wild) {
      if(!p.shiny||p._removed) continue;

      const sx=p.x-this.camera.x+this.width/2;
      const sy=p.y-this.camera.y+this.height/2;

      // Si el shiny ya está visible, no hace falta brújula.
      if(sx>=margin&&sx<=this.width-margin&&sy>=margin&&sy<=this.height-margin) continue;

      const dx=sx-playerX;
      const dy=sy-playerY;
      const len=Math.hypot(dx,dy)||1;
      const nx=dx/len;
      const ny=dy/len;

      // Distancia desde el jugador hasta el borde en esta dirección.
      const tx=nx!==0
        ? (nx>0 ? (this.width-margin-playerX)/nx : (margin-playerX)/nx)
        : Infinity;
      const ty=ny!==0
        ? (ny>0 ? (this.height-margin-playerY)/ny : (margin-playerY)/ny)
        : Infinity;
      const edgeDistance=Math.max(0,Math.min(Math.abs(tx),Math.abs(ty)));

      // Aproximadamente a mitad de camino: efecto brújula alrededor del jugador.
      const distance=Math.max(92,Math.min(edgeDistance*.52,280));
      const x=playerX+nx*distance;
      const y=playerY+ny*distance;

      drawCrescentPointer(ctx,x,y,Math.atan2(ny,nx),t,indicatorIndex++);
    }
  };

  console.info('[Pokémon Safari] V2.9.1: pickups legibles y mensajes redundantes de run desactivados.');
})();
