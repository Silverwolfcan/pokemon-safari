(function () {
  const NS = window.SafariGame = window.SafariGame || {};
  let save = NS.Storage.load();
  let game = null;
  let settingsReturnScreen = 'menuScreen';
  let resumeRunAfterSettings = false;
  let toastTimer = 0;
  let dexAnimationId = 0;
  let dexSprites = null;
  let dexCanvases = [];
  let profileAnimationId = 0;
  let profileRepo = null;
  let profileCards = [];
  let dexFilterState = { region:'kanto', search:'', status:'all', rarity:'all', habitat:'all', type:'all' };

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

  function getActiveScreenId() {
    return screens.find(s => s.classList.contains('active'))?.id || 'menuScreen';
  }

  function hideOverlay(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
  }

  function disposeRunSilently() {
    if (!game) {
      if (NS.activeGame && !NS.activeGame.running) NS.activeGame = null;
      return;
    }

    try {
      game.running = false;
      game.paused = false;
      game.keys = {};
      game.unbindInput?.();
    } catch (_) {}

    if (NS.activeGame === game) NS.activeGame = null;

    hideOverlay('pauseOverlay');
    hideOverlay('abandonConfirmOverlay');
    hideOverlay('regionSelectOverlay');

    game = null;
    resumeRunAfterSettings = false;
    settingsReturnScreen = 'menuScreen';
  }

  function show(id, options = {}) {
    if (id !== 'pokedexScreen') stopDexAnimation();
    if (id !== 'profileScreen') stopProfileAnimation();

    const previous = getActiveScreenId();
    const preserveRun = !!options.preserveRun;

    if (!preserveRun && previous === 'gameScreen' && id !== 'gameScreen' && game?.running) {
      disposeRunSilently();
    }

    screens.forEach(s => s.classList.toggle('active', s.id === id));
    return previous;
  }

  function shinyTotal() {
    return Object.values(save.dex).reduce((a, d) => a + (d.shiny || 0), 0);
  }

  function shinySpeciesCount() {
    return NS.SPECIES.filter(s => (save.dex[s.id]?.shiny || 0) > 0).length;
  }

  function caughtSpeciesCount() {
    return NS.SPECIES.filter(s => save.dex[s.id]?.count > 0).length;
  }

  function unlockedSpeciesList() {
    return NS.unlockedSpecies
      ? NS.unlockedSpecies(save)
      : NS.SPECIES;
  }

  function caughtUnlockedSpeciesCount() {
    return unlockedSpeciesList().filter(
      s => save.dex[s.id]?.count > 0
    ).length;
  }

  function shinyUnlockedSpeciesCount() {
    return unlockedSpeciesList().filter(
      s => (save.dex[s.id]?.shiny || 0) > 0
    ).length;
  }

  function formatPlaytime(totalSeconds) {
    const total=Math.max(0,Math.floor(totalSeconds||0));
    const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),sec=total%60;
    return h>0?`${h} h ${String(m).padStart(2,'0')} min`:`${m} min ${String(sec).padStart(2,'0')} s`;
  }

  function refreshMenu() {
    const topCoins = $('topCoins');
    const topDex = $('topDex');
    const topShinyDex = $('topShinyDex');
    const topPlaytime = $('topPlaytime');

    if (topCoins) topCoins.textContent = save.coins;
    const unlockedSpecies = unlockedSpeciesList();
    if (topDex) topDex.textContent = `${caughtUnlockedSpeciesCount()} / ${unlockedSpecies.length}`;
    if (topShinyDex) topShinyDex.textContent = `${shinyUnlockedSpeciesCount()} / ${unlockedSpecies.length}`;
    if (topPlaytime) topPlaytime.textContent = formatPlaytime(save.totalRunSeconds || 0);

    $('menuIntro').textContent = `Explora, prepara el encuentro y completa la Pokédex. ${NS.SPECIES.length} especies disponibles entre las regiones cargadas.`;
    const habitatLevel=save.upgrades.habitatLicense||0;
    $('dexIntro').textContent = `${NS.SPECIES.length} especies cargadas. Licencia de hábitats: nivel ${habitatLevel}/4. Las distintas formas comparten una única entrada de Pokédex.`;
  }

  function startRunForRegion(regionId) {
    disposeRunSilently();
    save.profile = save.profile || {};
    save.profile.activeRegion = regionId;
    NS.Storage.save(save);

    $('regionSelectOverlay')?.classList.add('hidden');
    $('regionSelectOverlay')?.setAttribute('aria-hidden','true');

    show('gameScreen');

    const canvas = $('gameCanvas');
    resizeCanvas(canvas);

    game = new NS.Game(
      canvas,
      save,
      onRunEnd,
      onHud,
      showToast
    );

    game.start();
  }

  function openRegionSelector() {
    const regions = NS.availableRegions
      ? NS.availableRegions(save)
      : [{id:'kanto',name:'Kanto'}];

    if (regions.length <= 1) {
      startRunForRegion(regions[0]?.id || 'kanto');
      return;
    }

    const grid = $('runRegionGrid');
    grid.innerHTML = '';

    for (const region of regions) {
      const speciesCount = NS.SPECIES.filter(
        s => NS.regionForSpecies(s) === region.id
      ).length;

      const caught = NS.SPECIES.filter(
        s =>
          NS.regionForSpecies(s) === region.id &&
          save.dex[s.id]?.count > 0
      ).length;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'run-region-card';
      button.innerHTML = `
        <strong>${region.name}</strong>
        <span>${caught} / ${speciesCount} registrados</span>
      `;

      button.onclick = () =>
        startRunForRegion(region.id);

      grid.appendChild(button);
    }

    $('regionSelectOverlay').classList.remove('hidden');
    $('regionSelectOverlay').setAttribute('aria-hidden','false');
  }

  function newRun() {
    openRegionSelector();
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
    resumeRunAfterSettings = false;
    settingsReturnScreen = 'menuScreen';
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

    if (dexFilterState.region && NS.regionForSpecies(s) !== dexFilterState.region) {
      return false;
    }

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

      const preview = {
        canvas,
        species: s,
        shiny: false,
        silhouette: !d
      };

      dexCanvases.push(preview);

      if (d) {
        // Migración visual para saves anteriores al sistema de formas.
        const capturedForms = d.forms || {
          default:{
            count:d.count || 0,
            shiny:d.shiny || 0,
            name:'Normal'
          }
        };

        const allForms =
          NS.getSpeciesForms
            ? NS.getSpeciesForms(s)
            : [{
                key:'default',
                name:'Normal',
                isDefault:true
              }];

        const formsRow =
          document.createElement('div');

        formsRow.className =
          'dex-form-variants';

        const formsLabel =
          document.createElement('div');

        formsLabel.className =
          'dex-form-label';

        const capturedFormCount =
          allForms.filter(form =>
            (capturedForms[form.key]?.count || 0) > 0
          ).length;

        formsLabel.textContent =
          `Formas ${capturedFormCount}/${allForms.length}`;

        card.appendChild(formsLabel);

        let selectedFormKey = 'default';

        // Si el save antiguo no tiene default explícito, cuenta como capturada.
        const defaultCaptured =
          (capturedForms.default?.count || d.count || 0) > 0;

        if (!defaultCaptured) {
          const firstCaptured =
            allForms.find(form =>
              (capturedForms[form.key]?.count || 0) > 0
            );

          if (firstCaptured) {
            selectedFormKey =
              firstCaptured.key;
          }
        }

        const shinyRow =
          document.createElement('div');

        shinyRow.className =
          'dex-variants';

        const normalBtn =
          document.createElement('button');

        normalBtn.type='button';
        normalBtn.className='active';
        normalBtn.textContent='Normal';

        const shinyBtn =
          document.createElement('button');

        shinyBtn.type='button';

        function selectedFormEntry() {
          if (
            selectedFormKey === 'default' &&
            !d.forms
          ) {
            return {
              count:d.count || 0,
              shiny:d.shiny || 0
            };
          }

          return capturedForms[selectedFormKey] || {
            count:0,
            shiny:0
          };
        }

        function refreshShinyButton() {
          const formEntry =
            selectedFormEntry();

          const hasShiny =
            (formEntry.shiny || 0) > 0;

          shinyBtn.textContent =
            hasShiny
              ? '★ Shiny'
              : '★ Shiny 🔒';

          shinyBtn.disabled =
            !hasShiny;

          if (
            preview.shiny &&
            !hasShiny
          ) {
            preview.shiny=false;
            normalBtn.classList.add('active');
            shinyBtn.classList.remove('active');
          }
        }

        normalBtn.onclick=()=>{
          preview.shiny=false;
          normalBtn.classList.add('active');
          shinyBtn.classList.remove('active');
        };

        shinyBtn.onclick=()=>{
          if (
            !(selectedFormEntry().shiny > 0)
          ) {
            return;
          }

          preview.shiny=true;
          shinyBtn.classList.add('active');
          normalBtn.classList.remove('active');
        };

        for (const form of allForms) {
          const formEntry =
            form.key === 'default' && !d.forms
              ? {
                  count:d.count || 0,
                  shiny:d.shiny || 0
                }
              : capturedForms[form.key];

          const captured =
            (formEntry?.count || 0) > 0;

          const button =
            document.createElement('button');

          button.type='button';
          button.className =
            'dex-form-button' +
            (form.key === selectedFormKey
              ? ' active'
              : '');

          button.textContent =
            captured
              ? form.name
              : `${form.name} 🔒`;

          button.disabled =
            !captured;

          button.onclick=()=>{
            if (!captured) return;

            selectedFormKey =
              form.key;

            preview.species =
              NS.formVariantForSpecies
                ? NS.formVariantForSpecies(
                    s,
                    form.key
                  )
                : s;

            preview.shiny=false;

            for (
              const other of
              formsRow.querySelectorAll(
                '.dex-form-button'
              )
            ) {
              other.classList.remove('active');
            }

            button.classList.add('active');
            normalBtn.classList.add('active');
            shinyBtn.classList.remove('active');

            refreshShinyButton();
          };

          formsRow.appendChild(button);
        }

        // Inicializa el preview en la primera forma capturada disponible.
        preview.species =
          NS.formVariantForSpecies
            ? NS.formVariantForSpecies(
                s,
                selectedFormKey
              )
            : s;

        refreshShinyButton();

        card.appendChild(formsRow);

        shinyRow.append(
          normalBtn,
          shinyBtn
        );

        card.appendChild(shinyRow);
      }
      grid.appendChild(card);
    }
    if(!species.length){
      const empty=document.createElement('div');empty.className='dex-empty';empty.textContent='No hay Pokémon que coincidan con estos filtros.';grid.appendChild(empty);
    }
    dexAnimationId = requestAnimationFrame(drawDexLoop);
  }

  function buildRegionTabs() {
    const container = $('dexRegionTabs');
    if (!container || !NS.REGIONS) return;

    container.innerHTML = '';

    for (const region of NS.REGIONS) {
      const unlocked = NS.isRegionUnlocked(save, region.id);
      const button = document.createElement('button');

      button.type = 'button';
      button.className =
        'region-tab' +
        (dexFilterState.region === region.id ? ' active' : '') +
        (!unlocked ? ' locked' : '');

      button.textContent = unlocked
        ? region.name
        : `${region.name} 🔒`;

      button.disabled = !unlocked;

      button.onclick = () => {
        dexFilterState.region = region.id;
        buildRegionTabs();
        rebuildDexCards();
      };

      container.appendChild(button);
    }
  }

  function buildDex() {
    dexSprites = new NS.SpriteRepository();
    dexFilterState={region:'kanto',search:'',status:'all',rarity:'all',habitat:'all',type:'all'};
    $('dexSearch').value=''; $('dexStatusFilter').value='all'; $('dexRarityFilter').value='all';
    const habitatSel=$('dexHabitatFilter');
    habitatSel.innerHTML='<option value="all">Todos los biomas</option>'+NS.HABITAT_ORDER.map(id=>`<option value="${id}">${NS.HABITATS[id].name}</option>`).join('');
    const types=[...new Set(NS.SPECIES.flatMap(s=>s.types))].sort((a,b)=>(NS.TYPE_NAMES[a]||a).localeCompare(NS.TYPE_NAMES[b]||b,'es'));
    const typeSel=$('dexTypeFilter');
    typeSel.innerHTML='<option value="all">Todos los tipos</option>'+types.map(t=>`<option value="${t}">${NS.TYPE_NAMES[t]||t}</option>`).join('');
    habitatSel.value='all';typeSel.value='all';
    buildRegionTabs();
    rebuildDexCards();
  }


  const SHOP_CATEGORIES = [
    {
      id:'trainer',
      title:'Entrenador y equipo',
      description:'Capacidad, suministros y habilidades directas del jugador.',
      items:['balls','supplies','capture','stoneGathering','throwCooldown']
    },
    {
      id:'safari',
      title:'Expedición Safari',
      description:'Duración, movilidad, rastreo, permisos, hábitats y acceso regional.',
      items:['steps','time','fleeTime','swimSpeed','habitatLicense','regionAccess']
    },
    {
      id:'research',
      title:'Investigación y colección',
      description:'Herramientas para completar Pokédex, Shinydex y localizar especies.',
      items:['shinyCharm','captureScanner']
    }
  ];

  function shopCategoryFor(itemId) {
    return SHOP_CATEGORIES.find(
      category => category.items.includes(itemId)
    ) || {
      id:'other',
      title:'Otras mejoras',
      description:'',
      items:[itemId]
    };
  }

  function buildShop() {
    $('shopCoins').textContent = save.coins;

    const grid = $('shopGrid');
    grid.innerHTML = '';
    grid.className = 'shop-categories';

    for (const category of SHOP_CATEGORIES) {
      const section = document.createElement('section');
      section.className = 'shop-category';

      const head = document.createElement('div');
      head.className = 'shop-category-head';
      head.innerHTML = `
        <h3>${category.title}</h3>
        <p>${category.description}</p>
      `;

      const cards = document.createElement('div');
      cards.className = 'shop-grid';

      const categoryItems = NS.SHOP_ITEMS.filter(
        item => shopCategoryFor(item.id).id === category.id
      );

      for (const item of categoryItems) {
        const lv = save.upgrades[item.id] || 0;
        const cost = NS.getUpgradeCost(item, lv);
        const maxed = lv >= item.max;

        let displayName = item.name;
        let displayDesc = item.desc;

        if (item.id === 'regionAccess') {
          const nextRegion = NS.nextLockedRegion(save);

          if (nextRegion) {
            displayName = `Acceso a ${nextRegion.name}`;
            displayDesc =
              `Desbloquea la región de ${nextRegion.name}. ` +
              `El progreso regional queda guardado permanentemente.`;
          } else {
            displayName = 'Todas las regiones desbloqueadas';
            displayDesc =
              'Has desbloqueado todas las regiones configuradas.';
          }
        }

        let locked = false;
        let unlockText = '';

        if (!maxed && item.unlockDexFractions?.length) {
          const fraction =
            item.unlockDexFractions[
              Math.min(
                lv,
                item.unlockDexFractions.length - 1
              )
            ];

          const kantoSpecies = NS.SPECIES.filter(
            s => NS.regionForSpecies(s) === 'kanto'
          );

          const required =
            Math.ceil(kantoSpecies.length * fraction);

          const current =
            kantoSpecies.filter(
              s => save.dex[s.id]?.count > 0
            ).length;

          locked = current < required;

          unlockText =
            `<div class="level">Desbloqueo: ` +
            `${current}/${required} especies registradas</div>`;
        }

        const card = document.createElement('div');
        card.className = 'shop-card';

        const buttonLabel =
          maxed
            ? 'Máximo'
            : locked
              ? 'Bloqueado'
              : `Comprar · ${cost} monedas`;

        card.innerHTML = `
          <h3>${displayName}</h3>
          <p>${displayDesc}</p>
          <div class="level">Nivel ${lv}/${item.max}</div>
          ${unlockText}
          <button ${maxed || locked ? 'disabled' : ''}>
            ${buttonLabel}
          </button>
        `;

        card.querySelector('button').onclick = () => {
          if (
            maxed ||
            locked ||
            save.coins < cost
          ) {
            return;
          }

          save.coins -= cost;
          save.upgrades[item.id] = lv + 1;

          NS.Storage.save(save);
          NS.Audio?.sfx('coin',.92);

          buildShop();
          refreshMenu();

  window.addEventListener('safari-regions-ready', () => {
    refreshMenu();
  });
        };

        cards.appendChild(card);
      }

      section.appendChild(head);
      section.appendChild(cards);
      grid.appendChild(section);
    }
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
    $('profileDex').textContent = `${caughtUnlockedSpeciesCount()} / ${unlockedSpeciesList().length}`;
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

    const count = profileRepo.count;

    if (!count) {
      const error = document.createElement('div');
      error.className = 'trainer-loading';
      error.textContent = profileRepo.error || 'No se pudieron cargar los entrenadores incluidos.';
      grid.appendChild(error);
      return;
    }

    if (save.profile.trainerId >= count) {
      save.profile.trainerId = 0;
      NS.Storage.save(save);
    }

    for (let i = 0; i < count; i++) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'trainer-card' + (i === save.profile.trainerId ? ' selected' : '');

      const canvas = document.createElement('canvas');
      canvas.width = 112;
      canvas.height = 116;
      card.appendChild(canvas);

      const label = document.createElement('span');
      label.textContent = `Entrenador ${String(i + 1).padStart(2, '0')}`;
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

  $('cancelRegionSelectBtn')?.addEventListener('click', () => {
    $('regionSelectOverlay')?.classList.add('hidden');
    $('regionSelectOverlay')?.setAttribute('aria-hidden','true');
  });

  $('newRunBtn').onclick = async () => {
    await NS.ensureAllRegionsReady?.();
    newRun();
  };
  $('pokedexBtn').onclick = async () => {
    await NS.ensureAllRegionsReady?.();
    buildDex();
    show('pokedexScreen');
  };
  $('shopBtn').onclick = () => { buildShop(); show('shopScreen'); };

  const openGameProfile = async () => {
    await NS.ensureAllRegionsReady?.();
    $('accountCloseBtn')?.click();
    show('profileScreen');
    await buildProfile();
  };

  const openSettings = () => {
    $('accountCloseBtn')?.click();
    refreshAudioSettings();

    const current = getActiveScreenId();
    settingsReturnScreen = current === 'settingsScreen' ? settingsReturnScreen : current;

    if (current === 'gameScreen' && game?.running) {
      resumeRunAfterSettings = !game.paused;
      game.pause?.();
      show('settingsScreen', { preserveRun: true });
      return;
    }

    resumeRunAfterSettings = false;
    show('settingsScreen');
  };

  $('accountGameProfileBtn').onclick = openGameProfile;
  $('accountSettingsBtn').onclick = openSettings;
  $('settingsTopBtn').onclick = openSettings;

  $('summaryBackBtn').onclick = () => {
    disposeRunSilently();
    save = NS.Storage.load();
    refreshMenu();
    show('menuScreen');
  };

  document.querySelectorAll('.backBtn').forEach(b => b.onclick = () => {
    const screenId = b.closest('.screen')?.id;

    if (screenId === 'settingsScreen') {
      const target = settingsReturnScreen || 'menuScreen';
      const shouldResume = target === 'gameScreen' && resumeRunAfterSettings && game?.running;
      show(target, { preserveRun: target === 'gameScreen' });
      if (shouldResume) game.resume?.();
      resumeRunAfterSettings = false;
      settingsReturnScreen = 'menuScreen';
      return;
    }

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
