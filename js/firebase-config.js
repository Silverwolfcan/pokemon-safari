const firebaseConfig = {
  apiKey: "AIzaSyDV0A2AEZLjfmGZzTC7E1RdEBosiCXpViY",
  authDomain: "pokemon-safari-a4ba3.firebaseapp.com",
  projectId: "pokemon-safari-a4ba3",
  storageBucket: "pokemon-safari-a4ba3.firebasestorage.app",
  messagingSenderId: "71464273060",
  appId: "1:71464273060:web:82157fdad2ceabd21f9231"
};

window.SafariGame = window.SafariGame || {};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

window.SafariGame.firebaseConfig = firebaseConfig;
window.SafariGame.firebaseAuth = firebase.auth();
