(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  const db = NS.firestore;
  const auth = NS.firebaseAuth;

  if (!db || !auth) {
    console.error("Firestore o Firebase Auth no están inicializados.");
    return;
  }

  let saveTimer = null;
  let syncing = false;

  function setSaveStatus(text) {
    const element = document.getElementById("saveStatus");
    if (element) element.textContent = text;
  }

  // Las hojas PNG importadas pueden ocupar muchísimo espacio y no deben
  // guardarse dentro de un documento de Firestore.
  function toCloudSave(localSave) {
    const save = NS.Storage.normalize(localSave);

    return {
      coins: save.coins,
      dex: save.dex,
      upgrades: save.upgrades,
      runs: save.runs,
      totalCaptures: save.totalCaptures,
      totalRunSeconds: save.totalRunSeconds,
      profile: {
        trainerId: save.profile?.trainerId || 0
      }
    };
  }

  function mergeCloudIntoLocal(cloudSave, localSave) {
    const normalizedCloud = NS.Storage.normalize(cloudSave || {});
    const normalizedLocal = NS.Storage.normalize(localSave || {});

    // trainerSheets permanece únicamente en este navegador.
    normalizedCloud.profile.trainerSheets =
      normalizedLocal.profile?.trainerSheets || { set1: "", set2: "" };

    return normalizedCloud;
  }

  function comparableSave(save) {
    return JSON.stringify(toCloudSave(save));
  }

  function userDoc(user) {
    return db.collection("users").doc(user.uid);
  }

  async function writeNow(data) {
    const user = auth.currentUser;
    if (!user || syncing) return;

    try {
      setSaveStatus("Guardando...");
      await userDoc(user).set({
        save: toCloudSave(data),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        accountType: user.isAnonymous ? "anonymous" : "google"
      }, { merge: true });

      setSaveStatus(user.isAnonymous ? "Guardado en nube · Invitado" : "Guardado en nube");
    } catch (error) {
      console.error("Error guardando en Firestore:", error);
      setSaveStatus("Guardado local · Error de nube");
    }
  }

  NS.CloudSave = {
    queueSave(data) {
      if (!auth.currentUser) return;

      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        writeNow(data);
      }, 750);
    },

    async syncCurrentUser() {
      const user = auth.currentUser;
      if (!user) return { changed: false, source: "none" };

      syncing = true;
      setSaveStatus("Sincronizando...");

      try {
        const localSave = NS.Storage.load();
        const ref = userDoc(user);
        const snapshot = await ref.get();

        // Primer acceso de este UID: migramos el progreso local a Firestore.
        if (!snapshot.exists || !snapshot.data()?.save) {
          await ref.set({
            save: toCloudSave(localSave),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            accountType: user.isAnonymous ? "anonymous" : "google"
          }, { merge: true });

          setSaveStatus(user.isAnonymous ? "Guardado en nube · Invitado" : "Guardado en nube");
          return { changed: false, source: "local" };
        }

        // Si ya existe un guardado remoto, la nube tiene prioridad.
        const cloudSave = snapshot.data().save;
        const merged = mergeCloudIntoLocal(cloudSave, localSave);
        const changed = comparableSave(localSave) !== comparableSave(merged);

        if (changed) {
          NS.Storage.saveLocalOnly(merged);
        }

        setSaveStatus(user.isAnonymous ? "Guardado en nube · Invitado" : "Guardado en nube");
        return { changed, source: "cloud" };
      } catch (error) {
        console.error("Error sincronizando Firestore:", error);
        setSaveStatus("Guardado local · Error de nube");
        return { changed: false, source: "error", error };
      } finally {
        syncing = false;
      }
    }
  };
})();
