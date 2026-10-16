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

    if (!loginScreen || !menuScreen || !googleBtn || !guestBtn || !status) {
      console.error("Faltan elementos de la pantalla de login en index.html.");
      return;
    }

    let authResolved = false;

    function setBusy(isBusy) {
      googleBtn.disabled = isBusy;
      guestBtn.disabled = isBusy;
    }

    function showLogin() {
      loginScreen.classList.add("active");
      menuScreen.classList.remove("active");
    }

    function showMenu() {
      loginScreen.classList.remove("active");
      menuScreen.classList.add("active");
      status.textContent = "";
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
          return "No se pudo iniciar sesión. Revisa la consola del navegador si el problema continúa.";
      }
    }

    googleBtn.addEventListener("click", async () => {
      setBusy(true);
      status.textContent = "Abriendo Google...";

      try {
        await NS.AuthService.loginWithGoogle();
        showMenu();
      } catch (error) {
        status.textContent = readableError(error);
      } finally {
        setBusy(false);
      }
    });

    guestBtn.addEventListener("click", async () => {
      setBusy(true);
      status.textContent = "Creando sesión de invitado...";

      try {
        await NS.AuthService.loginAsGuest();
        showMenu();
      } catch (error) {
        status.textContent = readableError(error);
      } finally {
        setBusy(false);
      }
    });

    NS.AuthService.onAuthChanged((user) => {
      authResolved = true;

      if (user) {
        showMenu();
      } else {
        showLogin();
      }
    });

    if (!authResolved) {
      showLogin();
    }
  });
})();
