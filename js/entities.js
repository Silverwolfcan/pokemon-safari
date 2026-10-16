(function () {
  const NS = window.SafariGame = window.SafariGame || {};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  class Player {
    constructor(x=0,y=0,trainerId=0) {
      this.x=x; this.y=y; this.radius=16; this.dx=0; this.dy=1; this.moving=false;
      this.trainerId=trainerId|0;
    }
    update(dt,keys,world,speed,swimLevel=0) {
      let dx=(keys['KeyD']||keys['ArrowRight']?1:0)-(keys['KeyA']||keys['ArrowLeft']?1:0);
      let dy=(keys['KeyS']||keys['ArrowDown']?1:0)-(keys['KeyW']||keys['ArrowUp']?1:0);
      const l=Math.hypot(dx,dy); this.moving=l>0;
      if(l>0){dx/=l;dy/=l;this.dx=dx;this.dy=dy;}
      const beforeX=this.x,beforeY=this.y;
      const terrainMultiplier=world.movementMultiplierAt(this.x,this.y,swimLevel);
      const terrainSpeed=speed*terrainMultiplier;
      let next=world.resolveCircle(this.x+dx*terrainSpeed*dt,this.y+dy*terrainSpeed*dt,this.radius);
      this.x=next.x; this.y=next.y;
      return Math.hypot(this.x-beforeX,this.y-beforeY);
    }
    directionName() {
      if (Math.abs(this.dx) > Math.abs(this.dy)) return this.dx < 0 ? 'left' : 'right';
      return this.dy < 0 ? 'up' : 'down';
    }
    draw(ctx,game,t=0) {
      const x=this.x-game.camera.x+game.width/2, y=this.y-game.camera.y+game.height/2;
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,.20)';ctx.beginPath();ctx.ellipse(x,y+2,15,7,0,0,Math.PI*2);ctx.fill();
      const drawn=game.trainers?.draw(ctx,this.trainerId,x,y,this.directionName(),this.moving,t,2.25);
      if(!drawn){
        ctx.fillStyle='#d7b48c';ctx.beginPath();ctx.arc(x,y-31,11,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#ece2c7';ctx.fillRect(x-10,y-21,20,25);
        ctx.fillStyle='#be4b3c';ctx.fillRect(x-13,y-43,26,7);ctx.fillRect(x-8,y-48,16,6);
        ctx.fillStyle='#305b84';ctx.fillRect(x-9,y+3,7,15);ctx.fillRect(x+2,y+3,7,15);
      }
      ctx.restore();
    }
  }

  class WildPokemon {
    constructor(species,x,y,shiny=false) {
      this.species=species; this.x=x;this.y=y;this.radius=18; this.shiny=shiny;
      this.state='wild'; this.stateTimer=0; this.fleeTimer=0; this.fleeDisappearTimer=0; this.dir=Math.random()*Math.PI*2;
      this.speed=species.speed; this.dx=Math.cos(this.dir);this.dy=Math.sin(this.dir); this.alpha=1;
      this.lastThreat=0; this.rockProvoked=false;
    }
    update(dt,game) {
      this.stateTimer-=dt; this.fleeTimer-=dt;
      const pdx=this.x-game.player.x,pdy=this.y-game.player.y,dist=Math.hypot(pdx,pdy);
      let speed=this.speed;
      if(this.state==='eating') {
        speed=0;
        if(this.stateTimer<=0) this.state='wild';
      } else if(this.state==='angry') {
        speed*=1.5;
        if(dist<210){this.dx=pdx/(dist||1);this.dy=pdy/(dist||1);} else if(this.stateTimer<=0)this.state='wild';
      } else if(this.state==='fleeing') {
        this.fleeDisappearTimer-=dt;
        if(this.fleeDisappearTimer<=0){this._removed=true;return;}
        speed*=2.0; this.dx=pdx/(dist||1);this.dy=pdy/(dist||1);
      } else {
        const fear=(this.species.temperament==='skittish'?190:this.species.temperament==='alert'?145:105);
        if(dist<fear && this.fleeTimer<=0) {
          this.beginFlee(game);
          this.dx=pdx/(dist||1);this.dy=pdy/(dist||1);
        } else if(this.stateTimer<=0){
          this.dir+=(Math.random()-.5)*2.4;this.dx=Math.cos(this.dir);this.dy=Math.sin(this.dir);this.stateTimer=.8+Math.random()*2.2;
        }
      }
      // Los Pokémon no abandonan sus hábitats naturales. Al tocar un borde de bioma
      // buscan una dirección alternativa dentro de una de sus zonas válidas.
      let nx=this.x+this.dx*speed*dt,ny=this.y+this.dy*speed*dt;
      if(!this.species.habitats.includes(game.world.habitatAt(nx,ny))){
        const base=Math.atan2(this.dy,this.dx);
        const offsets=[Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,3*Math.PI/4,-3*Math.PI/4,Math.PI];
        let found=false;
        for(const off of offsets){
          const a=base+off, tx=this.x+Math.cos(a)*speed*dt*1.7, ty=this.y+Math.sin(a)*speed*dt*1.7;
          if(this.species.habitats.includes(game.world.habitatAt(tx,ty))){
            this.dx=Math.cos(a);this.dy=Math.sin(a);this.dir=a;
            nx=this.x+this.dx*speed*dt;ny=this.y+this.dy*speed*dt;found=true;break;
          }
        }
        if(!found){nx=this.x;ny=this.y;this.dir+=Math.PI;this.dx=Math.cos(this.dir);this.dy=Math.sin(this.dir);}
      }
      const resolved=game.world.resolveCircle(nx,ny,this.radius);
      if(Math.abs(resolved.x-nx)>1||Math.abs(resolved.y-ny)>1){this.dir+=Math.PI*(.6+Math.random()*.8);this.dx=Math.cos(this.dir);this.dy=Math.sin(this.dir);}
      if(this.species.habitats.includes(game.world.habitatAt(resolved.x,resolved.y))){
        this.x=resolved.x;this.y=resolved.y;
      }else{
        this.dir+=Math.PI;this.dx=Math.cos(this.dir);this.dy=Math.sin(this.dir);
      }
    }
    beginFlee(game) {
      this.state='fleeing';
      this.stateTimer=999;
      this.fleeTimer=999;
      const base=(game?.config?.baseFleeDespawnTime||NS.CONFIG.baseFleeDespawnTime||4.5)+(game?.upgrades?.fleeTime||0)*(game?.config?.fleeTimePerUpgrade||NS.CONFIG.fleeTimePerUpgrade||1.5);
      this.fleeDisappearTimer=base*(this.rockProvoked?(game?.config?.rockFleeTimeMultiplier||NS.CONFIG.rockFleeTimeMultiplier||0.70):1);
    }
    applyBait() { this.state='eating'; this.stateTimer=5.5; }
    applyRock() { this.state='angry'; this.stateTimer=4.5; this.rockProvoked=true; }
    catchMultiplier() { return this.state==='eating'?1.35:this.state==='angry'?1.55:this.state==='fleeing'?.82:1; }
    drawSparkles(ctx,x,y,t) {
      ctx.save();
      ctx.fillStyle='#fff2a3';
      ctx.shadowColor='#ffe168';ctx.shadowBlur=6;
      for(let i=0;i<5;i++){
        const a=t*.0012+i*(Math.PI*2/5);
        const radius=29+5*Math.sin(t*.004+i*1.7);
        const sx=x+Math.cos(a)*radius;
        const sy=y-28+Math.sin(a)*18;
        const s=2.5+1.5*(.5+.5*Math.sin(t*.008+i));
        ctx.beginPath();
        ctx.moveTo(sx,sy-s*2);ctx.lineTo(sx+s*.55,sy-s*.55);ctx.lineTo(sx+s*2,sy);ctx.lineTo(sx+s*.55,sy+s*.55);
        ctx.lineTo(sx,sy+s*2);ctx.lineTo(sx-s*.55,sy+s*.55);ctx.lineTo(sx-s*2,sy);ctx.lineTo(sx-s*.55,sy-s*.55);ctx.closePath();ctx.fill();
      }
      ctx.restore();
    }
    draw(ctx,game,t) {
      const x=this.x-game.camera.x+game.width/2,y=this.y-game.camera.y+game.height/2;
      game.sprites.draw(ctx,this.species,x,y,this.dx,this.dy,t,true,1.5,this.alpha,this.shiny);
      if(this.shiny)this.drawSparkles(ctx,x,y,t);
      const scanner=game.upgrades.captureScanner||0;
      const dexEntry=game.save.dex[this.species.id];
      if(scanner>0 && dexEntry?.count>0)this.drawCapturedMarker(ctx,x,y-91);
      if(scanner>1 && dexEntry?.shiny>0)this.drawShinyCapturedMarker(ctx,x+22,y-91);
      if(this.state==='eating') this.icon(ctx,x,y-70,'♥','#f4d768');
      if(this.state==='angry') this.icon(ctx,x,y-70,'!','#ff725c');
      if(this.state==='fleeing') this.icon(ctx,x,y-70,'!','#ffffff');
    }
    drawCapturedMarker(ctx,x,y){
      ctx.save();ctx.translate(x,y);ctx.lineWidth=1.5;ctx.strokeStyle='#f4f7f5';
      ctx.fillStyle='rgba(13,24,18,.82)';ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.fillStyle='#e95c55';ctx.fill();
      ctx.fillStyle='#f4f4ed';ctx.fillRect(-7,0,14,7);ctx.strokeStyle='#25332c';ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(7,0);ctx.stroke();
      ctx.beginPath();ctx.arc(0,0,2.5,0,Math.PI*2);ctx.fillStyle='#f4f4ed';ctx.fill();ctx.strokeStyle='#25332c';ctx.stroke();ctx.restore();
    }

    drawShinyCapturedMarker(ctx,x,y){
      ctx.save();ctx.translate(x,y);
      ctx.fillStyle='rgba(47,10,13,.88)';ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#ffaca7';ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle='#ef3e43';ctx.strokeStyle='#7d151b';ctx.lineWidth=1;
      ctx.beginPath();
      for(let i=0;i<10;i++){
        const a=-Math.PI/2+i*Math.PI/5, r=i%2===0?7:3.2;
        const px=Math.cos(a)*r, py=Math.sin(a)*r;
        if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
      }
      ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    }
    icon(ctx,x,y,text,color){ctx.save();ctx.fillStyle='rgba(0,0,0,.65)';ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y+1);ctx.restore();}
  }

  class ThrownItem {
    constructor(type,x,y,vx,vy,power) {
      this.type=type;this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.power=power;this.life=1.8;this.dead=false;this.radius=type==='ball'?11:9;
      this.height=10; this.spin=0;
    }
    update(dt,game) {
      this.x+=this.vx*dt;this.y+=this.vy*dt;this.spin+=dt*9;this.life-=dt;
      this.vx*=Math.pow(.985,dt*60);this.vy*=Math.pow(.985,dt*60);
      if(this.life<=0)this.dead=true;
      for(const p of game.wild) {
        if(p._removed)continue;
        // La colisión de movimiento permanece en los pies, pero los objetos lanzados
        // impactan contra el cuerpo visible del Pokémon.
        const profile=game.sprites.getCaptureProfile(p.species,p.shiny,1.5);
        const targetX=p.x+profile.offsetX;
        const targetY=p.y+profile.offsetY;
        const itemVisualY=this.y-this.height;
        const d=Math.hypot(this.x-targetX,itemVisualY-targetY);
        if(d<this.radius+profile.radius) {
          if(this.type==='ball') {
            const vl=Math.hypot(this.vx,this.vy)||1;
            const pl=Math.hypot(p.dx,p.dy)||1;
            const dot=(this.vx/vl)*(p.dx/pl)+(this.vy/vl)*(p.dy/pl);
            this.backStrike=dot>0.55;
            game.tryCapture(p,this);
          }
          else if(this.type==='bait'){NS.Audio?.sfx('click',.58);p.applyBait();game.toast(`${p.species.name} se entretiene con el cebo.`);}
          else {NS.Audio?.sfx('hit',.72);p.applyRock();game.toast(`${p.species.name} se enfada. Será más fácil capturarlo, pero más arriesgado.`);}
          this.dead=true; break;
        }
      }
      if(!this.dead){
        for(const o of game.world.obstaclesAround(this.x,this.y,20)) {
          const hit=Math.hypot(this.x-o.x,this.y-o.y)<this.radius+o.radius*.75;
          if(!hit)continue;
          // Los remolinos de agua son interactivos pero no sólidos.
          if(this.type==='rock' && o.special && !o.used){
            NS.Audio?.sfx('hit',.74);
            game.triggerObstacleEncounter(o);
            this.dead=true;
            break;
          }
          if(!o.solid)continue;
          this.dead=true;
          break;
        }
      }
    }
    draw(ctx,game) {
      const x=this.x-game.camera.x+game.width/2,y=this.y-game.camera.y+game.height/2;
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(x,y+3,10,5,0,0,Math.PI*2);ctx.fill();
      if(this.type==='ball'){
        ctx.translate(x,y-10);ctx.rotate(this.spin);ctx.fillStyle='#f2f2ed';ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#dd4b43';ctx.beginPath();ctx.arc(0,0,10,Math.PI,0);ctx.fill();ctx.strokeStyle='#242424';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(10,0);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();
      }else if(this.type==='bait'){ctx.fillStyle='#d79d45';ctx.beginPath();ctx.arc(x,y-8,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f2d66d';ctx.beginPath();ctx.arc(x-3,y-10,2,0,Math.PI*2);ctx.fill();}
      else {ctx.fillStyle='#737b78';ctx.beginPath();ctx.arc(x,y-8,8,0,Math.PI*2);ctx.fill();}
      ctx.restore();
    }
  }

  NS.Player=Player;NS.WildPokemon=WildPokemon;NS.ThrownItem=ThrownItem;NS.clamp=clamp;
})();
