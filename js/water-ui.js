(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if (!NS.Game) {
    console.error("[Pokémon Safari] water-ui.js: NS.Game todavía no existe.");
    return;
  }

  /*
    El antiguo HUD añadía "Vadeando" siempre que se estaba dentro del
    bioma water. Ahora el bioma es una costa arenosa y el jugador no puede
    entrar en la laguna, así que mostramos únicamente su nombre.
  */
  NS.Game.prototype.pushHud = function () {
    const habitat = this.world.habitatAt(this.player.x, this.player.y);

    this.onHud?.({
      balls: this.balls,
      steps: this.steps,
      timeLeft: this.timeLeft,
      habitat,
      habitatName: NS.HABITATS[habitat]?.name || habitat,
      bait: this.bait,
      rocks: this.rocks,
      captures: this.captures,
      tool: this.tool,
      charging: this.mouse.left || this.mouse.right,
      charge: this.mouse.left ? this.mouse.charge : this.mouse.rightCharge,
      noBallsGrace: this.balls <= 0
        ? Math.max(0, this.noBallsGrace)
        : null
    });
  };

  console.info("[Pokémon Safari] HUD de costa actualizado.");
})();
