(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if (!NS.Player || !NS.World) {
    console.error("[Pokémon Safari] collision-tuning.js: clases no disponibles.");
    return;
  }

  /*
    Separamos dos conceptos que antes compartían el mismo "radius":

    collisionRadius:
      hitbox física del jugador contra el objeto.

    radius:
      zona de impacto para proyectiles/interacciones.

    Esto soluciona el problema de algunos árboles que parecían no reaccionar
    a las piedras: al reducir la hitbox del tronco también habíamos reducido
    accidentalmente la zona en la que una piedra podía impactar.
  */

  const PreviousPlayer = NS.Player;

  class CompactPlayer extends PreviousPlayer {
    constructor(x=0,y=0,trainerId=0) {
      super(x,y,trainerId);
      this.radius = 9;
    }

    draw(ctx,game,t=0) {
      const x = this.x - game.camera.x + game.width / 2;
      const y = this.y - game.camera.y + game.height / 2;

      ctx.save();

      ctx.fillStyle = 'rgba(0,0,0,.20)';
      ctx.beginPath();
      ctx.ellipse(x,y+2,11,5,0,0,Math.PI*2);
      ctx.fill();

      const drawn = game.trainers?.draw(
        ctx,
        this.trainerId,
        x,
        y,
        this.directionName(),
        this.moving,
        t,
        2.05
      );

      if (!drawn) {
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

  NS.Player = CompactPlayer;

  const previousChunk = NS.World.prototype.chunk;
  const previousResolveCircle = NS.World.prototype.resolveCircle;

  NS.World.prototype.chunk = function (cx,cy) {
    const objects = previousChunk.call(this,cx,cy);

    for (const object of objects) {
      if (object.collisionTunedV2) continue;

      if (object.type === 'tree') {
        // Zona de impacto amplia para piedras.
        object.radius = Math.max(object.radius || 0, 28);

        // Solo el tronco bloquea al jugador.
        object.collisionRadius = 10;
        object.solid = true;
      }

      if (object.type === 'rock') {
        // Las piedras deben ser fáciles de golpear, incluso si su hitbox física
        // es pequeña.
        object.radius = Math.max(object.radius || 0, object.smallRock ? 16 : 22);
        object.collisionRadius = object.smallRock ? 9 : 18;
      }

      object.collisionTunedV2 = true;
    }

    return objects;
  };

  NS.World.prototype.resolveCircle = function (x,y,radius) {
    let px=x;
    let py=y;

    for (const object of this.obstaclesAround(px,py,radius+48)) {
      if (!object.solid) continue;

      const objectRadius =
        object.collisionRadius ??
        object.radius;

      const dx=px-object.x;
      const dy=py-object.y;
      const distance=Math.hypot(dx,dy);
      const minimum=radius+objectRadius;

      if (distance < minimum) {
        const nx=distance>.001 ? dx/distance : 1;
        const ny=distance>.001 ? dy/distance : 0;

        px=object.x+nx*minimum;
        py=object.y+ny*minimum;
      }
    }

    return {x:px,y:py};
  };

  console.info("[Pokémon Safari] Colisiones físicas e interacción separadas.");
})();
