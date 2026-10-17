(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  const BASE =
    'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/';

  const CSV_BASE =
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';

  const POKEMON_CSV = `${CSV_BASE}pokemon.csv`;
  const TYPES_CSV = `${CSV_BASE}pokemon_types.csv`;
  const FORMS_CSV = `${CSV_BASE}pokemon_forms.csv`;

  const TYPE_BY_ID = {
    1:'normal', 2:'fighting', 3:'flying', 4:'poison', 5:'ground',
    6:'rock', 7:'bug', 8:'ghost', 9:'steel', 10:'fire',
    11:'water', 12:'grass', 13:'electric', 14:'psychic',
    15:'ice', 16:'dragon', 17:'dark', 18:'fairy'
  };

  const REGION_RANGES = [
    ['hoenn',252,386],
    ['sinnoh',387,493],
    ['unova',494,649],
    ['kalos',650,721],
    ['alola',722,809],
    ['galar',810,905],
    ['paldea',906,1025]
  ];

  const LEGENDARY = new Set([
    377,378,379,380,381,382,383,384,385,386,
    480,481,482,483,484,485,486,487,488,489,490,491,492,493,
    494,638,639,640,641,642,643,644,645,646,647,648,649,
    716,717,718,719,720,721,
    772,773,785,786,787,788,789,790,791,792,800,801,802,807,808,809,
    888,889,890,891,892,893,894,895,896,897,898,905,
    1001,1002,1003,1004,1007,1008,1014,1015,1016,1017,1024,1025
  ]);

  function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines.shift().split(',');

    return lines.map(line => {
      const values = line.split(',');
      const row = {};

      headers.forEach((header,index) => {
        row[header] = values[index] ?? '';
      });

      return row;
    });
  }

  function formatName(identifier) {
    const special = {
      'mr-rime':'Mr. Rime',
      'mr-mime':'Mr. Mime',
      'mime-jr':'Mime Jr.',
      'porygon-z':'Porygon-Z',
      'type-null':'Type: Null',
      'farfetchd':"Farfetch'd",
      'sirfetchd':"Sirfetch'd",
      'flabebe':'Flabébé'
    };

    if (special[identifier]) return special[identifier];

    return String(identifier || '')
      .split('-')
      .map(part =>
        part
          ? part[0].toUpperCase() + part.slice(1)
          : part
      )
      .join(' ');
  }

  function regionForId(id) {
    return REGION_RANGES.find(
      ([,min,max]) => id >= min && id <= max
    )?.[0] || null;
  }

  function habitatForPrimaryType(type) {
    const map = {
      normal:'meadow',
      fighting:'mountain',
      flying:'meadow',
      poison:'forest',
      ground:'mountain',
      rock:'mountain',
      bug:'forest',
      ghost:'special',
      steel:'mountain',
      fire:'volcano',
      water:'water',
      grass:'forest',
      electric:'meadow',
      psychic:'meadow',
      ice:'mountain',
      dragon:'special',
      dark:'special',
      fairy:'meadow'
    };

    return map[type] || 'meadow';
  }

  function safariMeta(id,baseExperience,types) {
    let rarity;

    if (LEGENDARY.has(id)) {
      rarity = 'legendary';
    } else if (baseExperience >= 220) {
      rarity = 'rare';
    } else if (baseExperience >= 120) {
      rarity = 'uncommon';
    } else {
      rarity = 'common';
    }

    return {
      rarity,
      weight:
        rarity === 'legendary' ? .18 :
        rarity === 'rare' ? 2.1 :
        rarity === 'uncommon' ? 5.5 : 11,

      catchRate:
        rarity === 'legendary' ? .12 :
        rarity === 'rare' ? .30 :
        rarity === 'uncommon' ? .46 : .60,

      value:
        rarity === 'legendary' ? 260 :
        rarity === 'rare' ? 78 :
        rarity === 'uncommon' ? 42 : 24,

      temperament:
        types.includes('dark') || types.includes('flying')
          ? 'skittish'
          : types.includes('fighting') || types.includes('rock')
            ? 'alert'
            : 'calm',

      speed:45 + ((id * 17) % 53)
    };
  }

  function makeSpriteFields(species) {
    const key = String(species.id).padStart(4,'0');
    const normal = `${BASE}${key}`;
    const shiny = `${normal}/0000/0001`;

    return {
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
  }

  function formRegion(formIdentifier,canonicalRegion) {
    const id = String(formIdentifier || '').toLowerCase();

    if (id.includes('alola')) return 'alola';
    if (id.includes('galar')) return 'galar';
    if (id.includes('paldea')) return 'paldea';
    if (id.includes('hisui')) return 'sinnoh';

    return canonicalRegion;
  }

  function isCollectibleForm(row) {
    if (row.is_default === '1') return false;
    if (row.is_battle_only === '1') return false;
    if (row.is_mega === '1') return false;

    const key = String(row.form_identifier || '').toLowerCase();

    if (!key) return false;

    // Evitamos variantes puramente de combate/promoción que no interesa
    // tratar como entradas coleccionables permanentes.
    if (
      key.includes('gmax') ||
      key.includes('eternamax') ||
      key.includes('totem')
    ) {
      return false;
    }

    return true;
  }

  async function loadAllRegions() {
    if (NS._allRegionsLoaded) return NS.SPECIES;

    const [
      pokemonResponse,
      typesResponse,
      formsResponse
    ] = await Promise.all([
      fetch(POKEMON_CSV),
      fetch(TYPES_CSV),
      fetch(FORMS_CSV)
    ]);

    if (
      !pokemonResponse.ok ||
      !typesResponse.ok ||
      !formsResponse.ok
    ) {
      throw new Error(
        'No se pudieron cargar los datos regionales/formas.'
      );
    }

    const [
      pokemonText,
      typesText,
      formsText
    ] = await Promise.all([
      pokemonResponse.text(),
      typesResponse.text(),
      formsResponse.text()
    ]);

    const pokemonRows = parseCsv(pokemonText);
    const typeRows = parseCsv(typesText);
    const formRows = parseCsv(formsText);

    const pokemonById = new Map(
      pokemonRows.map(row => [
        Number(row.id),
        row
      ])
    );

    const relevantPokemonIds = new Set();

    for (const row of pokemonRows) {
      const speciesId = Number(row.species_id);

      if (speciesId >= 1 && speciesId <= 1025) {
        relevantPokemonIds.add(Number(row.id));
      }
    }

    const typesByPokemon = new Map();

    for (const row of typeRows) {
      const pokemonId = Number(row.pokemon_id);

      if (!relevantPokemonIds.has(pokemonId)) {
        continue;
      }

      const typeName =
        TYPE_BY_ID[Number(row.type_id)];

      if (!typeName) continue;

      if (!typesByPokemon.has(pokemonId)) {
        typesByPokemon.set(pokemonId,[]);
      }

      typesByPokemon.get(pokemonId).push({
        slot:Number(row.slot) || 1,
        type:typeName
      });
    }

    const existingIds =
      new Set(NS.SPECIES.map(s => s.id));

    const added = [];

    /*
      IMPORTANTE:
      La Pokédex se construye por species_id, no por pokemon.id.

      pokemon.id identifica variantes/modelos internos de PokeAPI.
      species_id identifica la entrada real de Pokédex.

      Esta distinción evita que distintas formas aparezcan como Pokémon
      duplicados.
    */
    for (const row of pokemonRows) {
      if (row.is_default !== '1') continue;

      const speciesId =
        Number(row.species_id);

      if (
        speciesId < 252 ||
        speciesId > 1025 ||
        existingIds.has(speciesId)
      ) {
        continue;
      }

      const region =
        regionForId(speciesId);

      if (!region) continue;

      const pokemonId = Number(row.id);

      const types =
        (typesByPokemon.get(pokemonId) || [])
          .sort((a,b) => a.slot - b.slot)
          .map(entry => entry.type);

      if (!types.length) types.push('normal');

      const baseExperience =
        Number(row.base_experience) || 80;

      const species = {
        id:speciesId,
        pokemonId,
        name:formatName(row.identifier),
        types,
        habitats:[
          habitatForPrimaryType(types[0])
        ],
        region,
        ...safariMeta(
          speciesId,
          baseExperience,
          types
        )
      };

      Object.assign(
        species,
        makeSpriteFields(species)
      );

      added.push(species);
      existingIds.add(speciesId);
    }

    NS.SPECIES.push(...added);
    NS.SPECIES.sort((a,b) => a.id - b.id);

    NS.SPECIES_BY_ID =
      Object.fromEntries(
        NS.SPECIES.map(s => [s.id,s])
      );

    /*
      Formas alternativas.
      No se añaden a NS.SPECIES: pertenecen a la misma entrada de Pokédex.
    */
    NS.FORMS_BY_SPECIES =
      NS.FORMS_BY_SPECIES || {};

    for (const row of formRows) {
      if (!isCollectibleForm(row)) continue;

      const pokemonId =
        Number(row.pokemon_id);

      const pokemonRow =
        pokemonById.get(pokemonId);

      if (!pokemonRow) continue;

      const speciesId =
        Number(pokemonRow.species_id);

      if (speciesId < 1 || speciesId > 1025) {
        continue;
      }

      const canonical =
        NS.SPECIES_BY_ID[speciesId];

      if (!canonical) continue;

      const types =
        (typesByPokemon.get(pokemonId) || [])
          .sort((a,b) => a.slot - b.slot)
          .map(entry => entry.type);

      const formIdentifier =
        row.form_identifier ||
        pokemonRow.identifier ||
        `forma-${pokemonId}`;

      const key =
        String(formIdentifier)
          .toLowerCase();

      const canonicalRegion =
        NS.regionForSpecies
          ? NS.regionForSpecies(canonical)
          : canonical.region;

      const form = {
        key,
        name:formatName(formIdentifier),
        pokemonId,
        speciesId,
        types:types.length
          ? types
          : canonical.types,

        habitat:
          habitatForPrimaryType(
            types[0] || canonical.types[0]
          ),

        region:
          formRegion(
            formIdentifier,
            canonicalRegion
          )
      };

      if (!NS.FORMS_BY_SPECIES[speciesId]) {
        NS.FORMS_BY_SPECIES[speciesId] = [];
      }

      if (
        !NS.FORMS_BY_SPECIES[speciesId]
          .some(existing => existing.key === key)
      ) {
        NS.FORMS_BY_SPECIES[speciesId]
          .push(form);
      }
    }

    NS.makeFormSpecies = function (
      canonical,
      form
    ) {
      if (!form) return canonical;

      return {
        ...canonical,

        // Mantiene el número real de Pokédex.
        id:canonical.id,

        name:canonical.name,
        types:form.types || canonical.types,
        habitats:[
          form.habitat ||
          canonical.habitats[0]
        ],

        formKey:form.key,
        formName:form.name,
        spritePokemonId:form.pokemonId,

        // Las formas usan el sprite estático específico de PokeAPI.
        forceStaticSprite:true
      };
    };

    NS.getSpeciesForms = function (species) {
      const alternate =
        NS.FORMS_BY_SPECIES?.[species.id] || [];

      return [
        {
          key:'default',
          name:'Normal',
          pokemonId:
            species.pokemonId ||
            species.id,
          region:
            NS.regionForSpecies
              ? NS.regionForSpecies(species)
              : species.region,
          habitat:
            species.habitats?.[0] || 'meadow',
          types:species.types,
          isDefault:true
        },
        ...alternate
      ];
    };

    NS.formVariantForSpecies = function (
      species,
      formKey
    ) {
      if (!formKey || formKey === 'default') {
        return {
          ...species,
          formKey:'default',
          formName:'Normal'
        };
      }

      const form =
        (NS.FORMS_BY_SPECIES?.[species.id] || [])
          .find(item => item.key === formKey);

      return form
        ? NS.makeFormSpecies(species,form)
        : species;
    };

    NS._allRegionsLoaded = true;

    window.dispatchEvent(
      new CustomEvent(
        'safari-regions-ready',
        {
          detail:{
            added:added.length,
            forms:Object.values(
              NS.FORMS_BY_SPECIES
            ).reduce(
              (sum,list) =>
                sum + list.length,
              0
            )
          }
        }
      )
    );

    console.info(
      `[Pokémon Safari] Regiones 3-9: ${added.length} especies; formas cargadas.`
    );

    return NS.SPECIES;
  }

  NS.AllRegionsData = {
    ready:loadAllRegions()
      .catch(error => {
        console.error(
          '[Pokémon Safari] Error cargando regiones/formas:',
          error
        );

        NS._allRegionsLoadError = error;
        throw error;
      })
  };

  NS.ensureAllRegionsReady =
    async function () {
      try {
        await NS.AllRegionsData.ready;
        return true;
      } catch {
        return false;
      }
    };
})();
