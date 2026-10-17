(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  /*
    Fuente principal de sprites:
      /assets/pokemon/spritecollab/sprite/

    PokeAPI NO se cambia aquí. sprite-fallback.js continúa usando
    raw.githubusercontent.com únicamente cuando SpriteCollab falla.
  */
  const LOCAL_BASE =
    'assets/pokemon/spritecollab/sprite/';

  NS.SPRITE_SOURCES = {
    ...(NS.SPRITE_SOURCES || {}),
    spriteCollabBase:LOCAL_BASE,
    pokeApiFallbackRemote:true
  };

  function localizeSpecies(species) {
    if (!species?.id) return species;

    /*
      Las formas alternativas marcadas como forceStaticSprite usan su
      pokemon_id específico de PokeAPI y deben seguir siendo remotas.
    */
    if (species.forceStaticSprite) {
      return species;
    }

    const key =
      String(species.id).padStart(4,'0');

    const normal =
      `${LOCAL_BASE}${key}`;

    const shiny =
      `${normal}/0000/0001`;

    species.key = key;

    species.walkUrl =
      `${normal}/Walk-Anim.png`;

    species.idleUrl =
      `${normal}/Idle-Anim.png`;

    species.walkShadowUrl =
      `${normal}/Walk-Shadow.png`;

    species.idleShadowUrl =
      `${normal}/Idle-Shadow.png`;

    species.animDataUrl =
      `${normal}/AnimData.xml`;

    species.shinyWalkUrl =
      `${shiny}/Walk-Anim.png`;

    species.shinyIdleUrl =
      `${shiny}/Idle-Anim.png`;

    species.shinyWalkShadowUrl =
      `${shiny}/Walk-Shadow.png`;

    species.shinyIdleShadowUrl =
      `${shiny}/Idle-Shadow.png`;

    species.shinyAnimDataUrl =
      `${shiny}/AnimData.xml`;

    return species;
  }

  function localizeAllLoadedSpecies() {
    if (!Array.isArray(NS.SPECIES)) {
      return;
    }

    for (const species of NS.SPECIES) {
      localizeSpecies(species);
    }
  }

  NS.localizeSpriteCollabSpecies =
    localizeSpecies;

  NS.localizeAllSpriteCollabSpecies =
    localizeAllLoadedSpecies;

  /*
    Kanto y Johto ya existen cuando carga este archivo.
  */
  localizeAllLoadedSpecies();

  /*
    Hoenn-Paldea se cargan de forma asíncrona.
    En cuanto termina all-regions-data.js cambiamos también sus URLs a local.
  */
  window.addEventListener(
    'safari-regions-ready',
    () => {
      localizeAllLoadedSpecies();

      console.info(
        '[Pokémon Safari] Sprites regionales apuntando a SpriteCollab local.'
      );
    }
  );

  console.info(
    '[Pokémon Safari] SpriteCollab local: ' +
    LOCAL_BASE
  );
})();
