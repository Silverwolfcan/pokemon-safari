(function () {
  const NS = window.SafariGame = window.SafariGame || {};
  const auth = NS.firebaseAuth;

  if (!auth) {
    console.error("Firebase Auth no está inicializado.");
    return;
  }

  NS.AuthService = {
    currentUser: null,

    async loginAsGuest() {
      const result = await auth.signInAnonymously();
      this.currentUser = result.user;
      return result.user;
    },

    async loginWithGoogle() {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      this.currentUser = result.user;
      return result.user;
    },

    async logout() {
      await auth.signOut();
      this.currentUser = null;
    },

    onAuthChanged(callback) {
      return auth.onAuthStateChanged((user) => {
        this.currentUser = user;
        callback(user);
      });
    },

    isGuest() {
      return Boolean(this.currentUser && this.currentUser.isAnonymous);
    },

    isLoggedIn() {
      return Boolean(this.currentUser);
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const loginScreen = document.getElementById("loginScreen");
    const menuScreen = document.getElementById("menuScreen");
    const googleBtn = document.getElementById("loginGoogleBtn");
    const guestBtn = document.getElementById("loginGuestBtn");
    const status = document.getElementById("loginStatus");

    const accountBtn = document.getElementById("accountBtn");
    const accountOverlay = document.getElementById("accountOverlay");
    const accountCloseBtn = document.getElementById("accountCloseBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const accountGameProfileBtn = document.getElementById("accountGameProfileBtn");
    const accountSettingsBtn = document.getElementById("accountSettingsBtn");
    const accountMessage = document.getElementById("accountMessage");

    if (!loginScreen || !menuScreen || !googleBtn || !guestBtn || !status) {
      console.error("Faltan elementos de la pantalla de login en index.html.");
      return;
    }

    let processingAuth = false;

    function setBusy(isBusy) {
      googleBtn.disabled = isBusy;
      guestBtn.disabled = isBusy;
    }

    function showLogin() {
      loginScreen.classList.add("active");
      menuScreen.classList.remove("active");
      closeAccountPanel();
    }

    function showMenu() {
      loginScreen.classList.remove("active");
      menuScreen.classList.add("active");
      status.textContent = "";
    }

    function initialsFor(user) {
      if (!user) return "?";
      const source = user.displayName || user.email || "Invitado";
      const pieces = source.trim().split(/\s+/).filter(Boolean);
      if (pieces.length >= 2) return (pieces[0][0] + pieces[1][0]).toUpperCase();
      return source.slice(0, 2).toUpperCase();
    }

    function setAvatar(element, user) {
      if (!element) return;
      element.innerHTML = "";

      if (user?.photoURL && !user.isAnonymous) {
        const img = document.createElement("img");
        img.src = user.photoURL;
        img.alt = "";
        img.referrerPolicy = "no-referrer";
        element.appendChild(img);
      } else {
        element.textContent = initialsFor(user);
      }
    }

    function updateAccountUI(user) {
      const topName = document.getElementById("accountTopName");
      const topAvatar = document.getElementById("accountAvatar");
      const panelAvatar = document.getElementById("accountPanelAvatar");
      const displayName = document.getElementById("accountDisplayName");
      const email = document.getElementById("accountEmail");
      const accountType = document.getElementById("accountType");
      const accountSaveState = document.getElementById("accountSaveState");

      if (!user) {
        if (topName) topName.textContent = "Cuenta";
        if (displayName) displayName.textContent = "Sin sesión";
        if (email) email.textContent = "No has iniciado sesión";
        if (accountType) accountType.textContent = "—";
        if (accountSaveState) accountSaveState.textContent = "—";
        setAvatar(topAvatar, null);
        setAvatar(panelAvatar, null);
        return;
      }

      const name = user.isAnonymous
        ? "Invitado"
        : (user.displayName || user.email || "Jugador");

      if (topName) topName.textContent = name;
      if (displayName) displayName.textContent = name;
      if (email) {
        email.textContent = user.isAnonymous
          ? "Cuenta anónima de Firebase"
          : (user.email || "Sin correo disponible");
      }
      if (accountType) accountType.textContent = user.isAnonymous ? "Invitado" : "Google";
      if (accountSaveState) accountSaveState.textContent = NS.CloudSave ? "Nube activa" : "Solo local";

      setAvatar(topAvatar, user);
      setAvatar(panelAvatar, user);
    }

    function openAccountPanel() {
      const user = auth.currentUser;
      if (!user || !accountOverlay) return;

      updateAccountUI(user);
      accountMessage.textContent = "";
      accountOverlay.classList.remove("hidden");
      accountOverlay.setAttribute("aria-hidden", "false");
    }

    function closeAccountPanel() {
      if (!accountOverlay) return;
      accountOverlay.classList.add("hidden");
      accountOverlay.setAttribute("aria-hidden", "true");
      if (accountMessage) accountMessage.textContent = "";
    }

    function readableError(error) {
      console.error("Firebase Auth:", error);

      switch (error && error.code) {
        case "auth/popup-closed-by-user":
          return "Has cerrado la ventana de Google antes de completar el acceso.";
        case "auth/popup-blocked":
          return "El navegador ha bloqueado la ventana de Google. Permite ventanas emergentes para esta web.";
        case "auth/unauthorized-domain":
          return "Este dominio no está autorizado en Firebase Authentication.";
        case "auth/network-request-failed":
          return "No se ha podido conectar con Firebase. Comprueba tu conexión.";
        case "auth/operation-not-allowed":
          return "Este método de acceso no está habilitado en Firebase.";
        default:
          return "No se pudo completar la operación. Revisa la consola del navegador si el problema continúa.";
      }
    }

    googleBtn.addEventListener("click", async () => {
      setBusy(true);
      status.textContent = "Abriendo Google...";

      try {
        await NS.AuthService.loginWithGoogle();
      } catch (error) {
        status.textContent = readableError(error);
        setBusy(false);
      }
    });

    guestBtn.addEventListener("click", async () => {
      setBusy(true);
      status.textContent = "Creando sesión de invitado...";

      try {
        await NS.AuthService.loginAsGuest();
      } catch (error) {
        status.textContent = readableError(error);
        setBusy(false);
      }
    });

    accountBtn?.addEventListener("click", openAccountPanel);
    accountCloseBtn?.addEventListener("click", closeAccountPanel);

    accountOverlay?.addEventListener("click", (event) => {
      if (event.target === accountOverlay) closeAccountPanel();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && accountOverlay && !accountOverlay.classList.contains("hidden")) {
        closeAccountPanel();
      }
    });

    accountGameProfileBtn?.addEventListener("click", () => {
      closeAccountPanel();
      document.getElementById("profileBtn")?.click();
    });

    accountSettingsBtn?.addEventListener("click", () => {
      closeAccountPanel();
      document.getElementById("settingsBtn")?.click();
    });

    logoutBtn?.addEventListener("click", async () => {
      logoutBtn.disabled = true;
      accountMessage.textContent = "Cerrando sesión...";

      try {
        await NS.AuthService.logout();
        closeAccountPanel();
      } catch (error) {
        accountMessage.textContent = readableError(error);
      } finally {
        logoutBtn.disabled = false;
      }
    });

    NS.AuthService.onAuthChanged(async (user) => {
      if (processingAuth) return;
      processingAuth = true;

      try {
        updateAccountUI(user);

        if (!user) {
          setBusy(false);
          showLogin();
          return;
        }

        status.textContent = "Cargando progreso...";

        if (NS.CloudSave) {
          const result = await NS.CloudSave.syncCurrentUser();

          if (result.changed) {
            window.location.reload();
            return;
          }
        }

        setBusy(false);
        updateAccountUI(user);
        showMenu();
      } finally {
        processingAuth = false;
      }
    });

    showLogin();
  });
})();
