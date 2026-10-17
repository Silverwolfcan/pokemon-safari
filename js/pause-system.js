(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if (!NS.Game) {
    console.error("[Pokémon Safari] pause-system.js: Game no existe.");
    return;
  }

  const originalBindInput = NS.Game.prototype.bindInput;
  const originalUnbindInput = NS.Game.prototype.unbindInput;
  const originalLoop = NS.Game.prototype.loop;

  function $(id) {
    return document.getElementById(id);
  }

  function showOverlay(id, visible) {
    const el = $(id);
    if (!el) return;
    el.classList.toggle('hidden', !visible);
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  NS.Game.prototype.pause = function () {
    if (!this.running || this.paused) return;

    this.paused = true;
    this.keys = {};
    showOverlay('pauseOverlay', true);
  };

  NS.Game.prototype.resume = function () {
    if (!this.running || !this.paused) return;

    this.paused = false;
    this.last = performance.now();
    showOverlay('pauseOverlay', false);
    showOverlay('abandonConfirmOverlay', false);
  };

  NS.Game.prototype.requestAbandon = function () {
    if (!this.running) return;
    showOverlay('pauseOverlay', false);
    showOverlay('abandonConfirmOverlay', true);
  };

  NS.Game.prototype.cancelAbandon = function () {
    showOverlay('abandonConfirmOverlay', false);
    showOverlay('pauseOverlay', true);
  };

  NS.Game.prototype.confirmAbandon = function () {
    showOverlay('abandonConfirmOverlay', false);
    showOverlay('pauseOverlay', false);
    this.paused = false;
    this.end('Expedición abandonada');
  };

  /*
    Sustituimos únicamente el manejo de ESC.
    El resto de input conserva el comportamiento actual.
  */
  NS.Game.prototype.bindInput = function () {
    originalBindInput.call(this);

    // El handler original termina la run con ESC.
    // Lo neutralizamos antes de que llegue a window usando captura.
    this._pauseEscape = event => {
      if (event.code !== 'Escape' || !this.running) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      if ($('abandonConfirmOverlay') &&
          !$('abandonConfirmOverlay').classList.contains('hidden')) {
        this.cancelAbandon();
        return;
      }

      if (this.paused) {
        this.resume();
      } else {
        this.pause();
      }
    };

    window.addEventListener(
      'keydown',
      this._pauseEscape,
      true
    );
  };

  NS.Game.prototype.unbindInput = function () {
    if (this._pauseEscape) {
      window.removeEventListener(
        'keydown',
        this._pauseEscape,
        true
      );
    }

    originalUnbindInput.call(this);
  };

  NS.Game.prototype.loop = function (now) {
    if (!this.running) return;

    if (this.paused) {
      this.draw(now);
      requestAnimationFrame(this.boundLoop);
      return;
    }

    return originalLoop.call(this,now);
  };

  document.addEventListener('DOMContentLoaded', () => {
    $('resumeRunBtn')?.addEventListener('click', () =>
      NS.activeGame?.resume()
    );

    $('abandonRunBtn')?.addEventListener('click', () =>
      NS.activeGame?.requestAbandon()
    );

    $('cancelAbandonBtn')?.addEventListener('click', () =>
      NS.activeGame?.cancelAbandon()
    );

    $('confirmAbandonBtn')?.addEventListener('click', () =>
      NS.activeGame?.confirmAbandon()
    );
  });

  console.info("[Pokémon Safari] Menú de pausa activado (compatible con vuelta desde ajustes).");
})();
