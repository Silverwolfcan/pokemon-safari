(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if (!NS.Game || !NS.WildPokemon) {
    console.error("[Pokémon Safari] gameplay-fixes.js: clases necesarias no disponibles.");
    return;
  }

  /*
    1) Una piedra hace huir al Pokémon exactamente como si el jugador se
       hubiera acercado demasiado.
  */
  const previousStart = NS.Game.prototype.start;
  NS.Game.prototype.start = function () {
    if (NS.activeGame && NS.activeGame !== this) {
      try {
        NS.activeGame.running = false;
        NS.activeGame.paused = false;
        NS.activeGame.keys = {};
        NS.activeGame.unbindInput?.();
      } catch (_) {}
    }

    NS.activeGame = this;
    return previousStart.call(this);
  };

  const previousEnd = NS.Game.prototype.end;
  NS.Game.prototype.end = function (reason) {
    const result = previousEnd.call(this, reason);
    if (NS.activeGame === this) NS.activeGame = null;
    return result;
  };

  NS.WildPokemon.prototype.applyRock = function () {
    // Mismo flujo de huida que por proximidad: sin penalización extra.
    this.rockProvoked = false;
    this.beginFlee(NS.activeGame);
  };

  /*
    4) Estrella del radar shiny en amarillo.
  */
  NS.WildPokemon.prototype.drawShinyCapturedMarker = function (ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(52,42,5,.92)';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fff1a0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffd83d';
    ctx.strokeStyle = '#8a6a00';
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 === 0 ? 7 : 3.2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  /*
    5) Encuentros de árbol/roca/agua:
       buscamos una posición completamente dentro del mismo bioma.
  */
  function findInteriorSpawn(game, obstacle, habitat) {
    const world = game.world;

    const rings = [64, 88, 112, 136];

    // Dirección hacia el centro del chunk como primera opción.
    const size = world.cfg.chunkSize;
    const chunkX = Math.floor(obstacle.x / size);
    const chunkY = Math.floor(obstacle.y / size);
    const centerX = chunkX * size + size / 2;
    const centerY = chunkY * size + size / 2;
    const inwardAngle = Math.atan2(
      centerY - obstacle.y,
      centerX - obstacle.x
    );

    const angles = [inwardAngle];

    for (let i = 0; i < 24; i++) {
      angles.push((Math.PI * 2 * i) / 24);
    }

    for (const distance of rings) {
      for (const angle of angles) {
        const rawX = obstacle.x + Math.cos(angle) * distance;
        const rawY = obstacle.y + Math.sin(angle) * distance;

        if (world.habitatAt(rawX, rawY) !== habitat) continue;

        const resolved = world.resolveCircle(rawX, rawY, 20);

        if (world.habitatAt(resolved.x, resolved.y) !== habitat) continue;

        // Dejamos un margen adicional respecto al borde del bioma.
        const margin = 36;
        const probes = [
          [ margin, 0],
          [-margin, 0],
          [0, margin],
          [0,-margin]
        ];

        const safelyInside = probes.every(([dx, dy]) =>
          world.habitatAt(resolved.x + dx, resolved.y + dy) === habitat
        );

        if (!safelyInside) continue;

        return resolved;
      }
    }

    // Último recurso: el propio objeto, que sí pertenece al bioma correcto.
    const fallback = world.resolveCircle(obstacle.x, obstacle.y, 20);
    return fallback;
  }

  NS.Game.prototype.triggerObstacleEncounter = function (obstacle) {
    if (!obstacle?.special || obstacle.used) return;
    obstacle.used = true;

    const triggerType =
      obstacle.type === 'tree'
        ? 'tree'
        : obstacle.type === 'waterSpot'
          ? 'waterSpot'
          : 'rock';

    const habitat =
      obstacle.biome ||
      this.world.habitatAt(obstacle.x, obstacle.y);

    const position = findInteriorSpawn(this, obstacle, habitat);

    const pokemon = this.spawnPokemon(
      habitat,
      position,
      triggerType
    );

    if (pokemon) {
      pokemon.state = 'alert';
      pokemon.stateTimer = 1.2;

      this.toast(
        triggerType === 'tree'
          ? `¡Algo cayó del árbol! Ha aparecido ${pokemon.species.name}.`
          : triggerType === 'waterSpot'
            ? `¡Algo se movía bajo el agua! Ha aparecido ${pokemon.species.name}.`
            : `¡La roca escondía algo! Ha aparecido ${pokemon.species.name}.`
      );
    } else {
      this.toast(
        triggerType === 'tree'
          ? 'El árbol estaba vacío.'
          : triggerType === 'waterSpot'
            ? 'No había nada bajo el agua.'
            : 'No había nada escondido en la roca.'
      );
    }
  };

  console.info("[Pokémon Safari] Correcciones de huida, radar y encuentros activadas.");
})();
