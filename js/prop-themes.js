(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  /*
    V2.5 — escala, capas y colisiones de props.

    Reglas visuales:
    - detalles bajos (flores, setas, hierba, ramas pequeñas...) se pintan
      sobre el suelo, siempre detrás de jugador/Pokémon;
    - troncos caídos grandes y tocones son obstáculos reales;
    - árboles, grandes rocas y props especiales principales tienen más presencia.
  */
  NS.PROP_BIOMES = {
    meadow: {
      solidMacro: 4, solidChance: .22, clusterThreshold: .62, decorChance: .115,
      solids: [
        {visual:'meadowRock', type:'rock', weight:6},
        {visual:'meadowLog', type:'decor', solid:true, weight:1},
        {visual:'meadowStump', type:'decor', solid:true, weight:1}
      ],
      decor: [
        {visual:'meadowBush', type:'bush', weight:5},
        {visual:'flowerPatch', type:'decor', weight:4},
        {visual:'grassTuft', type:'decor', weight:5},
        {visual:'meadowBranch', type:'decor', weight:2}
      ]
    },

    forest: {
      solidMacro: 3, solidChance: .72, clusterThreshold: .44, decorChance: .18,
      solids: [
        {visual:'forestTree', type:'tree', weight:10},
        {visual:'mossRock', type:'rock', weight:2},
        {visual:'fallenLog', type:'decor', solid:true, weight:2},
        {visual:'forestStump', type:'decor', solid:true, weight:1}
      ],
      decor: [
        {visual:'forestBush', type:'bush', weight:5},
        {visual:'fernPatch', type:'decor', weight:5},
        {visual:'forestMushrooms', type:'decor', weight:2},
        {visual:'forestBranch', type:'decor', weight:2}
      ]
    },

    water: {
      solidMacro: 4, solidChance: .46, clusterThreshold: .50, decorChance: .16,
      solids: [
        {visual:'palmTree', type:'tree', weight:8},
        {visual:'coastRock', type:'rock', weight:2}
      ],
      decor: [
        {visual:'coastBush', type:'bush', weight:3},
        {visual:'reeds', type:'bush', weight:4},
        {visual:'coastGrass', type:'decor', weight:5},
        {visual:'driftwood', type:'decor', weight:2},
        {visual:'shellPatch', type:'decor', weight:2},
        {visual:'lilyPads', type:'decor', weight:1}
      ]
    },

    mountain: {
      solidMacro: 3, solidChance: .58, clusterThreshold: .49, decorChance: .13,
      solids: [
        {visual:'mountainBoulder', type:'rock', weight:7},
        {visual:'rockSpire', type:'rock', weight:2},
        {visual:'oreNode', type:'rock', weight:1}
      ],
      decor: [
        {visual:'dryShrub', type:'bush', weight:4},
        {visual:'stoneCluster', type:'decor', weight:5},
        {visual:'caveMushrooms', type:'decor', weight:1}
      ]
    },

    volcano: {
      solidMacro: 4, solidChance: .48, clusterThreshold: .51, decorChance: .12,
      solids: [
        {visual:'charredTree', type:'tree', weight:3},
        {visual:'volcanicRock', type:'rock', weight:6},
        {visual:'basaltPillar', type:'rock', weight:2}
      ],
      decor: [
        {visual:'ashBush', type:'bush', weight:3},
        {visual:'obsidianShard', type:'decor', weight:3},
        {visual:'sulfurVent', type:'decor', weight:2},
        {visual:'cinderPile', type:'decor', weight:4}
      ]
    },

    special: {
      solidMacro: 3, solidChance: .52, clusterThreshold: .50, decorChance: .16,
      solids: [
        {visual:'crystalCluster', type:'rock', weight:7},
        {visual:'twistedTree', type:'tree', weight:2},
        {visual:'runeStone', type:'rock', weight:2},
        {visual:'specialRock', type:'rock', weight:2}
      ],
      decor: [
        {visual:'strangeShrub', type:'bush', weight:4},
        {visual:'glowMushrooms', type:'decor', weight:3},
        {visual:'smallCrystals', type:'decor', weight:3}
      ]
    }
  };

  NS.PROP_VISUAL_META = {
    // PRADERA
    meadowRock:{drawW:36,drawH:31,collisionRadius:9,markerOffset:34},
    meadowBush:{drawW:32,drawH:30,collisionRadius:0,markerOffset:33},
    flowerPatch:{drawW:18,drawH:11,collisionRadius:0,markerOffset:14,renderLayer:'ground'},
    grassTuft:{drawW:16,drawH:12,collisionRadius:0,markerOffset:15,renderLayer:'ground'},
    meadowBranch:{drawW:27,drawH:14,collisionRadius:0,markerOffset:17,renderLayer:'ground'},
    meadowLog:{drawW:48,drawH:28,collisionRadius:0,collisionShape:'box',collisionHalfW:20,collisionHalfH:6,markerOffset:31},
    meadowStump:{drawW:32,drawH:29,collisionRadius:11,markerOffset:32},

    // BOSQUE
    forestTree:{drawW:60,drawH:74,collisionRadius:10,markerOffset:70},
    forestBush:{drawW:32,drawH:30,collisionRadius:0,markerOffset:33},
    fernPatch:{drawW:19,drawH:14,collisionRadius:0,markerOffset:17,renderLayer:'ground'},
    forestMushrooms:{drawW:16,drawH:13,collisionRadius:0,markerOffset:16,renderLayer:'ground'},
    forestBranch:{drawW:26,drawH:14,collisionRadius:0,markerOffset:17,renderLayer:'ground'},
    mossRock:{drawW:36,drawH:31,collisionRadius:9,markerOffset:34},
    fallenLog:{drawW:50,drawH:28,collisionRadius:0,collisionShape:'box',collisionHalfW:21,collisionHalfH:6,markerOffset:31},
    forestStump:{drawW:33,drawH:31,collisionRadius:11,markerOffset:34},

    // COSTA / HUMEDAL
    palmTree:{drawW:54,drawH:74,collisionRadius:10,markerOffset:70},
    coastBush:{drawW:32,drawH:30,collisionRadius:0,markerOffset:33},
    reeds:{drawW:22,drawH:20,collisionRadius:0,markerOffset:23,renderLayer:'ground'},
    coastGrass:{drawW:16,drawH:12,collisionRadius:0,markerOffset:15,renderLayer:'ground'},
    lilyPads:{drawW:24,drawH:13,collisionRadius:0,markerOffset:16,renderLayer:'ground'},
    driftwood:{drawW:30,drawH:16,collisionRadius:0,markerOffset:19,renderLayer:'ground'},
    shellPatch:{drawW:15,drawH:9,collisionRadius:0,markerOffset:12,renderLayer:'ground'},
    coastRock:{drawW:36,drawH:31,collisionRadius:9,markerOffset:34},

    // MONTAÑA / CUEVA
    mountainBoulder:{drawW:46,drawH:39,collisionRadius:12,markerOffset:42},
    rockSpire:{drawW:35,drawH:50,collisionRadius:10,markerOffset:53},
    dryShrub:{drawW:25,drawH:21,collisionRadius:0,markerOffset:24,renderLayer:'ground'},
    stoneCluster:{drawW:22,drawH:15,collisionRadius:0,markerOffset:18,renderLayer:'ground'},
    oreNode:{drawW:36,drawH:33,collisionRadius:10,markerOffset:36},
    caveMushrooms:{drawW:16,drawH:14,collisionRadius:0,markerOffset:17,renderLayer:'ground'},

    // VOLCÁN
    charredTree:{drawW:52,drawH:74,collisionRadius:10,markerOffset:70},
    ashBush:{drawW:30,drawH:28,collisionRadius:0,markerOffset:31},
    volcanicRock:{drawW:46,drawH:39,collisionRadius:12,markerOffset:42},
    basaltPillar:{drawW:34,drawH:50,collisionRadius:10,markerOffset:53},
    obsidianShard:{drawW:21,drawH:27,collisionRadius:0,markerOffset:30,renderLayer:'ground'},
    sulfurVent:{drawW:25,drawH:27,collisionRadius:0,markerOffset:30},
    cinderPile:{drawW:22,drawH:13,collisionRadius:0,markerOffset:16,renderLayer:'ground'},

    // ZONA ESPECIAL
    crystalCluster:{drawW:42,drawH:58,collisionRadius:11,markerOffset:61},
    twistedTree:{drawW:58,drawH:76,collisionRadius:10,markerOffset:72},
    strangeShrub:{drawW:30,drawH:28,collisionRadius:0,markerOffset:31},
    glowMushrooms:{drawW:16,drawH:14,collisionRadius:0,markerOffset:17,renderLayer:'ground'},
    smallCrystals:{drawW:18,drawH:22,collisionRadius:0,markerOffset:25,renderLayer:'ground'},
    runeStone:{drawW:36,drawH:49,collisionRadius:10,markerOffset:52},
    specialRock:{drawW:40,drawH:35,collisionRadius:10,markerOffset:38}
  };

  console.info('[Pokémon Safari] Catálogo de props V2.5: capas, escala y colisiones ajustadas.');
})();
