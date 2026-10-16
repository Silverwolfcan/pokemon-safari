(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  const AUDIO_CONFIG = {
    music: [
      { id:'flowerbed', name:'Flowerbed Fields', url:'https://opengameart.org/sites/default/files/flowerbed_fields.ogg' },
      { id:'arplands', name:'The Arplands', url:'https://opengameart.org/sites/default/files/the_arplands_0.ogg' },
      { id:'heroic', name:'Heroic Loop', url:'https://opengameart.org/sites/default/files/heroic_loop.wav' },
      { id:'cave', name:'8-bit Cave Loop', url:'https://opengameart.org/sites/default/files/CaveLoop.wav' }
    ],
    sfx: {
      click:'https://opengameart.org/sites/default/files/click_2.wav',
      coin:'https://opengameart.org/sites/default/files/coin_1.wav',
      pickup:'https://opengameart.org/sites/default/files/pick_up.wav',
      newDex:'https://opengameart.org/sites/default/files/level_up.wav',
      capture:'https://opengameart.org/sites/default/files/level_passed.wav',
      specialCapture:'https://opengameart.org/sites/default/files/level_passed_2.wav',
      shinySpawn:'https://opengameart.org/sites/default/files/health_restore.wav',
      fail:'https://opengameart.org/sites/default/files/fail.wav',
      hit:'https://opengameart.org/sites/default/files/damaged.wav',
      gameOver:'https://opengameart.org/sites/default/files/game_over_0.wav'
    }
  };

  const clamp01=v=>Math.max(0,Math.min(1,Number(v)||0));

  class AudioManager {
    constructor() {
      this.masterVolume = 0.85;
      this.musicVolume = 0.40;
      this.sfxVolume = 0.62;
      this.muted = false;
      this.activated = false;
      this.current = null;
      this.currentIndex = -1;
      this.lastIndex = -1;
      this.failCount = 0;
      this.settingsKey = 'pokemonSafariAudioSettingsV2';
      this.loadSettings();
      this.preloadedSfx = new Map();
      this.musicPool = [];
      this.preloadSfx();
      this.preloadMusic();
    }

    get enabled(){ return !this.muted; }

    loadSettings() {
      try {
        const raw = localStorage.getItem(this.settingsKey) || localStorage.getItem('pokemonSafariAudioSettingsV1');
        if (!raw) return;
        const s = JSON.parse(raw);
        if (typeof s.muted === 'boolean') this.muted = s.muted;
        else if (typeof s.enabled === 'boolean') this.muted = !s.enabled;
        if (Number.isFinite(s.masterVolume)) this.masterVolume = clamp01(s.masterVolume);
        if (Number.isFinite(s.musicVolume)) this.musicVolume = clamp01(s.musicVolume);
        if (Number.isFinite(s.sfxVolume)) this.sfxVolume = clamp01(s.sfxVolume);
      } catch (_) {}
    }

    saveSettings() {
      try { localStorage.setItem(this.settingsKey, JSON.stringify({muted:this.muted,masterVolume:this.masterVolume,musicVolume:this.musicVolume,sfxVolume:this.sfxVolume})); } catch (_) {}
      document.dispatchEvent(new CustomEvent('safari-audio-settings-changed',{detail:this.getSettings()}));
    }

    getSettings(){
      return {muted:this.muted,masterVolume:this.masterVolume,musicVolume:this.musicVolume,sfxVolume:this.sfxVolume};
    }

    effectiveMusicVolume(){ return this.muted ? 0 : this.masterVolume*this.musicVolume; }
    effectiveSfxVolume(scale=1){ return this.muted ? 0 : this.masterVolume*this.sfxVolume*scale; }

    preloadSfx() {
      for (const [id,url] of Object.entries(AUDIO_CONFIG.sfx)) {
        const a = new Audio();
        a.preload = 'auto';
        a.src = url;
        try{a.load();}catch(_){}
        this.preloadedSfx.set(id,a);
      }
    }

    preloadMusic(){
      this.musicPool=AUDIO_CONFIG.music.map(track=>{
        const a=new Audio();
        a.preload='auto';
        a.src=track.url;
        a.loop=false;
        try{a.load();}catch(_){}
        return {track,a};
      });
    }

    activate() {
      if (this.activated) {
        if(!this.muted && (!this.current || this.current.paused)) this.resumeMusic();
        return;
      }
      this.activated = true;
      if (!this.muted) this.playNextMusic();
    }

    setMuted(value) {
      this.muted=!!value;
      if(this.current)this.current.volume=this.effectiveMusicVolume();
      if(this.muted){ if(this.current)this.current.pause(); }
      else if(this.activated)this.resumeMusic();
      this.saveSettings();
    }

    setEnabled(value){ this.setMuted(!value); }
    toggle(){ this.setMuted(!this.muted); return !this.muted; }

    setMasterVolume(v){ this.masterVolume=clamp01(v); this.applyMusicVolume(); this.saveSettings(); }
    setMusicVolume(v){ this.musicVolume=clamp01(v); this.applyMusicVolume(); this.saveSettings(); }
    setSfxVolume(v){ this.sfxVolume=clamp01(v); this.saveSettings(); }
    applyMusicVolume(){ if(this.current)this.current.volume=this.effectiveMusicVolume(); }

    pickNextIndex() {
      if (AUDIO_CONFIG.music.length <= 1) return 0;
      let idx = Math.floor(Math.random()*AUDIO_CONFIG.music.length), guard=0;
      while (idx === this.lastIndex && guard++ < 20) idx = Math.floor(Math.random()*AUDIO_CONFIG.music.length);
      return idx;
    }

    resumeMusic(){
      if(this.muted||!this.activated)return;
      if(this.current){
        this.current.volume=this.effectiveMusicVolume();
        this.current.play().catch(()=>this.playNextMusic());
      }else this.playNextMusic();
    }

    playNextMusic() {
      if (this.muted || !this.activated || !this.musicPool.length) return;
      if (this.current) {
        this.current.onended = null;
        this.current.onerror = null;
        this.current.pause();
      }
      const idx = this.pickNextIndex();
      const entry=this.musicPool[idx];
      const track=entry.track, a=entry.a;
      this.currentIndex=idx;this.lastIndex=idx;this.current=a;
      this.failCount=0;
      try{a.currentTime=0;}catch(_){}
      a.volume=this.effectiveMusicVolume();
      a.onended=()=>this.playNextMusic();
      a.onerror=()=>{
        this.failCount++;
        if(this.failCount<=this.musicPool.length)setTimeout(()=>this.playNextMusic(),120);
      };
      // Las pistas se precargan desde el arranque; tras el primer gesto del usuario
      // play() puede comenzar en cuanto el navegador tenga buffer suficiente.
      const playPromise=a.play();
      if(playPromise && typeof playPromise.catch==='function'){
        playPromise.catch(()=>{
          // Si una pista remota falla o tarda demasiado en estar disponible,
          // saltamos a otra para evitar silencios prolongados.
          if(this.current===a)setTimeout(()=>this.playNextMusic(),180);
        });
      }
      document.dispatchEvent(new CustomEvent('safari-music-changed',{detail:{name:track.name}}));
    }

    sfx(id, volumeScale=1) {
      if (this.muted || !this.activated) return;
      const base=this.preloadedSfx.get(id), url=AUDIO_CONFIG.sfx[id];
      if(!url)return;
      const a=base?base.cloneNode(true):new Audio(url);
      a.volume=clamp01(this.effectiveSfxVolume(volumeScale));
      const playPromise=a.play();
      if(playPromise && typeof playPromise.catch==='function'){
        playPromise.catch(()=>{
          // Si una pista remota falla o tarda demasiado en estar disponible,
          // saltamos a otra para evitar silencios prolongados.
          if(this.current===a)setTimeout(()=>this.playNextMusic(),180);
        });
      }
    }

    stopMusic(){ if(this.current)this.current.pause(); }
  }

  NS.AUDIO_CONFIG=AUDIO_CONFIG;
  NS.Audio=new AudioManager();
})();
