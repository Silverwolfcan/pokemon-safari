(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if(!NS.Player) {
    console.error('[Pokémon Safari] player-tuning.js: Player no existe.');
    return;
  }

  const BasePlayer=NS.Player;

  class SafariPlayer extends BasePlayer {
    constructor(x=0,y=0,trainerId=0) {
      super(x,y,trainerId);

      /*
        Solo los pies forman parte de la colisión.
        La cabeza/cuerpo del sprite puede superponerse visualmente con árboles.
      */
      this.radius=9;
    }

    update(dt,keys,world,speed,swimLevel=0) {
      const oldX=this.x;
      const oldY=this.y;

      // Dejamos que Player conserve toda su lógica original de input,
      // dirección, animación y colisión con props.
      super.update(dt,keys,world,speed,swimLevel);

      const targetX=this.x;
      const targetY=this.y;

      if(!world?.circleTouchesBlockedPlayerTerrain?.(targetX,targetY,this.radius)) {
        return;
      }

      /*
        Si el movimiento intentó entrar en agua/lava, probamos los ejes por
        separado. Así el personaje se desliza por la orilla en vez de quedarse
        completamente clavado cuando camina en diagonal.
      */
      this.x=oldX;
      this.y=oldY;

      if(Math.abs(targetX-oldX)>.001) {
        const xStep=world.resolveCircle(targetX,oldY,this.radius);
        if(!world.circleTouchesBlockedPlayerTerrain(xStep.x,xStep.y,this.radius)) {
          this.x=xStep.x;
          this.y=xStep.y;
        }
      }

      if(Math.abs(targetY-oldY)>.001) {
        const yStep=world.resolveCircle(this.x,targetY,this.radius);
        if(!world.circleTouchesBlockedPlayerTerrain(yStep.x,yStep.y,this.radius)) {
          this.x=yStep.x;
          this.y=yStep.y;
        }
      }
    }

    draw(ctx,game,t=0) {
      const x=this.x-game.camera.x+game.width/2;
      const y=this.y-game.camera.y+game.height/2;

      ctx.save();

      ctx.fillStyle='rgba(0,0,0,.20)';
      ctx.beginPath();
      ctx.ellipse(x,y+2,11,5,0,0,Math.PI*2);
      ctx.fill();

      const drawn=game.trainers?.draw(
        ctx,
        this.trainerId,
        x,
        y,
        this.directionName(),
        this.moving,
        t,
        2.05
      );

      if(!drawn) {
        ctx.fillStyle='#d7b48c';
        ctx.beginPath();
        ctx.arc(x,y-28,10,0,Math.PI*2);
        ctx.fill();

        ctx.fillStyle='#ece2c7';
        ctx.fillRect(x-9,y-19,18,22);

        ctx.fillStyle='#be4b3c';
        ctx.fillRect(x-11,y-38,22,6);
      }

      ctx.restore();
    }
  }

  NS.Player=SafariPlayer;

  console.info('[Pokémon Safari] Hitbox compacta + bloqueo de agua/lava activado.');
})();
