(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if(!NS.World || !NS.Game) {
    console.error('[Pokémon Safari] depth-render.js: clases necesarias no disponibles.');
    return;
  }

  NS.Game.prototype.draw=function(t) {
    const ctx=this.ctx;

    ctx.clearRect(0,0,this.width,this.height);

    this.world.drawGroundOnly(
      ctx,
      this.camera,
      this.width,
      this.height
    );

    const visibleObjects=this.world.visibleObjects(
      this.camera,
      this.width,
      this.height
    );

    /*
      Capa de suelo:
      flores, setas, hierbas, pequeñas ramas y otros detalles bajos se dibujan
      ANTES que cualquier Pokémon o personaje. Nunca ocultan sus pies/cuerpo.
    */
    visibleObjects
      .filter(object=>object.renderLayer==='ground')
      .sort((a,b)=>a.y-b.y)
      .forEach(object=>this.world.drawObstacle(
        ctx,
        object,
        this.camera,
        this.width,
        this.height
      ));

    const renderables=[];

    for(const object of visibleObjects) {
      if(object.renderLayer==='ground') continue;

      renderables.push({
        y:object.y,
        draw:()=>this.world.drawObstacle(
          ctx,
          object,
          this.camera,
          this.width,
          this.height
        )
      });
    }

    for(const pokemon of this.wild) {
      renderables.push({
        y:pokemon.y,
        draw:()=>pokemon.draw(ctx,this,t)
      });
    }

    renderables.push({
      y:this.player.y,
      draw:()=>this.player.draw(ctx,this,t)
    });

    renderables
      .sort((a,b)=>a.y-b.y)
      .forEach(item=>item.draw());

    // Objetos lanzados por encima del plano de entidades.
    for(const item of this.items) {
      item.draw(ctx,this);
    }

    this.drawAim(ctx);
    this.drawShinyIndicators(ctx,t);
  };

  console.info('[Pokémon Safari] Depth sorting V2.5: decoración baja en capa de suelo.');
})();
