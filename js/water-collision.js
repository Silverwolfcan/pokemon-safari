(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if (!NS.Player) {
    console.error("[Pokémon Safari] water-collision.js: NS.Player todavía no existe.");
    return;
  }

  /*
    El jugador ya no puede caminar por el agua.

    Sustituimos únicamente Player.update para poder probar el movimiento por
    ejes. Esto permite deslizarse por la orilla en vez de quedarse bloqueado
    al tocar una esquina de la laguna.
  */
  NS.Player.prototype.update = function (dt, keys, world, speed, swimLevel = 0) {
    let dx =
      (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
      (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);

    let dy =
      (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) -
      (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0);

    const length = Math.hypot(dx, dy);
    this.moving = length > 0;

    if (length > 0) {
      dx /= length;
      dy /= length;
      this.dx = dx;
      this.dy = dy;
    }

    const beforeX = this.x;
    const beforeY = this.y;

    // Al no poder entrar en el agua, la antigua mejora de velocidad de nado
    // deja de afectar al movimiento del jugador.
    const move = speed * dt;

    // Eje X
    if (dx !== 0) {
      const candidate = world.resolveCircle(
        this.x + dx * move,
        this.y,
        this.radius
      );

      if (
        !world.isBlockedWaterAt ||
        !world.isBlockedWaterAt(candidate.x, candidate.y, this.radius)
      ) {
        this.x = candidate.x;
        this.y = candidate.y;
      }
    }

    // Eje Y
    if (dy !== 0) {
      const candidate = world.resolveCircle(
        this.x,
        this.y + dy * move,
        this.radius
      );

      if (
        !world.isBlockedWaterAt ||
        !world.isBlockedWaterAt(candidate.x, candidate.y, this.radius)
      ) {
        this.x = candidate.x;
        this.y = candidate.y;
      }
    }

    return Math.hypot(
      this.x - beforeX,
      this.y - beforeY
    );
  };

  console.info("[Pokémon Safari] Colisión del jugador con lagunas activada.");
})();
