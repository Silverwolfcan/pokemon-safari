(function () {
  const NS = window.SafariGame = window.SafariGame || {};
  let save = NS.Storage.load();
  let game = null;
  let toastTimer = 0;
  let dexAnimationId = 0;
  let dexSprites = null;
  let dexCanvases = [];
  let profileAnimationId = 0;
  let profileRepo = null;
  let profileCards = [];
  let dexFilterState = { search:'', status:'all', rarity:'all', habitat:'all', type:'all' };

  const $ = id => document.getElementById(id);
  const screens = [...document.querySelectorAll('.screen')];

  function refreshAudioButton(){
    const b=$('audioToggleBtn'); if(!b)return;
    const on=NS.Audio?.enabled!==false;
    b.textContent=on?'Audio: ON':'Audio: OFF';
    b.classList.toggle('off',!on);
  }

  function refreshAudioSettings(){
    const a=NS.Audio;if(!a)return;
    const st=a.getSettings();
    $('masterVolumeSlider').value=Math.round(st.masterVolume*100);
    $('musicVolumeSlider').value=Math.round(st.musicVolume*100);
    $('sfxVolumeSlider').value=Math.round(st.sfxVolume*100);
    $('masterVolumeValue').textContent=`${Math.round(st.masterVolume*100)}%`;
    $('musicVolumeValue').textContent=`${Math.round(st.musicVolume*100)}%`;
    $('sfxVolumeValue').textContent=`${Math.round(st.sfxVolume*100)}%`;
    $('muteAllBtn').textContent=st.muted?'Activar sonido':'Silenciar todo';
    refreshAudioButton();
  }

  function stopDexAnimation() {
    if (dexAnimationId) cancelAnimationFrame(dexAnimationId);
    dexAnimationId = 0;
    dexCanvases = [];
  }

  function stopProfileAnimation() {
    if (profileAnimationId) cancelAnimationFrame(profileAnimationId);
    profileAnimationId = 0;
    profileCards = [];
  }

  function show(id) {
    if (id !== 'pokedexScreen') stopDexAnimation();
    if (id !== 'profileScreen') stopProfileAnimation();
    screens.forEach(s => s.classList.toggle('active', s.id === id));
  }

  function shinyTotal() {
    return Object.values(save.dex).reduce((a, d) => a + (d.shiny || 0), 0);
  }

  function caughtSpeciesCount() {
    return NS.SPECIES.filter(s => save.dex[s.id]?.count > 0).length;
  }

  function formatPlaytime(totalSeconds) {
    const total=Math.max(0,Math.floor(totalSeconds||0));
    const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),sec=total%60;
    return h>0?`${h} h ${String(m).padStart(2,'0')} min`:`${m} min ${String(sec).padStart(2,'0')} s`;
  }

  function refreshMenu() {
    $('menuCoins').textContent = save.coins;
    $('menuDex').textContent = `${caughtSpeciesCount()} / ${NS.SPECIES.length}`;
    $('menuShinies').textContent = shinyTotal();
    $('menuPlaytime').textContent = formatPlaytime(save.totalRunSeconds||0);
    $('menuIntro').textContent = `Explora, prepara el encuentro y completa la Pokédex. Esta versión incluye ${NS.SPECIES.length} especies de Kanto.`;
    const habitatLevel=save.upgrades.habitatLicense||0;
    $('dexIntro').textContent = `${NS.SPECIES.length} especies de Kanto. Licencia de hábitats: nivel ${habitatLevel}/4. Cada especie aparece con más frecuencia en sus zonas naturales.`;
  }

  function newRun() {
    show('gameScreen');
    const canvas = $('gameCanvas');
    resizeCanvas(canvas);
    game = new NS.Game(canvas, save, onRunEnd, onHud, showToast);
    game.start();
  }

  function resizeCanvas(canvas) {
    const r = canvas.parentElement.getBoundingClientRect();
    const aspect = r.width / r.height;
    if (aspect > 16 / 9) {
      canvas.width = Math.round(720 * aspect);
      canvas.height = 720;
    } else {
      canvas.width = 1280;
      canvas.height = Math.round(1280 / aspect);
    }
  }

  function onHud(h) {
    $('ballsHud').textContent = h.balls;
    $('stepsHud').textContent = h.steps;
    const seconds=Math.max(0,Math.ceil(h.timeLeft||0));
    $('timeHud').textContent = `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    $('habitatHud').textContent = h.habitatName || 'Pradera';
    $('baitHud').textContent = h.bait;
    $('rocksHud').textContent = h.rocks;
    $('capturesHud').textContent = h.captures;
    $('toolHud').textContent = h.tool === 'bait' ? 'Cebo' : 'Piedra';
    $('chargeBar').classList.toggle('hidden', !h.charging);
    $('chargeFill').style.width = `${Math.round(h.charge * 100)}%`;
  }

  function showToast(msg) {
    clearTimeout(toastTimer);
    $('toast').textContent = msg;
    $('toast').classList.remove('hidden');
    toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 2300);
  }

  function onRunEnd(r) {
    $('summaryTitle').textContent = r.reason;
    const sec=Math.max(0,Math.ceil(r.timeLeft||0));
    $('summaryStats').innerHTML = `<div><span class="label">Capturas</span><strong>${r.captures}</strong></div><div><span class="label">Monedas ganadas</span><strong>${r.coins}</strong></div><div><span class="label">Balls restantes</span><strong>${r.balls}</strong></div><div><span class="label">Tiempo restante</span><strong>${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}</strong></div>`;
    $('summaryNew').innerHTML = r.newEntries.length
      ? r.newEntries.map(id => `<strong>${NS.SPECIES_BY_ID[id].name}</strong>`).join(' · ')
      : '<span style="color:#91a499">Ninguna entrada nueva en esta expedición.</span>';
    show('summaryScreen');
  }

  function drawDexLoop(t) {
    for (const item of dexCanvases) {
      const c = item.canvas;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      dexSprites.drawPreview(ctx, item.species, c.width, c.height, t, item.shiny, item.silhouette);
    }
    dexAnimationId = requestAnimationFrame(drawDexLoop);
  }

  function matchesDexFilters(s) {
    const d=save.dex[s.id];
    const q=dexFilterState.search.trim().toLocaleLowerCase('es');
    if(q){
      const number=String(s.id);
      const padded=String(s.id).padStart(3,'0');
      if(!s.name.toLocaleLowerCase('es').includes(q) && !number.includes(q) && !padded.includes(q)) return false;
    }
    if(dexFilterState.status==='caught' && !d) return false;
    if(dexFilterState.status==='uncaught' && d) return false;
    if(dexFilterState.status==='shiny' && !(d?.shiny>0)) return false;
    if(dexFilterState.rarity!=='all' && s.rarity!==dexFilterState.rarity) return false;
    if(dexFilterState.habitat!=='all' && !s.habitats.includes(dexFilterState.habitat)) return false;
    if(dexFilterState.type!=='all' && !s.types.includes(dexFilterState.type)) return false;
    return true;
  }

  function rebuildDexCards() {
    stopDexAnimation();
    dexSprites = dexSprites || new NS.SpriteRepository();
    dexCanvases = [];
    const grid = $('pokedexGrid');
    grid.innerHTML = '';
    const species=NS.SPECIES.filter(matchesDexFilters);
    $('dexResultCount').textContent=`${species.length} resultado${species.length===1?'':'s'}`;

    for (const s of species) {
      const d = save.dex[s.id];
      const card = document.createElement('div');
      card.className = 'dex-card' + (d ? '' : ' unknown');

      const number = document.createElement('div');
      number.className = 'number';
      number.textContent = `#${String(s.id).padStart(3, '0')} · ${s.rarity}`;
      card.appendChild(number);

      const stage = document.createElement('div');
      stage.className = 'dex-sprite-stage';
      const canvas = document.createElement('canvas');
      canvas.width = 140; canvas.height = 104;
      stage.appendChild(canvas); card.appendChild(stage);

      const name = document.createElement('div');
      name.className = 'name'; name.textContent = d ? s.name : '???'; card.appendChild(name);
      const count = document.createElement('div');
      count.className = 'count';
      count.innerHTML = d ? `Capturados: ${d.count}${d.shiny ? ` · <span class="shiny-star">★ ${d.shiny}</span>` : ''}` : 'No registrado';
      card.appendChild(count);

      const preview = { canvas, species: s, shiny: false, silhouette: !d };
      dexCanvases.push(preview);
      if (d) {
        const variants = document.createElement('div'); variants.className = 'dex-variants';
        const normalBtn = document.createElement('button'); normalBtn.type='button'; normalBtn.className='active'; normalBtn.textContent='Normal';
        const shinyBtn = document.createElement('button'); shinyBtn.type='button'; shinyBtn.textContent=d.shiny>0?'★ Shiny':'★ Shiny 🔒'; shinyBtn.disabled=!(d.shiny>0);
        normalBtn.onclick=()=>{preview.shiny=false;normalBtn.classList.add('active');shinyBtn.classList.remove('active');};
        shinyBtn.onclick=()=>{if(!d.shiny)return;preview.shiny=true;shinyBtn.classList.add('active');normalBtn.classList.remove('active');};
        variants.append(normalBtn,shinyBtn);card.appendChild(variants);
      }
      grid.appendChild(card);
    }
    if(!species.length){
      const empty=document.createElement('div');empty.className='dex-empty';empty.textContent='No hay Pokémon que coincidan con estos filtros.';grid.appendChild(empty);
    }
    dexAnimationId = requestAnimationFrame(drawDexLoop);
  }

  function buildDex() {
    dexSprites = new NS.SpriteRepository();
    dexFilterState={search:'',status:'all',rarity:'all',habitat:'all',type:'all'};
    $('dexSearch').value=''; $('dexStatusFilter').value='all'; $('dexRarityFilter').value='all';
    const habitatSel=$('dexHabitatFilter');
    habitatSel.innerHTML='<option value="all">Todos los biomas</option>'+NS.HABITAT_ORDER.map(id=>`<option value="${id}">${NS.HABITATS[id].name}</option>`).join('');
    const types=[...new Set(NS.SPECIES.flatMap(s=>s.types))].sort((a,b)=>(NS.TYPE_NAMES[a]||a).localeCompare(NS.TYPE_NAMES[b]||b,'es'));
    const typeSel=$('dexTypeFilter');
    typeSel.innerHTML='<option value="all">Todos los tipos</option>'+types.map(t=>`<option value="${t}">${NS.TYPE_NAMES[t]||t}</option>`).join('');
    habitatSel.value='all';typeSel.value='all';
    rebuildDexCards();
  }

  function buildShop() {
    $('shopCoins').textContent = save.coins;
    const grid = $('shopGrid');
    grid.innerHTML = '';
    for (const item of NS.SHOP_ITEMS) {
      const lv = save.upgrades[item.id] || 0;
      const cost = NS.getUpgradeCost(item, lv);
      const maxed = lv >= item.max;
      let locked = false;
      let unlockText = '';
      if (!maxed && item.unlockDexFractions?.length) {
        const fraction = item.unlockDexFractions[Math.min(lv, item.unlockDexFractions.length - 1)];
        const required = Math.ceil(NS.SPECIES.length * fraction);
        const current = caughtSpeciesCount();
        locked = current < required;
        unlockText = `<div class="level">Desbloqueo: ${current}/${required} especies registradas</div>`;
      }
      const card = document.createElement('div');
      card.className = 'shop-card';
      const buttonLabel = maxed ? 'Máximo' : locked ? 'Bloqueado' : `Comprar · ${cost} monedas`;
      card.innerHTML = `<h3>${item.name}</h3><p>${item.desc}</p><div class="level">Nivel ${lv}/${item.max}</div>${unlockText}<button ${(maxed||locked) ? 'disabled' : ''}>${buttonLabel}</button>`;
      card.querySelector('button').onclick = () => {
        if (maxed || locked || save.coins < cost) return;
        save.coins -= cost;
        save.upgrades[item.id] = lv + 1;
        NS.Storage.save(save);
        NS.Audio?.sfx('coin',.92);
        buildShop();
        refreshMenu();
      };
      grid.appendChild(card);
    }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      if (file.type && file.type !== 'image/png') return reject(new Error(`${file.name}: debe ser un PNG.`));
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  async function importTrainerPack() {
    const f1 = $('trainerSet1Input').files?.[0];
    const f2 = $('trainerSet2Input').files?.[0];
    if (!f1 && !f2) {
      $('trainerPackStatus').textContent = 'Selecciona OpenmonSpriteSet1.png y/o OpenmonSpriteSet2.png antes de importar.';
      return;
    }

    $('trainerPackStatus').textContent = 'Importando pack...';
    try {
      const [set1, set2] = await Promise.all([fileToDataUrl(f1), fileToDataUrl(f2)]);
      if (set1) save.profile.trainerSheets.set1 = set1;
      if (set2) save.profile.trainerSheets.set2 = set2;
      NS.Storage.save(save);
      await buildProfile();
    } catch (e) {
      $('trainerPackStatus').textContent = e.message || 'No se pudo importar el pack.';
    }
  }

  function clearTrainerPack() {
    save.profile.trainerSheets = { set1: '', set2: '' };
    save.profile.trainerId = 0;
    NS.Storage.save(save);
    buildProfile();
  }

  function drawProfileLoop(t) {
    for (const item of profileCards) {
      const ctx = item.canvas.getContext('2d');
      profileRepo.drawPreview(ctx, item.id, item.canvas.width, item.canvas.height, t);
    }
    profileAnimationId = requestAnimationFrame(drawProfileLoop);
  }

  async function buildProfile() {
    stopProfileAnimation();
    $('profileDex').textContent = `${caughtSpeciesCount()} / ${NS.SPECIES.length}`;
    $('profileCaptures').textContent = save.totalCaptures || 0;
    $('profileShinies').textContent = shinyTotal();
    $('profileRuns').textContent = save.runs || 0;
    $('profilePlaytime').textContent = formatPlaytime(save.totalRunSeconds||0);
    $('profileCoins').textContent = save.coins || 0;

    const grid = $('trainerGrid');
    grid.innerHTML = '<div class="trainer-loading">Cargando entrenadores...</div>';
    profileRepo = new NS.TrainerRepository(save.profile || {});
    await profileRepo.ready();

    grid.innerHTML = '';
    profileCards = [];
    const imported = profileRepo.hasOpenmonPack();
    const count = imported ? profileRepo.count : 1;

    if (imported) {
      $('trainerPackStatus').textContent = `Pack cargado: ${count} entrenadores disponibles. El atlas Openmon se recorta en frames fijos de 18×26 px.`;
      if (save.profile.trainerId >= count) save.profile.trainerId = 0;
    } else {
      $('trainerPackStatus').textContent = profileRepo.error
        ? `${profileRepo.error} Se usa el entrenador de respaldo.`
        : 'Pack Openmon todavía no importado. Se usa temporalmente el entrenador de respaldo.';
      save.profile.trainerId = 0;
    }
    NS.Storage.save(save);

    for (let i = 0; i < count; i++) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'trainer-card' + (i === save.profile.trainerId ? ' selected' : '');

      const canvas = document.createElement('canvas');
      canvas.width = 112;
      canvas.height = 116;
      card.appendChild(canvas);

      const label = document.createElement('span');
      label.textContent = imported ? `Entrenador ${String(i + 1).padStart(2, '0')}` : 'Entrenador de respaldo';
      card.appendChild(label);

      if (i === save.profile.trainerId) {
        const badge = document.createElement('strong');
        badge.className = 'selected-badge';
        badge.textContent = 'Seleccionado';
        card.appendChild(badge);
      }

      card.onclick = () => {
        save.profile.trainerId = i;
        NS.Storage.save(save);
        buildProfile();
      };

      profileCards.push({ id: i, canvas });
      grid.appendChild(card);
    }

    profileAnimationId = requestAnimationFrame(drawProfileLoop);
  }

  document.addEventListener('pointerdown',()=>NS.Audio?.activate(),{once:true});
  document.addEventListener('keydown',()=>NS.Audio?.activate(),{once:true});
  document.addEventListener('click',e=>{if(e.target.closest('button,.button-link'))NS.Audio?.sfx('click',.42);});
  document.addEventListener('safari-music-changed',e=>{if($('musicNow'))$('musicNow').textContent=e.detail?.name||'Música';});
  document.addEventListener('safari-audio-settings-changed',refreshAudioSettings);
  $('audioToggleBtn').onclick=()=>{NS.Audio?.activate();NS.Audio?.toggle();refreshAudioSettings();};
  $('masterVolumeSlider').addEventListener('input',e=>{NS.Audio?.activate();NS.Audio?.setMasterVolume(Number(e.target.value)/100);refreshAudioSettings();});
  $('musicVolumeSlider').addEventListener('input',e=>{NS.Audio?.activate();NS.Audio?.setMusicVolume(Number(e.target.value)/100);refreshAudioSettings();});
  $('sfxVolumeSlider').addEventListener('input',e=>{NS.Audio?.activate();NS.Audio?.setSfxVolume(Number(e.target.value)/100);refreshAudioSettings();});
  $('muteAllBtn').onclick=()=>{NS.Audio?.activate();NS.Audio?.toggle();refreshAudioSettings();};

  $('dexSearch').addEventListener('input', e => { dexFilterState.search=e.target.value; rebuildDexCards(); });
  $('dexStatusFilter').addEventListener('change', e => { dexFilterState.status=e.target.value; rebuildDexCards(); });
  $('dexRarityFilter').addEventListener('change', e => { dexFilterState.rarity=e.target.value; rebuildDexCards(); });
  $('dexHabitatFilter').addEventListener('change', e => { dexFilterState.habitat=e.target.value; rebuildDexCards(); });
  $('dexTypeFilter').addEventListener('change', e => { dexFilterState.type=e.target.value; rebuildDexCards(); });

  $('newRunBtn').onclick = newRun;
  $('pokedexBtn').onclick = () => { buildDex(); show('pokedexScreen'); };
  $('shopBtn').onclick = () => { buildShop(); show('shopScreen'); };
  $('profileBtn').onclick = async () => { show('profileScreen'); await buildProfile(); };
  $('settingsBtn').onclick = () => { refreshAudioSettings(); show('settingsScreen'); };
  $('importTrainerPackBtn').onclick = importTrainerPack;
  $('clearTrainerPackBtn').onclick = clearTrainerPack;
  $('summaryBackBtn').onclick = () => {
    save = NS.Storage.load();
    refreshMenu();
    show('menuScreen');
  };

  document.querySelectorAll('.backBtn').forEach(b => b.onclick = () => {
    refreshMenu();
    show('menuScreen');
  });

  $('resetBtn').onclick = () => {
    if (confirm('¿Seguro que quieres borrar Pokédex, monedas, mejoras y perfil?')) {
      save = NS.Storage.reset();
      refreshMenu();
    }
  };

  window.addEventListener('resize', () => {
    if (game && game.running) {
      const c = $('gameCanvas');
      resizeCanvas(c);
      game.width = c.width;
      game.height = c.height;
    }
  });

  refreshMenu();
  refreshAudioSettings();
  show('menuScreen');
})();
