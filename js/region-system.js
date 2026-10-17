(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  NS.REGIONS = [
    { id:'kanto', name:'Kanto', minId:1, maxId:151, unlockLevel:0 },
    { id:'johto', name:'Johto', minId:152, maxId:251, unlockLevel:1 },
    { id:'hoenn', name:'Hoenn', minId:252, maxId:386, unlockLevel:2 },
    { id:'sinnoh', name:'Sinnoh', minId:387, maxId:493, unlockLevel:3 },
    { id:'unova', name:'Teselia', minId:494, maxId:649, unlockLevel:4 },
    { id:'kalos', name:'Kalos', minId:650, maxId:721, unlockLevel:5 },
    { id:'alola', name:'Alola', minId:722, maxId:809, unlockLevel:6 },
    { id:'galar', name:'Galar', minId:810, maxId:905, unlockLevel:7 },
    { id:'paldea', name:'Paldea', minId:906, maxId:1025, unlockLevel:8 }
  ];

  NS.regionForSpecies = function (species) {
    if (species?.region) return species.region;
    const id = Number(species?.id || 0);
    return NS.REGIONS.find(r => id >= r.minId && id <= r.maxId)?.id || 'kanto';
  };

  NS.unlockedRegionLevel = function (save) {
    return Math.max(0, Math.min(
      NS.REGIONS.length - 1,
      Number(save?.upgrades?.regionAccess || 0)
    ));
  };

  NS.isRegionUnlocked = function (save, regionId) {
    const region = NS.REGIONS.find(r => r.id === regionId);
    return Boolean(region && NS.unlockedRegionLevel(save) >= region.unlockLevel);
  };

  NS.unlockedRegions = function (save) {
    return NS.REGIONS.filter(r => NS.isRegionUnlocked(save,r.id));
  };

  NS.availableRegions = function (save) {
    return NS.unlockedRegions(save).filter(region =>
      NS.SPECIES.some(s => NS.regionForSpecies(s) === region.id)
    );
  };

  NS.unlockedSpecies = function (save) {
    const regionIds = new Set(NS.unlockedRegions(save).map(r => r.id));
    return NS.SPECIES.filter(s => regionIds.has(NS.regionForSpecies(s)));
  };

  NS.nextLockedRegion = function (save) {
    const level = NS.unlockedRegionLevel(save);
    return NS.REGIONS[level + 1] || null;
  };

  NS.speciesForRegionHabitat = function (
    regionId,
    habitat,
    licenseLevel = 0,
    triggerType = null
  ) {
    const habitatDefinition =
      NS.HABITATS[habitat];

    if (
      habitatDefinition &&
      habitatDefinition.minLicense > licenseLevel
    ) {
      return [];
    }

    function triggerAllows(candidate) {
      if (triggerType === 'tree') {
        return candidate.types.some(
          type =>
            ['bug','flying','grass']
              .includes(type)
        );
      }

      if (triggerType === 'rock') {
        return candidate.types.some(
          type =>
            [
              'rock',
              'ground',
              'fighting',
              'steel',
              'fire'
            ].includes(type)
        );
      }

      if (triggerType === 'waterSpot') {
        return candidate.types.includes('water');
      }

      return true;
    }

    const result = [];

    for (const species of NS.SPECIES) {
      const defaultRegion =
        NS.regionForSpecies(species);

      const forms =
        NS.getSpeciesForms
          ? NS.getSpeciesForms(species)
          : [{
              key:'default',
              name:'Normal',
              region:defaultRegion,
              habitat:
                species.habitats?.[0],
              isDefault:true
            }];

      const eligible = [];

      for (const form of forms) {
        const formRegion =
          form.region || defaultRegion;

        const formHabitat =
          form.habitat ||
          species.habitats?.[0];

        if (
          formRegion !== regionId ||
          formHabitat !== habitat
        ) {
          continue;
        }

        const candidate =
          form.isDefault
            ? {
                ...species,
                formKey:'default',
                formName:'Normal'
              }
            : NS.makeFormSpecies(
                species,
                form
              );

        if (!triggerAllows(candidate)) {
          continue;
        }

        eligible.push(candidate);
      }

      if (!eligible.length) continue;

      /*
        Las formas no deben multiplicar artificialmente la frecuencia de una
        especie. Repartimos el peso de esa especie entre sus formas válidas.
      */
      const splitWeight =
        species.weight /
        eligible.length;

      for (const candidate of eligible) {
        result.push({
          ...candidate,
          weight:splitWeight
        });
      }
    }

    return result;
  };

  if (!NS.SHOP_ITEMS.some(item => item.id === 'regionAccess')) {
    NS.SHOP_ITEMS.push({
      id:'regionAccess',
      name:'Pase a la siguiente región',
      desc:'Desbloquea progresivamente nuevas regiones Pokémon.',
      baseCost:1000,
      max:NS.REGIONS.length - 1,
      isRegionUnlock:true
    });
  }


  // Los pases regionales tienen precio fijo temporal de 1.000 monedas.
  // El resto de mejoras conserva su fórmula de precio progresivo.
  if (!NS._regionPriceOverrideInstalled) {
    const previousGetUpgradeCost = NS.getUpgradeCost;

    NS.getUpgradeCost = function (item, level) {
      if (item?.id === 'regionAccess') {
        return 1000;
      }

      return previousGetUpgradeCost(item, level);
    };

    NS._regionPriceOverrideInstalled = true;
  }

  console.info("[Pokémon Safari] Sistema regional activo.");
})();
