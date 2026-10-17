(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if (!NS.SpriteRepository) {
    console.error("[Pokémon Safari] sprite-fallback.js: SpriteRepository no existe.");
    return;
  }

  /*
    Fallback genérico para cualquier Pokémon cuyo sprite PMD/SpriteCollab
    no pueda cargarse.

    Normal:
      https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png

    Shiny:
      https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/{id}.png
  */

  const staticCache = new WeakMap();

  function cacheFor(repository) {
    if (!staticCache.has(repository)) {
      staticCache.set(repository, new Map());
    }

    return staticCache.get(repository);
  }

  function urlFor(species, shiny) {
    const id = Number(species?.spritePokemonId || species?.pokemonId || species?.id || 0);

    if (!id) return null;

    return shiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  }

  function entryFor(repository, species, shiny) {
    const cache = cacheFor(repository);
    const key = `${species.id}:${shiny ? 'shiny' : 'normal'}`;

    if (!cache.has(key)) {
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

      img.src = urlFor(species,shiny);
      cache.set(key,entry);
    }

    return cache.get(key);
  }

  function drawStatic(
    repository,
    ctx,
    species,
    x,
    y,
    scale = 1.45,
    alpha = 1,
    shiny = false
  ) {
    const entry = entryFor(
      repository,
      species,
      shiny
    );

    if (!entry?.ready || !entry.img.naturalWidth) {
      return false;
    }

    const img = entry.img;

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

  function originalEntryFailed(repository, species, shiny) {
    try {
      const entry = repository.get(species,shiny);
      return Boolean(entry?.failed);
    } catch {
      return true;
    }
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
    const entry = species?.forceStaticSprite
      ? null
      : this.get(species,shiny);

    /*
      Las formas alternativas usan directamente su pokemon_id específico
      de PokeAPI. Para especies normales solo hacemos fallback cuando
      SpriteCollab ha fallado.
    */
    if (species?.forceStaticSprite || entry?.failed) {
      if (
        drawStatic(
          this,
          ctx,
          species,
          x,
          y,
          scale,
          alpha,
          shiny
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
    if (species?.forceStaticSprite || originalEntryFailed(this,species,shiny)) {
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
    const entry = species?.forceStaticSprite
      ? { failed:true }
      : this.get(species,shiny);

    if (!entry?.failed) {
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

    const staticEntry = entryFor(
      this,
      species,
      shiny
    );

    if (
      !staticEntry?.ready ||
      !staticEntry.img.naturalWidth
    ) {
      // Mientras carga el PNG estático dejamos el preview vacío.
      return;
    }

    const img = staticEntry.img;
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
      offCtx.drawImage(
        img,
        dx,
        dy,
        dw,
        dh
      );

      offCtx.globalCompositeOperation =
        'source-in';

      offCtx.fillStyle = '#050807';
      offCtx.fillRect(
        0,
        0,
        width,
        height
      );

      ctx.drawImage(off,0,0);
    } else {
      ctx.drawImage(
        img,
        dx,
        dy,
        dw,
        dh
      );
    }

    ctx.restore();
  };

  console.info("[Pokémon Safari] Fallback genérico de sprites PokeAPI activado.");
})();
