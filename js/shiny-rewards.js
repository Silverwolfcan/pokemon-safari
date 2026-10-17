(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if (!NS.Game) {
    console.error("[Pokémon Safari] shiny-rewards.js: Game no existe.");
    return;
  }

  NS.CONFIG.shinyRepeatCoinMultiplier = 4;

  NS.Game.prototype.tryCapture = function (pokemon,item) {
    const first=!this.save.dex[pokemon.species.id];

    const powerBonus=.88+item.power*.20;
    const skillBonus=1+(this.upgrades.capture||0)*.04;
    const backBonus=item.backStrike
      ? (NS.CONFIG.backCatchBonus||1.35)
      : 1;

    let chance=
      pokemon.species.catchRate *
      pokemon.catchMultiplier() *
      powerBonus *
      skillBonus *
      backBonus;

    chance=Math.max(.06,Math.min(.94,chance));

    if (Math.random() < chance) {
      pokemon._removed=true;
      this.captures++;

      const dex=
        this.save.dex[pokemon.species.id] ||
        {count:0,shiny:0,forms:{}};

      /*
        Migración transparente de partidas antiguas:
        las capturas que ya existían se consideran de la forma normal.
      */
      if (!dex.forms) {
        dex.forms = {
          default:{
            count:dex.count || 0,
            shiny:dex.shiny || 0
          }
        };
      }

      const formKey =
        pokemon.species.formKey ||
        'default';

      const formName =
        pokemon.species.formName ||
        'Normal';

      const firstForm =
        !dex.forms[formKey] ||
        dex.forms[formKey].count <= 0;

      if (!dex.forms[formKey]) {
        dex.forms[formKey] = {
          count:0,
          shiny:0,
          name:formName
        };
      }

      dex.forms[formKey].name =
        formName;

      dex.forms[formKey].count++;

      if (pokemon.shiny) {
        dex.forms[formKey].shiny++;
      }

      dex.count++;

      if (pokemon.shiny) {
        dex.shiny++;
      }

      this.save.dex[pokemon.species.id]=dex;

      const firstBonus = first ? 3 : 1;
      const shinyBonus = pokemon.shiny
        ? (NS.CONFIG.shinyRepeatCoinMultiplier || 4)
        : 1;

      const reward=Math.round(
        pokemon.species.value *
        firstBonus *
        shinyBonus
      );

      this.save.coins+=reward;
      this.coinsEarned+=reward;
      this.save.totalCaptures++;

      if (first) {
        this.newEntries.push(pokemon.species.id);
      }

      NS.Storage.save(this.save);
      NS.Audio?.sfx('capture',.86);

      if (first || pokemon.shiny) {
        setTimeout(
          () => NS.Audio?.sfx(
            'specialCapture',
            pokemon.shiny ? .95 : .84
          ),
          170
        );
      }

      this.toast(
        `${item.backStrike?'🎯 Espalda · ':''}` +
        `${pokemon.shiny?'★ ':''}` +
        `${pokemon.species.name}` +
        `${pokemon.species.formKey && pokemon.species.formKey !== 'default' ? ` (${pokemon.species.formName})` : ''}` +
        ` capturado · +${reward} monedas` +
        `${first?' · ¡Nueva entrada!':firstForm?' · ¡Nueva forma!':''}`
      );
    } else {
      NS.Audio?.sfx('fail',.72);
      this.toast(
        `${pokemon.species.name} se ha escapado de la Ball.`
      );

      if (
        pokemon.state === 'angry' ||
        Math.random() < .34
      ) {
        pokemon.beginFlee(this);
      }
    }
  };

  console.info("[Pokémon Safari] Bonus de monedas shiny: x4.");
})();
