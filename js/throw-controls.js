(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if (!NS.Game) {
    console.error("[Pokémon Safari] throw-controls.js: Game no existe.");
    return;
  }

  NS.CONFIG.baseThrowCooldown = 1.5;
  NS.CONFIG.minThrowCooldown = 0.5;
  NS.CONFIG.throwCooldownPerUpgrade = 0.2;

  if (!NS.SHOP_ITEMS.some(item => item.id === 'throwCooldown')) {
    NS.SHOP_ITEMS.push({
      id:'throwCooldown',
      name:'Técnica de lanzamiento',
      desc:'Reduce 0,2 s el tiempo entre lanzamientos. De 1,5 s hasta un mínimo de 0,5 s.',
      baseCost:160,
      max:5
    });
  }

  NS.Game.prototype.throwCooldownDuration = function () {
    const level = this.upgrades.throwCooldown || 0;

    return Math.max(
      NS.CONFIG.minThrowCooldown,
      NS.CONFIG.baseThrowCooldown -
        level * NS.CONFIG.throwCooldownPerUpgrade
    );
  };

  const previousUpdate = NS.Game.prototype.update;

  NS.Game.prototype.update = function (dt) {
    this.throwCooldownRemaining = Math.max(
      0,
      (this.throwCooldownRemaining || 0) - dt
    );

    return previousUpdate.call(this,dt);
  };

  /*
    Sustituimos el input del Game antes de que se construyan las partidas.

    Reglas:
    - un único cooldown compartido para Ball / piedra / cebo;
    - mientras apuntas con Ball no puedes iniciar apuntado secundario;
    - mientras apuntas con piedra/cebo no puedes iniciar Ball;
    - durante el cooldown no puedes empezar a cargar otro lanzamiento.
  */
  NS.Game.prototype.bindInput = function () {
    this.throwCooldownRemaining = 0;
    this.lastThrownType = this.lastThrownType || 'ball';
    this.selectedThrowDisplay = this.selectedThrowDisplay || this.tool || 'bait';

    this._keydown = event => {
      if (
        ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space']
          .includes(event.code)
      ) {
        event.preventDefault();
      }

      this.keys[event.code] = true;

      // ESC lo intercepta pause-system.js en captura.
      if (event.code === 'Escape') {
        this.end('Expedición abandonada');
      }
    };

    this._keyup = event => {
      this.keys[event.code] = false;
    };

    this._mousemove = event => {
      const rect = this.canvas.getBoundingClientRect();

      this.mouse.x =
        (event.clientX - rect.left) *
        this.canvas.width / rect.width;

      this.mouse.y =
        (event.clientY - rect.top) *
        this.canvas.height / rect.height;
    };

    this._mousedown = event => {
      event.preventDefault();

      if ((this.throwCooldownRemaining || 0) > 0) {
        return;
      }

      // Ball: solo si no se está apuntando con herramienta secundaria.
      if (
        event.button === 0 &&
        !this.mouse.right &&
        !this.mouse.left &&
        this.balls > 0
      ) {
        this.mouse.left = true;
        this.mouse.charge = 0;
        this.lastThrownType = 'ball';
        this.selectedThrowDisplay = 'ball';
        return;
      }

      // Piedra / cebo: solo si no se está apuntando con Ball.
      if (
        event.button === 2 &&
        !this.mouse.left &&
        !this.mouse.right &&
        this.resourceForTool() > 0
      ) {
        this.mouse.right = true;
        this.mouse.rightCharge = 0;
        this.lastThrownType = this.tool;
        this.selectedThrowDisplay = this.tool;
      }
    };

    this._mouseup = event => {
      if (event.button === 0 && this.mouse.left) {
        this.mouse.left = false;

        this.lastThrownType = 'ball';

        this.throwItem(
          'ball',
          this.mouse.charge
        );

        this.mouse.charge = 0;
        this.throwCooldownRemaining =
          this.throwCooldownDuration();

        return;
      }

      if (event.button === 2 && this.mouse.right) {
        this.mouse.right = false;

        this.lastThrownType = this.tool;

        this.throwItem(
          this.tool,
          this.mouse.rightCharge
        );

        this.mouse.rightCharge = 0;
        this.throwCooldownRemaining =
          this.throwCooldownDuration();
      }
    };

    this._wheel = event => {
      event.preventDefault();

      // No cambiar herramienta a mitad de apuntado.
      if (this.mouse.left || this.mouse.right) return;

      this.tool =
        this.tool === 'bait'
          ? 'rock'
          : 'bait';

      // Reflejar al instante qué herramienta secundaria está seleccionada.
      this.selectedThrowDisplay = this.tool;

      this.pushHud();
    };

    this._context = event =>
      event.preventDefault();

    window.addEventListener('keydown',this._keydown);
    window.addEventListener('keyup',this._keyup);
    this.canvas.addEventListener('mousemove',this._mousemove);
    this.canvas.addEventListener('mousedown',this._mousedown);
    window.addEventListener('mouseup',this._mouseup);
    this.canvas.addEventListener(
      'wheel',
      this._wheel,
      {passive:false}
    );
    this.canvas.addEventListener(
      'contextmenu',
      this._context
    );
  };

  console.info("[Pokémon Safari] Cooldown y exclusión de apuntado activados.");
})();
