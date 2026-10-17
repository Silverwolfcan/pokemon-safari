(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  /*
    Paletas propias de Pokémon Safari.
    El terreno se genera por código; estas paletas son datos, no un tileset.

    floor: suelo principal
    patch: manchas secundarias (tierra, grava, ceniza...)
    speck/light: variación de píxel
    accent: flores/detalles
    liquid*: agua para la zona costera
  */
  NS.TERRAIN_THEMES = {
    meadow: {
      id:'meadow',
      floor:['#8bb447','#83ab42','#94bf50'],
      patch:['#c9b15f','#bfa655','#d4bf70'],
      speck:'#719637',
      light:'#acd063',
      accent:['#f5db62','#f2a0c4','#edf6d8'],
      prop:{ bush:0.018, rock:0.006, tree:0.0 }
    },

    forest: {
      id:'forest',
      floor:['#4f873e','#568f43','#477a38'],
      patch:['#705d3d','#665537','#7d6945'],
      speck:'#35672f',
      light:'#70a95b',
      accent:['#e9d55a','#e992bc','#e6eee0'],
      prop:{ bush:0.030, rock:0.004, tree:0.055 }
    },

    water: {
      id:'water',
      // La parte caminable del hábitat acuático es costa/humedal.
      floor:['#d3bd6c','#c9af5e','#dfca7a'],
      patch:['#b59d53','#a88f49','#c2a95d'],
      speck:'#a38b46',
      light:'#ead98e',
      accent:['#f2e6a9','#c6d97a','#ffffff'],
      liquid:'#4e9dc2',
      liquidDeep:'#347da8',
      liquidLight:'#72bdd4',
      foam:'#d8f4ef',
      shore:'#8c814d',
      prop:{ bush:0.010, rock:0.006, tree:0.024 }
    },

    mountain: {
      id:'mountain',
      floor:['#858879','#777b6e','#949789'],
      patch:['#686b60','#5d6158','#73766b'],
      speck:'#5d625a',
      light:'#aeb0a1',
      accent:['#d2d2bd','#a9b49c','#d5c49c'],
      prop:{ bush:0.012, rock:0.038, tree:0.004 }
    },

    volcano: {
      id:'volcano',
      floor:['#67493d','#705044','#5b4137'],
      patch:['#3f3531','#483a34','#342e2b'],
      speck:'#3b302c',
      light:'#8a6250',
      accent:['#e36d3d','#f0a050','#b65a38'],
      // Charcos de lava pequeños: paleta independiente del suelo volcánico.
      lava:'#e64a25',
      lavaDeep:'#8f2722',
      lavaLight:'#ff8b2b',
      lavaGlow:'#ffd24a',
      lavaCrust:'#3b2928',
      prop:{ bush:0.0, rock:0.030, tree:0.0 }
    },

    special: {
      id:'special',
      floor:['#615477','#695b82','#564a6b'],
      patch:['#403a58','#49415f','#38334e'],
      speck:'#3d3654',
      light:'#8777a0',
      accent:['#c5a4e5','#78d4cc','#eee2ff'],
      prop:{ bush:0.015, rock:0.018, tree:0.015 }
    }
  };

  NS.TERRAIN_ORDER = ['meadow','forest','water','mountain','volcano','special'];

  console.info('[Pokémon Safari] Paletas de terreno procedural cargadas.');
})();
