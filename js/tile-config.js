(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  /*
    TILESET LOCAL
    -------------
    Coloca tu PNG en:

      assets/tiles/world-tileset.png

    El juego ya usa una cuadrícula de tiles de 16x16 px para el suelo.
    world.js toma la URL desde NS.VISUAL_ASSETS.worldTiles.url.

    Si más adelante usamos otro atlas o cambia el tamaño del tile,
    solo tendrás que modificar este archivo.
  */

  NS.VISUAL_ASSETS = NS.VISUAL_ASSETS || {};

  NS.VISUAL_ASSETS.worldTiles = {
    url: 'assets/tiles/world-tileset.png',
    tileSize: 16
  };

  // Información de referencia para futuras ampliaciones del atlas.
  NS.LOCAL_TILESET = {
    url: 'assets/tiles/world-tileset.png',
    tileSize: 16,

    /*
      Coordenadas actuales utilizadas por world.js.

      Cada pareja [x, y] representa la esquina superior izquierda
      de un tile dentro del PNG.

      Con un tile de 16 px:
        [0, 0]   = columna 0, fila 0
        [16, 0]  = columna 1, fila 0
        [0, 16]  = columna 0, fila 1

      Estas coordenadas corresponden a la integración actual del
      tileset Puny World. Si usas otra imagen distinta, habrá que
      adaptar esta tabla en la siguiente iteración.
    */
    ground: {
      meadow: [
        [0, 0], [16, 0], [32, 0],
        [48, 0], [64, 0], [80, 0]
      ],

      forest: [
        [0, 0], [16, 0], [32, 0],
        [48, 0], [64, 0], [80, 0]
      ],

      water: [
        [0, 48], [16, 48], [32, 48],
        [48, 48], [64, 48], [80, 48]
      ],

      mountain: [
        [0, 16], [16, 16], [32, 16],
        [48, 16], [64, 16], [80, 16]
      ],

      volcano: [
        [0, 16], [16, 16], [32, 16],
        [48, 16], [64, 16], [80, 16]
      ],

      special: [
        [0, 0], [16, 0], [32, 0],
        [48, 0], [64, 0], [80, 0]
      ]
    }
  };

  console.info(
    '[Pokémon Safari] Tileset local configurado:',
    NS.VISUAL_ASSETS.worldTiles.url
  );
})();
