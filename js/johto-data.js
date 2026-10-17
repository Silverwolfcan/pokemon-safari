(function () {
  const NS = window.SafariGame = window.SafariGame || {};
  const BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/';

  const rawJohto = [{"id":152,"name":"Chikorita","types":["grass"]},{"id":153,"name":"Bayleef","types":["grass"]},{"id":154,"name":"Meganium","types":["grass"]},{"id":155,"name":"Cyndaquil","types":["fire"]},{"id":156,"name":"Quilava","types":["fire"]},{"id":157,"name":"Typhlosion","types":["fire"]},{"id":158,"name":"Totodile","types":["water"]},{"id":159,"name":"Croconaw","types":["water"]},{"id":160,"name":"Feraligatr","types":["water"]},{"id":161,"name":"Sentret","types":["normal"]},{"id":162,"name":"Furret","types":["normal"]},{"id":163,"name":"Hoothoot","types":["normal","flying"]},{"id":164,"name":"Noctowl","types":["normal","flying"]},{"id":165,"name":"Ledyba","types":["bug","flying"]},{"id":166,"name":"Ledian","types":["bug","flying"]},{"id":167,"name":"Spinarak","types":["bug","poison"]},{"id":168,"name":"Ariados","types":["bug","poison"]},{"id":169,"name":"Crobat","types":["poison","flying"]},{"id":170,"name":"Chinchou","types":["water","electric"]},{"id":171,"name":"Lanturn","types":["water","electric"]},{"id":172,"name":"Pichu","types":["electric"]},{"id":173,"name":"Cleffa","types":["fairy"]},{"id":174,"name":"Igglybuff","types":["normal","fairy"]},{"id":175,"name":"Togepi","types":["fairy"]},{"id":176,"name":"Togetic","types":["fairy","flying"]},{"id":177,"name":"Natu","types":["psychic","flying"]},{"id":178,"name":"Xatu","types":["psychic","flying"]},{"id":179,"name":"Mareep","types":["electric"]},{"id":180,"name":"Flaaffy","types":["electric"]},{"id":181,"name":"Ampharos","types":["electric"]},{"id":182,"name":"Bellossom","types":["grass"]},{"id":183,"name":"Marill","types":["water","fairy"]},{"id":184,"name":"Azumarill","types":["water","fairy"]},{"id":185,"name":"Sudowoodo","types":["rock"]},{"id":186,"name":"Politoed","types":["water"]},{"id":187,"name":"Hoppip","types":["grass","flying"]},{"id":188,"name":"Skiploom","types":["grass","flying"]},{"id":189,"name":"Jumpluff","types":["grass","flying"]},{"id":190,"name":"Aipom","types":["normal"]},{"id":191,"name":"Sunkern","types":["grass"]},{"id":192,"name":"Sunflora","types":["grass"]},{"id":193,"name":"Yanma","types":["bug","flying"]},{"id":194,"name":"Wooper","types":["water","ground"]},{"id":195,"name":"Quagsire","types":["water","ground"]},{"id":196,"name":"Espeon","types":["psychic"]},{"id":197,"name":"Umbreon","types":["dark"]},{"id":198,"name":"Murkrow","types":["dark","flying"]},{"id":199,"name":"Slowking","types":["water","psychic"]},{"id":200,"name":"Misdreavus","types":["ghost"]},{"id":201,"name":"Unown","types":["psychic"]},{"id":202,"name":"Wobbuffet","types":["psychic"]},{"id":203,"name":"Girafarig","types":["normal","psychic"]},{"id":204,"name":"Pineco","types":["bug"]},{"id":205,"name":"Forretress","types":["bug","steel"]},{"id":206,"name":"Dunsparce","types":["normal"]},{"id":207,"name":"Gligar","types":["ground","flying"]},{"id":208,"name":"Steelix","types":["steel","ground"]},{"id":209,"name":"Snubbull","types":["fairy"]},{"id":210,"name":"Granbull","types":["fairy"]},{"id":211,"name":"Qwilfish","types":["water","poison"]},{"id":212,"name":"Scizor","types":["bug","steel"]},{"id":213,"name":"Shuckle","types":["bug","rock"]},{"id":214,"name":"Heracross","types":["bug","fighting"]},{"id":215,"name":"Sneasel","types":["dark","ice"]},{"id":216,"name":"Teddiursa","types":["normal"]},{"id":217,"name":"Ursaring","types":["normal"]},{"id":218,"name":"Slugma","types":["fire"]},{"id":219,"name":"Magcargo","types":["fire","rock"]},{"id":220,"name":"Swinub","types":["ice","ground"]},{"id":221,"name":"Piloswine","types":["ice","ground"]},{"id":222,"name":"Corsola","types":["water","rock"]},{"id":223,"name":"Remoraid","types":["water"]},{"id":224,"name":"Octillery","types":["water"]},{"id":225,"name":"Delibird","types":["ice","flying"]},{"id":226,"name":"Mantine","types":["water","flying"]},{"id":227,"name":"Skarmory","types":["steel","flying"]},{"id":228,"name":"Houndour","types":["dark","fire"]},{"id":229,"name":"Houndoom","types":["dark","fire"]},{"id":230,"name":"Kingdra","types":["water","dragon"]},{"id":231,"name":"Phanpy","types":["ground"]},{"id":232,"name":"Donphan","types":["ground"]},{"id":233,"name":"Porygon2","types":["normal"]},{"id":234,"name":"Stantler","types":["normal"]},{"id":235,"name":"Smeargle","types":["normal"]},{"id":236,"name":"Tyrogue","types":["fighting"]},{"id":237,"name":"Hitmontop","types":["fighting"]},{"id":238,"name":"Smoochum","types":["ice","psychic"]},{"id":239,"name":"Elekid","types":["electric"]},{"id":240,"name":"Magby","types":["fire"]},{"id":241,"name":"Miltank","types":["normal"]},{"id":242,"name":"Blissey","types":["normal"]},{"id":243,"name":"Raikou","types":["electric"]},{"id":244,"name":"Entei","types":["fire"]},{"id":245,"name":"Suicune","types":["water"]},{"id":246,"name":"Larvitar","types":["rock","ground"]},{"id":247,"name":"Pupitar","types":["rock","ground"]},{"id":248,"name":"Tyranitar","types":["rock","dark"]},{"id":249,"name":"Lugia","types":["psychic","flying"]},{"id":250,"name":"Ho-Oh","types":["fire","flying"]},{"id":251,"name":"Celebi","types":["psychic","grass"]}];

  const legendary = new Set([243,244,245,249,250,251]);
  const rare = new Set([
    152,153,154,155,156,157,158,159,160,
    169,172,173,174,175,176,178,181,184,185,189,
    196,197,199,200,201,202,205,208,210,212,214,215,
    217,219,221,224,226,227,229,230,232,233,234,235,
    237,238,239,240,241,242,246,247,248
  ]);
  const uncommon = new Set([
    162,164,166,168,171,180,182,186,188,192,195,203,
    209,213,216,223
  ]);

  function habitatsFor(types, id) {
    /*
      Hábitats de Johto asignados de forma explícita.

      El sistema anterior infería el hábitat combinando tipos:
      por ejemplo, un Pokémon Agua/Hada podía acabar también en Pradera
      por tener tipo Hada. Eso provocaba apariciones poco coherentes.

      Ahora cada especie tiene uno o, como mucho, dos hábitats deliberados.
    */
    const groups = {
      water: new Set([
        158,159,160,170,171,183,184,186,194,195,199,
        211,222,223,224,226,230,245,249
      ]),

      forest: new Set([
        152,153,154,163,164,165,166,167,168,169,182,
        187,188,189,190,191,192,193,204,205,212,214,
        216,217,251
      ]),

      meadow: new Set([
        161,162,172,173,174,175,176,177,178,179,180,
        181,196,203,206,209,210,234,235,241,242
      ]),

      mountain: new Set([
        185,207,208,213,215,220,221,225,227,231,232,
        236,237,238,239,243,246,247,248
      ]),

      volcano: new Set([
        155,156,157,218,219,228,229,240,244,250
      ]),

      special: new Set([
        197,198,200,201,202,233
      ])
    };

    const habitats = [];

    for (const [habitat, ids] of Object.entries(groups)) {
      if (ids.has(id)) habitats.push(habitat);
    }

    /*
      Casos concretos con dos zonas razonables.
      Son excepciones intencionadas, no consecuencia automática del tipo.
    */
    if (id === 185) habitats.push('forest');     // Sudowoodo
    if (id === 198) habitats.push('forest');     // Murkrow
    if (id === 243) habitats.push('meadow');     // Raikou
    if (id === 249) habitats.push('special');    // Lugia

    // Seguridad: ninguna especie debe quedarse sin zona.
    if (!habitats.length) habitats.push('meadow');

    return [...new Set(habitats)];
  }

  function metaFor(entry) {
    const id = entry.id;
    const rarity = legendary.has(id)
      ? 'legendary'
      : rare.has(id)
        ? 'rare'
        : uncommon.has(id)
          ? 'uncommon'
          : 'common';

    const weight =
      rarity === 'legendary' ? 0.18 :
      rarity === 'rare' ? 2.1 :
      rarity === 'uncommon' ? 5.5 : 11;

    const catchRate =
      rarity === 'legendary' ? 0.12 :
      rarity === 'rare' ? 0.30 :
      rarity === 'uncommon' ? 0.46 : 0.60;

    const value =
      rarity === 'legendary' ? 260 :
      rarity === 'rare' ? 78 :
      rarity === 'uncommon' ? 42 : 24;

    const temperament =
      entry.types.includes('fighting') || entry.types.includes('rock')
        ? 'bold'
        : entry.types.includes('dark') || entry.types.includes('flying')
          ? 'skittish'
          : 'calm';

    // Variación determinista para evitar que todos tengan exactamente la misma velocidad.
    const speed = 45 + ((id * 17) % 53);

    return {
      ...entry,
      region:'johto',
      habitats:habitatsFor(entry.types,id),
      rarity,
      weight,
      catchRate,
      speed,
      temperament,
      value
    };
  }

  const formatted = rawJohto.map(raw => {
    const s = metaFor(raw);
    const key = String(s.id).padStart(4,'0');
    const normal = `${BASE}${key}`;
    const shiny = `${normal}/0000/0001`;

    return {
      ...s,
      key,
      walkUrl:`${normal}/Walk-Anim.png`,
      idleUrl:`${normal}/Idle-Anim.png`,
      walkShadowUrl:`${normal}/Walk-Shadow.png`,
      idleShadowUrl:`${normal}/Idle-Shadow.png`,
      animDataUrl:`${normal}/AnimData.xml`,
      shinyWalkUrl:`${shiny}/Walk-Anim.png`,
      shinyIdleUrl:`${shiny}/Idle-Anim.png`,
      shinyWalkShadowUrl:`${shiny}/Walk-Shadow.png`,
      shinyIdleShadowUrl:`${shiny}/Idle-Shadow.png`,
      shinyAnimDataUrl:`${shiny}/AnimData.xml`
    };
  });

  // Etiquetamos Kanto explícitamente y añadimos Johto.
  NS.SPECIES = NS.SPECIES.map(s => ({...s, region:s.region || 'kanto'}));
  NS.SPECIES.push(...formatted);
  NS.SPECIES_BY_ID = Object.fromEntries(NS.SPECIES.map(s => [s.id,s]));

  console.info(`[Pokémon Safari] Johto cargado: ${formatted.length} especies.`);
})();
