(function () {
  const NS = window.SafariGame = window.SafariGame || {};
  const KEY = 'pokemonSafariMvpSave_v1';

  function blankProfile() {
    return {
      trainerId: 0,
      trainerSheets: { set1: '', set2: '' }
    };
  }

  function blankUpgrades() {
    return {
      balls:0,
      steps:0,
      time:0,
      supplies:0,
      capture:0,
      habitatLicense:0,
      shinyCharm:0,
      fleeTime:0,
      swimSpeed:0,
      captureScanner:0,
      stoneGathering:0
    };
  }

  function blankSave() {
    return {
      coins: 0,
      dex: {},
      upgrades: blankUpgrades(),
      runs: 0,
      totalCaptures: 0,
      totalRunSeconds: 0,
      profile: blankProfile()
    };
  }

  NS.Storage = {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return blankSave();
        const parsed = JSON.parse(raw);
        const upgrades = Object.assign(blankUpgrades(), parsed.upgrades || {});

        // Migración automática desde versiones anteriores.
        if ((parsed.upgrades?.rareLicense || 0) > 0 && upgrades.habitatLicense === 0) {
          upgrades.habitatLicense = 1;
        }

        return Object.assign(blankSave(), parsed, {
          upgrades,
          dex: parsed.dex || {},
          profile: Object.assign(blankProfile(), parsed.profile || {}, {
            trainerSheets: Object.assign(blankProfile().trainerSheets, parsed.profile?.trainerSheets || {})
          })
        });
      } catch {
        return blankSave();
      }
    },

    save(data) {
      localStorage.setItem(KEY, JSON.stringify(data));
    },

    reset() {
      localStorage.removeItem(KEY);
      return blankSave();
    }
  };
})();