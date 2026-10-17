(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if(!NS.Game) {
    console.error('[Pokémon Safari] region-gameplay.js: Game no existe.');
    return;
  }

  NS.Game.prototype.currentRegionId=function () {
    const requested=this.save?.profile?.activeRegion || 'kanto';

    if(!NS.isRegionUnlocked(this.save,requested)) {
      return 'kanto';
    }

    const hasSpecies=NS.SPECIES.some(
      s=>NS.regionForSpecies(s)===requested
    );

    return hasSpecies?requested:'kanto';
  };

  NS.Game.prototype.spawnPokemon=function (
    habitatOverride=null,
    positionOverride=null,
    triggerType=null
  ) {
    const license=this.upgrades.habitatLicense||0;
    const regionId=this.currentRegionId();

    let habitat=habitatOverride;
    let x;
    let y;

    if(positionOverride) {
      x=positionOverride.x;
      y=positionOverride.y;
    } else {
      /*
        Varias oportunidades para encontrar un punto que pertenezca de verdad
        a un hábitat desbloqueado y no caer justo sobre una frontera.
      */
      let chosen=null;

      for(let attempt=0;attempt<14;attempt++) {
        const angle=Math.random()*Math.PI*2;
        const distance=
          NS.CONFIG.spawnMinDistance +
          Math.random()*
          (NS.CONFIG.spawnMaxDistance-NS.CONFIG.spawnMinDistance);

        const px=this.player.x+Math.cos(angle)*distance;
        const py=this.player.y+Math.sin(angle)*distance;
        const ph=this.world.habitatAt(px,py);

        const pool=NS.speciesForRegionHabitat(
          regionId,
          ph,
          license,
          triggerType
        );

        if(pool.length) {
          chosen={x:px,y:py,habitat:ph};
          break;
        }
      }

      if(!chosen) return null;

      x=chosen.x;
      y=chosen.y;
      habitat=chosen.habitat;
    }

    if(!habitat) {
      habitat=this.world.habitatAt(x,y);
    }

    const pool=NS.speciesForRegionHabitat(
      regionId,
      habitat,
      license,
      triggerType
    );

    const encounterPool=triggerType
      ? pool.map(s=>({
          ...s,
          weight:
            s.weight*
            (
              s.rarity==='uncommon'
                ? 2.25
                : s.rarity==='rare'
                  ? 3.5
                  : 1
            )
        }))
      : pool;

    const species=this.chooseWeighted(encounterPool);
    if(!species) return null;

    /*
      Pokémon acuáticos normales aparecen preferentemente sobre agua real.
      Las especies voladoras pueden aparecer también sobre la costa.
    */
    const liquidOnly=
      habitat==='water' &&
      species.types?.includes('water') &&
      !species.types?.includes('flying');

    const point=this.world.findHabitatPoint(
      x,
      y,
      habitat,
      {
        liquidOnly,
        maxRadius:triggerType?190:128
      }
    );

    if(!point) return null;

    const shinyChance=
      NS.CONFIG.shinyBaseChance*
      Math.pow(2,this.upgrades.shinyCharm||0);

    const shiny=Math.random()<shinyChance;

    const pokemon=new NS.WildPokemon(
      species,
      point.x,
      point.y,
      shiny
    );

    this.wild.push(pokemon);

    if(shiny) {
      NS.Audio?.sfx('shinySpawn',.92);
    }

    return pokemon;
  };

  console.info('[Pokémon Safari] Spawns adaptados al terreno procedural.');
})();
