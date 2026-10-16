(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  class Game {
    constructor(canvas,save,onEnd,onHud,onToast) {
      this.canvas=canvas;
      this.ctx=canvas.getContext('2d');
      this.save=save;
      this.onEnd=onEnd;
      this.onHud=onHud;
      this.onToast=onToast;

      this.width=canvas.width;
      this.height=canvas.height;
      this.upgrades=save.upgrades;
      this.world=new NS.World(NS.CONFIG,this.upgrades.habitatLicense||0);
      this.sprites=new NS.SpriteRepository();
      this.trainers=new NS.TrainerRepository(save.profile||{});
      this.player=new NS.Player(0,0,save.profile?.trainerId||0);

      this.keys={};
      this.mouse={x:this.width/2,y:this.height/2,left:false,right:false,charge:0,rightCharge:0};
      this.camera={x:0,y:0};
      this.wild=[];
      this.items=[];
      this.running=false;
      this.spawnTimer=0;
      this.distanceBuffer=0;
      this.captures=0;
      this.newEntries=[];
      this.coinsEarned=0;
      this.tool='bait';
      this.lastHabitat='meadow';
      this.config=NS.CONFIG;
      this.noBallsGrace=-1;
      this.playtimeSaveTimer=0;

      this.balls=NS.CONFIG.baseBalls+(this.upgrades.balls||0)*4;
      this.steps=NS.CONFIG.baseSteps+(this.upgrades.steps||0)*250;
      this.bait=NS.CONFIG.baseBait+(this.upgrades.supplies||0)*2;
      this.rocks=NS.CONFIG.baseRocks+(this.upgrades.supplies||0)*2;
      this.timeLeft=NS.CONFIG.baseTime+(this.upgrades.time||0)*NS.CONFIG.timePerUpgrade;

      this.boundLoop=t=>this.loop(t);
      this.bindInput();
    }

    bindInput(){
      this._keydown=e=>{
        if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
        this.keys[e.code]=true;
        if(e.code==='Escape')this.end('Expedición abandonada');
      };
      this._keyup=e=>{this.keys[e.code]=false;};
      this._mousemove=e=>{
        const r=this.canvas.getBoundingClientRect();
        this.mouse.x=(e.clientX-r.left)*this.canvas.width/r.width;
        this.mouse.y=(e.clientY-r.top)*this.canvas.height/r.height;
      };
      this._mousedown=e=>{
        e.preventDefault();
        if(e.button===0&&this.balls>0){this.mouse.left=true;this.mouse.charge=0;}
        if(e.button===2&&this.resourceForTool()>0){this.mouse.right=true;this.mouse.rightCharge=0;}
      };
      this._mouseup=e=>{
        if(e.button===0&&this.mouse.left){this.mouse.left=false;this.throwItem('ball',this.mouse.charge);this.mouse.charge=0;}
        if(e.button===2&&this.mouse.right){this.mouse.right=false;this.throwItem(this.tool,this.mouse.rightCharge);this.mouse.rightCharge=0;}
      };
      this._wheel=e=>{
        e.preventDefault();
        this.tool=this.tool==='bait'?'rock':'bait';
        this.pushHud();
      };
      this._context=e=>e.preventDefault();

      window.addEventListener('keydown',this._keydown);
      window.addEventListener('keyup',this._keyup);
      this.canvas.addEventListener('mousemove',this._mousemove);
      this.canvas.addEventListener('mousedown',this._mousedown);
      window.addEventListener('mouseup',this._mouseup);
      this.canvas.addEventListener('wheel',this._wheel,{passive:false});
      this.canvas.addEventListener('contextmenu',this._context);
    }

    unbindInput(){
      window.removeEventListener('keydown',this._keydown);
      window.removeEventListener('keyup',this._keyup);
      this.canvas.removeEventListener('mousemove',this._mousemove);
      this.canvas.removeEventListener('mousedown',this._mousedown);
      window.removeEventListener('mouseup',this._mouseup);
      this.canvas.removeEventListener('wheel',this._wheel);
      this.canvas.removeEventListener('contextmenu',this._context);
    }

    start(){
      this.running=true;
      this.last=performance.now();
      for(let i=0;i<6;i++)this.spawnPokemon();
      this.pushHud();
      requestAnimationFrame(this.boundLoop);
    }

    loop(now){
      if(!this.running)return;
      const dt=Math.min(.033,(now-this.last)/1000);
      this.last=now;
      this.update(dt);
      this.draw(now);
      requestAnimationFrame(this.boundLoop);
    }

    resourceForTool(){return this.tool==='bait'?this.bait:this.rocks;}

    update(dt){
      this.timeLeft=Math.max(0,this.timeLeft-dt);
      if(this.timeLeft<=0){
        this.end('Se ha agotado el tiempo');
        return;
      }

      const moved=this.player.update(dt,this.keys,this.world,NS.CONFIG.playerSpeed,this.upgrades.swimSpeed||0);
      const found=this.world.collectLooseResources(this.player.x,this.player.y,NS.CONFIG.looseStonePickupRadius||30);
      if(found.stones>0){
        const multiplier=1+(this.upgrades.stoneGathering||0);
        const gained=found.stones*multiplier;
        this.rocks+=gained;
        NS.Audio?.sfx('pickup',.68);
        this.toast(`Has recogido ${gained===1?'una piedra':gained+' piedras'}${multiplier>1?` (x${multiplier})`:''}.`);
      }
      if(found.bait>0){
        this.bait+=found.bait;
        NS.Audio?.sfx('pickup',.72);
        this.toast(`Has encontrado ${found.bait===1?'un cebo':found.bait+' cebos'}.`);
      }

      // Tiempo de juego: solo se contabiliza mientras una expedición está activa.
      this.save.totalRunSeconds=(this.save.totalRunSeconds||0)+dt;
      this.playtimeSaveTimer+=dt;
      if(this.playtimeSaveTimer>=5){
        this.playtimeSaveTimer=0;
        NS.Storage.save(this.save);
      }
      this.distanceBuffer+=moved;
      while(this.distanceBuffer>=NS.CONFIG.stepPixels){
        this.distanceBuffer-=NS.CONFIG.stepPixels;
        this.steps--;
        if(this.steps<=0){
          this.steps=0;
          this.end('Ya no puedes andar mas, estas agotado');
          return;
        }
      }

      this.camera.x+=(this.player.x-this.camera.x)*Math.min(1,dt*7);
      this.camera.y+=(this.player.y-this.camera.y)*Math.min(1,dt*7);

      const habitat=this.world.habitatAt(this.player.x,this.player.y);
      if(habitat!==this.lastHabitat){
        this.lastHabitat=habitat;
        this.toast(`Has entrado en: ${NS.HABITATS[habitat]?.name||habitat}`);
      }

      if(this.mouse.left)this.mouse.charge=Math.min(1,this.mouse.charge+dt/1.2);
      if(this.mouse.right)this.mouse.rightCharge=Math.min(1,this.mouse.rightCharge+dt/1.0);

      this.spawnTimer-=dt;
      if(this.spawnTimer<=0&&this.wild.length<NS.CONFIG.maxWild){
        this.spawnPokemon();
        this.spawnTimer=.75+Math.random()*1.4;
      }

      for(const p of this.wild)p.update(dt,this);
      for(const it of this.items)it.update(dt,this);

      this.items=this.items.filter(i=>!i.dead);
      this.wild=this.wild.filter(p=>!p._removed&&Math.hypot(p.x-this.player.x,p.y-this.player.y)<NS.CONFIG.despawnDistance);

      if(this.balls<=0){
        if(this.noBallsGrace<0)this.noBallsGrace=NS.CONFIG.noBallsGraceTime||5;
        this.noBallsGrace-=dt;
        if(this.noBallsGrace<=0){
          this.end('No te quedan Poké Balls');
          return;
        }
      }else{
        this.noBallsGrace=-1;
      }

      this.pushHud();
    }

    chooseWeighted(pool){
      if(!pool.length)return null;
      let total=pool.reduce((a,s)=>a+s.weight,0);
      let roll=Math.random()*total;
      for(const s of pool){
        roll-=s.weight;
        if(roll<=0)return s;
      }
      return pool[pool.length-1];
    }

    spawnPokemon(habitatOverride=null,positionOverride=null,triggerType=null){
      const license=this.upgrades.habitatLicense||0;
      let habitat=habitatOverride;

      let x,y;
      if(positionOverride){
        x=positionOverride.x;
        y=positionOverride.y;
      }else{
        const a=Math.random()*Math.PI*2;
        const r=NS.CONFIG.spawnMinDistance+Math.random()*(NS.CONFIG.spawnMaxDistance-NS.CONFIG.spawnMinDistance);
        x=this.player.x+Math.cos(a)*r;
        y=this.player.y+Math.sin(a)*r;
      }

      if(!habitat)habitat=this.world.habitatAt(x,y);
      const pool=NS.speciesForHabitat(habitat,license,triggerType);
      // Los encuentros provocados al golpear elementos del escenario están pensados
      // como una forma activa de buscar especies menos frecuentes.
      const encounterPool=triggerType ? pool.map(s=>({
        ...s,
        weight:s.weight*(s.rarity==='uncommon'?2.25:s.rarity==='rare'?3.5:1)
      })) : pool;
      const sp=this.chooseWeighted(encounterPool);
      if(!sp)return null;

      const shinyChance=NS.CONFIG.shinyBaseChance*Math.pow(2,this.upgrades.shinyCharm||0);
      const shiny=Math.random()<shinyChance;
      const pos=this.world.resolveCircle(x,y,20);
      const pokemon=new NS.WildPokemon(sp,pos.x,pos.y,shiny);
      this.wild.push(pokemon);
      if(shiny) NS.Audio?.sfx('shinySpawn',.92);
      return pokemon;
    }

    triggerObstacleEncounter(obstacle){
      if(!obstacle?.special||obstacle.used)return;
      obstacle.used=true;

      const triggerType=obstacle.type==='tree'?'tree':obstacle.type==='waterSpot'?'waterSpot':'rock';
      const habitat=obstacle.biome||this.world.habitatAt(obstacle.x,obstacle.y);

      const angle=Math.random()*Math.PI*2;
      const distance=55+Math.random()*35;
      const p=this.spawnPokemon(
        habitat,
        {
          x:obstacle.x+Math.cos(angle)*distance,
          y:obstacle.y+Math.sin(angle)*distance
        },
        triggerType
      );

      if(p){
        p.state='alert';
        p.stateTimer=1.2;
        this.toast(
          triggerType==='tree'
            ? `¡Algo cayó del árbol! Ha aparecido ${p.species.name}.`
            : triggerType==='waterSpot'
              ? `¡Algo se movía bajo el agua! Ha aparecido ${p.species.name}.`
              : `¡La roca escondía algo! Ha aparecido ${p.species.name}.`
        );
      }else{
        this.toast(
          triggerType==='tree' ? 'El árbol estaba vacío.' :
          triggerType==='waterSpot' ? 'No había nada bajo el agua.' :
          'No había nada escondido en la roca.'
        );
      }
    }

    throwItem(type,charge){
      if(type==='ball'){
        if(this.balls<=0)return;
        this.balls--;
        if(this.balls===0){this.noBallsGrace=NS.CONFIG.noBallsGraceTime||5;this.toast(`¡Última Poké Ball! La expedición terminará en ${Math.ceil(this.noBallsGrace)} s.`);}
      }else if(type==='bait'){
        if(this.bait<=0)return;
        this.bait--;
      }else{
        if(this.rocks<=0)return;
        this.rocks--;
      }

      const worldMouse={
        x:this.mouse.x-this.width/2+this.camera.x,
        y:this.mouse.y-this.height/2+this.camera.y
      };

      let dx=worldMouse.x-this.player.x,dy=worldMouse.y-this.player.y;
      const l=Math.hypot(dx,dy)||1;
      dx/=l;dy/=l;

      const speed=260+charge*520;
      NS.Audio?.sfx(type==='ball'?'pickup':'click', type==='ball'?.85:.72);
      this.items.push(new NS.ThrownItem(
        type,
        this.player.x+dx*25,
        this.player.y+dy*25,
        dx*speed,
        dy*speed,
        charge
      ));
      this.pushHud();
    }

    tryCapture(p,item){
      const first=!this.save.dex[p.species.id];
      const powerBonus=.88+item.power*.20;
      const skillBonus=1+(this.upgrades.capture||0)*.04;

      const backBonus=item.backStrike?(NS.CONFIG.backCatchBonus||1.35):1;
      let chance=p.species.catchRate*p.catchMultiplier()*powerBonus*skillBonus*backBonus;
      chance=Math.max(.06,Math.min(.94,chance));

      if(Math.random()<chance){
        p._removed=true;
        this.captures++;

        const dex=this.save.dex[p.species.id]||{count:0,shiny:0};
        dex.count++;
        if(p.shiny)dex.shiny++;
        this.save.dex[p.species.id]=dex;

        const reward=Math.round(p.species.value*(first?3:1)*(p.shiny?4:1));
        this.save.coins+=reward;
        this.coinsEarned+=reward;
        this.save.totalCaptures++;
        if(first)this.newEntries.push(p.species.id);

        NS.Storage.save(this.save);
        NS.Audio?.sfx('capture',.86);
        if(first||p.shiny) setTimeout(()=>NS.Audio?.sfx('specialCapture',p.shiny?.95:.84),170);
        this.toast(`${item.backStrike?'🎯 Espalda · ':''}${p.shiny?'★ ':''}${p.species.name} capturado · +${reward} monedas${first?' · ¡Nueva entrada!':''}`);
      }else{
        NS.Audio?.sfx('fail',.72);
        this.toast(`${p.species.name} se ha escapado de la Ball.`);
        if(p.state==='angry'||Math.random()<.34){
          p.beginFlee(this);
        }
      }
    }

    toast(msg){this.onToast?.(msg);}

    pushHud(){
      const habitat=this.world.habitatAt(this.player.x,this.player.y);
      this.onHud?.({
        balls:this.balls,
        steps:this.steps,
        timeLeft:this.timeLeft,
        habitat,
        habitatName:habitat==='water' ? `${NS.HABITATS[habitat]?.name||habitat} · Vadeando` : (NS.HABITATS[habitat]?.name||habitat),
        bait:this.bait,
        rocks:this.rocks,
        captures:this.captures,
        tool:this.tool,
        charging:this.mouse.left||this.mouse.right,
        charge:this.mouse.left?this.mouse.charge:this.mouse.rightCharge,
        noBallsGrace:this.balls<=0?Math.max(0,this.noBallsGrace):null
      });
    }

    draw(t){
      const c=this.ctx;
      c.clearRect(0,0,this.width,this.height);
      this.world.draw(c,this.camera,this.width,this.height);

      const entities=[
        ...this.wild.map(p=>({y:p.y,draw:()=>p.draw(c,this,t)})),
        {y:this.player.y,draw:()=>this.player.draw(c,this,t)}
      ];

      entities.sort((a,b)=>a.y-b.y).forEach(e=>e.draw());
      for(const i of this.items)i.draw(c,this);
      this.drawAim(c);
      this.drawShinyIndicators(c,t);
    }

    drawShinyIndicators(c,t){
      const margin=34, centerX=this.width/2, centerY=this.height/2;
      for(const p of this.wild){
        if(!p.shiny||p._removed)continue;
        const sx=p.x-this.camera.x+centerX, sy=p.y-this.camera.y+centerY;
        if(sx>=margin&&sx<=this.width-margin&&sy>=margin&&sy<=this.height-margin)continue;
        const dx=sx-centerX,dy=sy-centerY,len=Math.hypot(dx,dy)||1;
        const nx=dx/len,ny=dy/len;
        const tx=nx!==0?(nx>0?(this.width-margin-centerX)/nx:(margin-centerX)/nx):Infinity;
        const ty=ny!==0?(ny>0?(this.height-margin-centerY)/ny:(margin-centerY)/ny):Infinity;
        const d=Math.max(0,Math.min(Math.abs(tx),Math.abs(ty)));
        const x=centerX+nx*d,y=centerY+ny*d;
        c.save();c.translate(x,y);c.rotate(Math.atan2(ny,nx));
        c.shadowColor='#ffe66e';c.shadowBlur=12;
        c.fillStyle='#fff0a0';c.strokeStyle='#6d5720';c.lineWidth=2;
        c.beginPath();c.moveTo(15,0);c.lineTo(-10,-9);c.lineTo(-6,0);c.lineTo(-10,9);c.closePath();c.fill();c.stroke();
        c.rotate(-Math.atan2(ny,nx));
        const pulse=2+Math.sin(t*.008)*1.2;
        c.fillStyle='#fff7c2';
        c.fillRect(-2,-19-pulse,4,10);c.fillRect(-5,-16-pulse,10,4);
        c.restore();
      }
    }

    drawAim(c){
      if(!(this.mouse.left||this.mouse.right))return;

      const type=this.mouse.left?'ball':this.tool;
      const charge=this.mouse.left?this.mouse.charge:this.mouse.rightCharge;
      const px=this.player.x-this.camera.x+this.width/2;
      const py=this.player.y-this.camera.y+this.height/2;
      const dx=this.mouse.x-px,dy=this.mouse.y-py;
      const l=Math.hypot(dx,dy)||1,nx=dx/l,ny=dy/l;

      c.save();
      c.setLineDash([8,8]);
      c.strokeStyle=type==='ball'
        ?'rgba(255,255,255,.75)'
        :type==='bait'
          ?'rgba(242,214,109,.8)'
          :'rgba(185,196,191,.8)';
      c.lineWidth=2;
      c.beginPath();
      c.moveTo(px,py);
      c.lineTo(px+nx*(80+charge*260),py+ny*(80+charge*260));
      c.stroke();
      c.restore();
    }

    end(reason){
      if(!this.running)return;
      this.running=false;
      this.unbindInput();
      this.save.runs++;
      NS.Storage.save(this.save);

      NS.Audio?.sfx('gameOver',.6);
      this.onEnd?.({
        reason,
        captures:this.captures,
        coins:this.coinsEarned,
        newEntries:this.newEntries.slice(),
        steps:this.steps,
        balls:this.balls,
        timeLeft:this.timeLeft
      });
    }
  }

  NS.Game=Game;
})();