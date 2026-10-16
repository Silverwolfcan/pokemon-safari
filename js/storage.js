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

  function normalizeSave(data) {
    const parsed = data || {};
    const upgrades = Object.assign(blankUpgrades(), parsed.upgrades || {});

    // Migración automática desde versiones anteriores.
    if ((parsed.upgrades?.rareLicense || 0) > 0 && upgrades.habitatLicense === 0) {
      upgrades.habitatLicense = 1;
    }

    return Object.assign(blankSave(), parsed, {
      upgrades,
      dex: parsed.dex || {},
      profile: Object.assign(blankProfile(), parsed.profile || {}, {
        trainerSheets: Object.assign(
          blankProfile().trainerSheets,
          parsed.profile?.trainerSheets || {}
        )
      })
    });
  }

  function saveLocalOnly(data) {
    localStorage.setItem(KEY, JSON.stringify(normalizeSave(data)));
  }

  NS.Storage = {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return blankSave();
        return normalizeSave(JSON.parse(raw));
      } catch {
        return blankSave();
      }
    },

    save(data) {
      const normalized = normalizeSave(data);
      saveLocalOnly(normalized);

      // El juego sigue funcionando aunque Firebase no esté disponible.
      if (NS.CloudSave && typeof NS.CloudSave.queueSave === 'function') {
        NS.CloudSave.queueSave(normalized);
      }
    },

    saveLocalOnly(data) {
      saveLocalOnly(data);
    },

    normalize(data) {
      return normalizeSave(data);
    },

    reset() {
      const fresh = blankSave();
      localStorage.removeItem(KEY);

      // Mantiene el reset también en la nube.
      if (NS.CloudSave && typeof NS.CloudSave.queueSave === 'function') {
        NS.CloudSave.queueSave(fresh);
      }

      return fresh;
    }
  };
})();
