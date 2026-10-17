(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if (!NS.SpriteRepository) {
    console.error("[Pokémon Safari] flamigo-fallback.js: SpriteRepository no existe.");
    return;
  }

  const FLAMIGO_ID = 973;
  const FLAMIGO_URL =
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/973.png';

  const staticCache = new WeakMap();

  function entryFor(repository) {
    if (!staticCache.has(repository)) {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const entry = {
        img,
        ready:false,
        failed:false
      };

      img.onload = () => {
        entry.ready = true;
      };

      img.onerror = () => {
        entry.failed = true;
      };

      img.src = FLAMIGO_URL;
      staticCache.set(repository,entry);
    }

    return staticCache.get(repository);
  }

  function drawStatic(
    repository,
    ctx,
    x,
    y,
    scale = 1.45,
    alpha = 1
  ) {
    const entry = entryFor(repository);

    if (!entry.ready || !entry.img.naturalWidth) {
      return false;
    }

    const img = entry.img;

    /*
      PokeAPI entrega un sprite estático con margen transparente.
      Lo anclamos por la parte inferior para que se comporte visualmente
      como los sprites PMD del resto del juego.
    */
    const baseSize = 62 * scale;
    const ratio =
      img.naturalWidth /
      Math.max(1,img.naturalHeight);

    const width =
      ratio >= 1
        ? baseSize
        : baseSize * ratio;

    const height =
      ratio >= 1
        ? baseSize / ratio
        : baseSize;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
      img,
      x - width / 2,
      y - height + 8,
      width,
      height
    );

    ctx.restore();
    return true;
  }

  const originalDraw =
    NS.SpriteRepository.prototype.draw;

  NS.SpriteRepository.prototype.draw = function (
    ctx,
    species,
    x,
    y,
    dx,
    dy,
    t,
    moving = true,
    scale = 1.45,
    alpha = 1,
    shiny = false
  ) {
    if (species?.id === FLAMIGO_ID && !shiny) {
      if (
        drawStatic(
          this,
          ctx,
          x,
          y,
          scale,
          alpha
        )
      ) {
        return true;
      }
    }

    return originalDraw.call(
      this,
      ctx,
      species,
      x,
      y,
      dx,
      dy,
      t,
      moving,
      scale,
      alpha,
      shiny
    );
  };

  const originalCaptureProfile =
    NS.SpriteRepository.prototype.getCaptureProfile;

  NS.SpriteRepository.prototype.getCaptureProfile = function (
    species,
    shiny = false,
    scale = 1.5
  ) {
    if (species?.id === FLAMIGO_ID && !shiny) {
      return {
        offsetX:0,
        offsetY:-25,
        radius:25
      };
    }

    return originalCaptureProfile.call(
      this,
      species,
      shiny,
      scale
    );
  };

  const originalPreview =
    NS.SpriteRepository.prototype.drawPreview;

  NS.SpriteRepository.prototype.drawPreview = function (
    ctx,
    species,
    width,
    height,
    t,
    shiny = false,
    silhouette = false
  ) {
    if (species?.id !== FLAMIGO_ID || shiny) {
      return originalPreview.call(
        this,
        ctx,
        species,
        width,
        height,
        t,
        shiny,
        silhouette
      );
    }

    ctx.clearRect(0,0,width,height);

    const entry = entryFor(this);

    if (!entry.ready || !entry.img.naturalWidth) {
      return;
    }

    const img = entry.img;
    const pad = 9;

    const scale = Math.min(
      (width - pad * 2) / img.naturalWidth,
      (height - pad * 2) / img.naturalHeight
    );

    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = (width - dw) / 2;
    const dy = (height - dh) / 2;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (silhouette) {
      const off = document.createElement('canvas');
      off.width = width;
      off.height = height;

      const offCtx = off.getContext('2d');
      offCtx.imageSmoothingEnabled = false;
      offCtx.drawImage(img,dx,dy,dw,dh);
      offCtx.globalCompositeOperation = 'source-in';
      offCtx.fillStyle = '#050807';
      offCtx.fillRect(0,0,width,height);

      ctx.drawImage(off,0,0);
    } else {
      ctx.drawImage(img,dx,dy,dw,dh);
    }

    ctx.restore();
  };

  console.info("[Pokémon Safari] Fallback estático de Flamigo activado.");
})();
