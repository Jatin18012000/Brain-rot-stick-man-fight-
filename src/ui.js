/* Stickman Tower — DOM screens (tower map, shop, move list, settings,
 * results, pause). The fight itself is canvas; everything else is HTML so it
 * scrolls and scales naturally on a phone. */
(function (root) {
  'use strict';

  const U = root.ST.U;
  const Progress = root.ST.Progress;
  const Shop = root.ST.Shop;
  const Floors = root.ST.Floors;
  const Moves = root.ST.Moves;
  const Input = root.ST.Input;
  const Audio = root.ST.Audio;

  const UI = { el: null, touch: null, current: 'title', shopTab: 'gear' };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  UI.init = function (uiEl, touchEl) {
    UI.el = uiEl;
    UI.touch = touchEl;
    UI.el.addEventListener('click', onClick);
  };

  function onClick(e) {
    const btn = e.target.closest('[data-ui]');
    if (!btn) return;
    const action = btn.dataset.ui;
    const arg = btn.dataset.arg;
    Audio.unlock();
    if (action !== 'noop') Audio.play('ui');
    handle(action, arg, btn);
  }

  function handle(action, arg, btn) {
    const G = root.ST.Game;
    switch (action) {
      case 'play': UI.show(Progress.data.character ? 'tower' : 'select'); break;
      case 'select': UI.show('select'); break;
      case 'pick':
        Progress.chooseCharacter(arg);
        Audio.play('levelUp');
        UI.show('tower');
        break;
      case 'tower': UI.show('tower'); break;
      case 'shop': UI.show('shop'); break;
      case 'moves': UI.show('moves'); break;
      case 'settings': UI.show('settings'); break;
      case 'title': UI.show('title'); break;
      case 'howto': UI.show('howto'); break;
      case 'fight': G.startFight(parseInt(arg, 10), {}); break;
      case 'train': G.startFight(parseInt(arg, 10), { training: true }); break;
      case 'retry': G.startFight(parseInt(arg, 10), {}); break;
      case 'resume': G.togglePause(); break;
      case 'quit': G.quitFight(); break;
      case 'shopTab': UI.shopTab = arg; UI.show('shop'); break;
      case 'buy': doBuy(arg); break;
      case 'equip': doEquip(arg); break;
      case 'trainStat': doTrainStat(arg); break;
      case 'tonic': doBuyTonic(); break;
      case 'toggle': doToggle(arg, btn); break;
      case 'rebind': doRebind(arg, btn); break;
      case 'resetKeys': Input.resetBindings(); UI.show('settings'); break;
      case 'wipe': doWipe(); break;
      case 'install': UI.show('install'); break;
      case 'storyGo': {
        const go = UI._storyContinue;
        UI._storyContinue = null;
        if (go) go();
        break;
      }
      default: break;
    }
  }

  // -------------------------------------------------------------- actions
  function doBuy(id) {
    const item = Shop.ITEM_BY_ID[id];
    if (!item) return;
    if (Progress.buyItem(item)) { Audio.play('buy'); UI.show('shop'); }
    else Audio.play('deny');
  }
  function doEquip(id) {
    const item = Shop.ITEM_BY_ID[id];
    if (item && Progress.equip(item)) { Audio.play('ui'); UI.show('shop'); }
  }
  function doTrainStat(id) {
    if (Progress.train(id)) { Audio.play('buy'); UI.show('shop'); }
    else Audio.play('deny');
  }
  function doBuyTonic() {
    const r = Progress.buyTonic();
    if (r === 'ok') { Audio.play('buy'); UI.show('shop'); } else Audio.play('deny');
  }
  function doToggle(key, btn) {
    const G = root.ST.Game;
    G.settings[key] = !G.settings[key];
    if (key === 'sfx') Audio.enabled = G.settings.sfx;
    if (key === 'music') Audio.setMusic(G.settings.music);
    G.saveSettings();
    if (btn) {
      btn.textContent = G.settings[key] ? 'ON' : 'OFF';
      btn.classList.toggle('on', G.settings[key]);
    }
  }
  function doRebind(action, btn) {
    btn.textContent = 'PRESS A KEY…';
    btn.classList.add('listening');
    Input.listenFor(action, () => { UI.show('settings'); });
  }
  function doWipe() {
    if (!root.confirm('Erase all progress? This cannot be undone.')) return;
    Progress.reset();
    root.ST.Game.save = Progress.data;
    UI.show('title');
  }

  // -------------------------------------------------------------- screens
  UI.show = function (screen) {
    UI.current = screen;
    const G = root.ST.Game;
    if (screen !== 'fight') { G.screen = screen === 'result' ? 'result' : screen; }
    UI.el.classList.toggle('hidden', screen === 'fight');
    UI.touch.classList.toggle('hidden', screen !== 'fight');
    document.getElementById('app').classList.toggle('fighting', screen === 'fight');
    UI.el.scrollTop = 0;

    if (UI._portraitRAF) { cancelAnimationFrame(UI._portraitRAF); UI._portraitRAF = null; }

    switch (screen) {
      case 'title': UI.el.innerHTML = titleScreen(); break;
      case 'select': UI.el.innerHTML = selectScreen(); break;
      case 'tower': UI.el.innerHTML = towerScreen(); break;
      case 'shop': UI.el.innerHTML = shopScreen(); break;
      case 'moves': UI.el.innerHTML = movesScreen(); break;
      case 'settings': UI.el.innerHTML = settingsScreen(); break;
      case 'howto': UI.el.innerHTML = howtoScreen(); break;
      case 'install': UI.el.innerHTML = installScreen(); break;
      case 'fight': UI.el.innerHTML = ''; UI.syncTonics(); break;
      default: break;
    }
    if (screen === 'tower') scrollToCurrentFloor();
    if (screen === 'select') startPortraits();
  };

  function topBar(active) {
    const d = Progress.data;
    const xpNeed = Progress.xpToNext(d.level);
    return `
      <div class="topbar">
        <div class="tb-left">
          <button class="chip" data-ui="title">◀</button>
          <span class="stat"><b>${U.comma(d.coins)}</b> <i>coins</i></span>
          <span class="stat"><b>Lv.${d.level}</b> <i>${d.xp}/${xpNeed} xp</i></span>
          <span class="stat"><b>${U.comma(Progress.power())}</b> <i>power</i></span>
        </div>
        <div class="tb-right">
          <button class="chip ${active === 'tower' ? 'on' : ''}" data-ui="tower">TOWER</button>
          <button class="chip ${active === 'shop' ? 'on' : ''}" data-ui="shop">SHOP</button>
          <button class="chip ${active === 'moves' ? 'on' : ''}" data-ui="moves">MOVES</button>
          <button class="chip" data-ui="select">FIGHTER</button>
          <button class="chip ${active === 'settings' ? 'on' : ''}" data-ui="settings">⚙</button>
        </div>
      </div>
      <div class="xpline"><div style="width:${Math.round((d.xp / xpNeed) * 100)}%"></div></div>`;
  }

  function titleScreen() {
    const d = Progress.data;
    const started = d.stats.wins > 0 || d.highest > 1;
    return `
      <div class="screen title">
        <div class="logo">
          <div class="logo-sub">BRAIN-ROT</div>
          <h1>STICKMAN<span>TOWER</span></h1>
          <div class="logo-line">100 floors. 100 bosses. One stickman.</div>
        </div>
        <div class="title-buttons">
          <button class="big primary" data-ui="play">${started ? 'CONTINUE — FLOOR ' + d.floor : 'START CLIMBING'}</button>
          <button class="big" data-ui="howto">HOW TO PLAY</button>
          <button class="big" data-ui="select">CHOOSE FIGHTER</button>
          <button class="big" data-ui="moves">MOVES &amp; COMBOS</button>
          <button class="big" data-ui="settings">SETTINGS</button>
          <button class="big ghost" data-ui="install">INSTALL ON PHONE / LAPTOP</button>
        </div>
        ${started ? `<div class="title-stats">
          <span>Highest floor <b>${d.highest}</b></span>
          <span>Wins <b>${d.stats.wins}</b></span>
          <span>Perfects <b>${d.stats.perfect}</b></span>
          <span>Best combo <b>${d.stats.bestCombo}</b></span>
        </div>` : ''}
      </div>`;
  }

  /* Character select. The cards draw the actual fighters, so what you preview
   * is exactly what walks into the arena. */
  function selectScreen() {
    const chosen = Progress.data.character;
    const cards = root.ST.Characters.CHARACTERS.map((c) => {
      const bars = [
        ['POWER', c.stats.atk],
        ['SPEED', c.stats.spd],
        ['HEALTH', c.stats.hp],
        ['REACH', 1 + c.stats.reach / 30],
      ].map(([label, v]) => {
        const pct = U.clamp((v - 0.82) / 0.36, 0.06, 1) * 100;
        return `<div class="cs-stat"><span>${label}</span><i><b style="width:${pct.toFixed(0)}%"></b></i></div>`;
      }).join('');
      const sig = c.signature
        ? `<div class="cs-sig"><span>SIGNATURE</span> <b>${esc(c.signature.name)}</b>
             <div class="cs-seq">${c.signature.seq.map((k) => `<i class="key ${k}">${k}</i>`).join('<b>→</b>')}</div></div>`
        : '<div class="cs-sig"><span>SIGNATURE</span> <b>None — every combo, no bias</b></div>';
      return `
        <div class="cs-card ${chosen === c.id ? 'on' : ''}" style="--acc:${c.colors.accent}">
          <canvas class="cs-portrait" data-char="${c.id}" width="240" height="260"></canvas>
          <div class="cs-body">
            <div class="cs-role">${esc(c.role)}</div>
            <div class="cs-name">${esc(c.name)}</div>
            <div class="cs-title">${esc(c.title)}</div>
            <p class="cs-quote">&ldquo;${esc(c.quote)}&rdquo;</p>
            <p class="cs-tag">${esc(c.tagline)}</p>
            <div class="cs-stats">${bars}</div>
            ${sig}
            <p class="cs-blurb">${esc(c.blurb)}</p>
            <button class="big ${chosen === c.id ? '' : 'primary'}" data-ui="pick" data-arg="${c.id}">
              ${chosen === c.id ? 'SELECTED — KEEP CLIMBING' : 'CHOOSE ' + esc(c.name.toUpperCase())}
            </button>
          </div>
        </div>`;
    }).join('');

    return `${Progress.data.character ? topBar('') : ''}
      <div class="screen select">
        <h2 class="cs-head">CHOOSE YOUR FIGHTER</h2>
        <p class="note">Same tower, same rules, same gear and training. They differ in how they
          get it done — and each one brings a signature combo that nobody else can throw.
          You can switch fighter any time; your floors, coins and gear stay with you.</p>
        <div class="cs-grid">${cards}</div>
      </div>`;
  }

  function startPortraits() {
    const canvases = Array.prototype.slice.call(document.querySelectorAll('.cs-portrait'));
    if (!canvases.length) return;
    // Match the backing store to the CSS box, or the fighters come out squashed.
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    const ctxs = canvases.map((cv) => {
      const r = cv.getBoundingClientRect();
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      return {
        ctx: cv.getContext('2d'),
        ch: root.ST.Characters.get(cv.dataset.char),
        w: cv.width, h: cv.height,
      };
    });
    // The commissioned bust, drawn once — it is flat screen-print art, not an
    // animation, and the live fighter is already moving on the backdrop.
    ctxs.forEach((c) => root.ST.Render.drawPortraitArt(c.ctx, c.ch, c.w, c.h));
  }

  function towerScreen() {
    const d = Progress.data;
    const myPower = Progress.power();
    let rows = '';
    const Campaign = root.ST.Campaign;
    const myRival = root.ST.Characters.get(Campaign.rivalOf(d.character || 'classic'));
    for (let f = 100; f >= 1; f--) {
      const info = Floors.get(f);
      const isRival = Campaign.isRivalFloor(f);
      const cleared = f <= d.cleared;
      const current = f === d.highest && !cleared;
      const locked = f > d.highest;
      const ratio = myPower / info.power;
      // Calibrated against tools/balance.mjs: a player who shops after every
      // win sits around 1.2-1.35, which should read as a fair fight.
      const verdict = ratio > 1.45 ? ['easy', 'FAVOURED']
        : ratio > 1.05 ? ['fair', 'FAIR FIGHT']
          : ratio > 0.85 ? ['hard', 'RISKY'] : ['brutal', 'UNDERPOWERED'];
      // The list runs 100 -> 1, so a tier's heading belongs on its highest floor.
      const tierStart = f % 10 === 0;
      const tierLow = Math.floor((f - 1) / 10) * 10 + 1;
      rows += tierStart ? `<div class="tier-head" style="--acc:${info.tier.accent}">${esc(info.tier.name)} · floors ${tierLow}–${tierLow + 9}</div>` : '';
      rows += `
        <div class="floor ${cleared ? 'cleared' : ''} ${current ? 'current' : ''} ${locked ? 'locked' : ''}" id="floor-${f}">
          <div class="fl-num">${f}</div>
          <div class="fl-body">
            <div class="fl-name">${locked ? '???' : esc(isRival ? myRival.name : info.name)}${isRival ? ' <em class="rival">RIVAL</em>' : info.warden ? ' <em>WARDEN</em>' : ''}${info.final ? ' <em>FINAL</em>' : ''}</div>
            <div class="fl-meta">${locked ? 'Locked'
        : isRival ? esc(myRival.title) + ' · ' + esc(myRival.role) + ' · she came down to meet you'
          : esc(info.title) + ' · ' + info.arch + ' · ' + U.comma(info.hp) + ' HP'}</div>
          </div>
          <div class="fl-right">
            ${locked ? '<span class="lock">🔒</span>'
        : current ? `<span class="verdict ${verdict[0]}">${verdict[1]}</span><button class="go" data-ui="fight" data-arg="${f}">FIGHT</button>`
          : `<span class="done">✔ CLEARED</span><button class="go ghost" data-ui="train" data-arg="${f}">TRAIN</button>`}
          </div>
        </div>`;
    }
    const conquered = d.cleared >= 100;
    const nextInfo = Floors.get(d.highest);
    const card = conquered ? `
        <div class="next-card" style="--acc:#ffd76e">
          <div class="nc-left">
            <div class="nc-label">TOWER CONQUERED</div>
            <div class="nc-name">All 100 floors</div>
            <div class="nc-sub">The Ascendant is beaten. Any floor can be replayed for coins.</div>
          </div>
          <div class="nc-right">
            <div class="power-cmp"><div><span>YOUR POWER</span><b>${U.comma(myPower)}</b></div></div>
            <button class="big primary" data-ui="train" data-arg="100">FIGHT THE ASCENDANT AGAIN</button>
          </div>
        </div>` : `
        <div class="next-card" style="--acc:${nextInfo.tier.accent}">
          <div class="nc-left">
            <div class="nc-label">NEXT FIGHT</div>
            <div class="nc-name">${esc(nextInfo.name)}</div>
            <div class="nc-sub">Floor ${nextInfo.floor} · ${esc(nextInfo.tier.name)} · ${nextInfo.arch}</div>
          </div>
          <div class="nc-right">
            <div class="power-cmp">
              <div><span>YOU</span><b>${U.comma(myPower)}</b></div>
              <div><span>BOSS</span><b>${U.comma(nextInfo.power)}</b></div>
            </div>
            <button class="big primary" data-ui="fight" data-arg="${nextInfo.floor}">ENTER FLOOR ${nextInfo.floor}</button>
          </div>
        </div>`;
    return `${topBar('tower')}
      <div class="screen tower">
        ${card}
        <div class="floor-list">${rows}</div>
      </div>`;
  }

  function scrollToCurrentFloor() {
    const el = document.getElementById('floor-' + Progress.data.highest);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
  }

  // ------------------------------------------------------------------ shop
  function shopScreen() {
    const tab = UI.shopTab;
    const body = tab === 'gear' ? gearTab() : tab === 'train' ? trainTab() : suppliesTab();
    return `${topBar('shop')}
      <div class="screen shop">
        <div class="tabs">
          <button class="tab ${tab === 'gear' ? 'on' : ''}" data-ui="shopTab" data-arg="gear">GEAR</button>
          <button class="tab ${tab === 'train' ? 'on' : ''}" data-ui="shopTab" data-arg="train">TRAINING</button>
          <button class="tab ${tab === 'sup' ? 'on' : ''}" data-ui="shopTab" data-arg="sup">SUPPLIES</button>
        </div>
        ${body}
      </div>`;
  }

  function statLine(stats) {
    return Object.keys(stats).map((k) =>
      `<span class="sl">${Shop.STAT_LABEL[k]} <b>+${stats[k]}${Shop.STAT_SUFFIX[k]}</b></span>`).join('');
  }

  function gearTab() {
    const d = Progress.data;
    return Shop.SLOTS.map((slot) => {
      const items = Shop.ITEMS.filter((i) => i.slot === slot.id);
      const equipped = d.equipped[slot.id];
      const cards = items.map((item) => {
        const state = Progress.canBuyItem(item);
        const isEquipped = equipped === item.id;
        const owned = d.owned.indexOf(item.id) !== -1;
        let btn;
        if (isEquipped) btn = '<span class="tagx equipped">EQUIPPED</span>';
        else if (owned) btn = `<button class="buy" data-ui="equip" data-arg="${item.id}">EQUIP</button>`;
        else if (state === 'locked') btn = `<span class="tagx lock">FLOOR ${item.floor}</span>`;
        else btn = `<button class="buy ${state === 'poor' ? 'poor' : ''}" data-ui="buy" data-arg="${item.id}">${U.comma(item.cost)} ⬤</button>`;
        return `
          <div class="item ${isEquipped ? 'on' : ''} ${state === 'locked' ? 'dim' : ''}">
            <div class="it-head"><span class="it-tier">${U.roman(item.tier)}</span><span class="it-name">${esc(item.name)}</span></div>
            <div class="it-stats">${statLine(item.stats)}</div>
            <div class="it-foot">${btn}</div>
          </div>`;
      }).join('');
      return `<div class="slot-block"><h3><span class="tr-icon">${slot.icon}</span> ${slot.name}</h3><div class="items">${cards}</div></div>`;
    }).join('');
  }

  function trainTab() {
    const d = Progress.data;
    const c = Progress.combat();
    const cards = Shop.TRAINING.map((t) => {
      const lvl = d.train[t.id] || 0;
      const state = Progress.canTrain(t.id);
      const cost = Shop.trainingCost(t.id, lvl);
      const pips = Array.from({ length: Math.min(t.max, 20) }, (_, i) => {
        const step = t.max > 20 ? Math.ceil(t.max / 20) : 1;
        return `<i class="${lvl >= (i + 1) * step ? 'on' : ''}"></i>`;
      }).join('');
      return `
        <div class="train">
          <div class="tr-head"><span class="tr-icon">${t.icon}</span><b>${t.name}</b><span class="tr-lvl">Lv ${lvl}/${t.max}</span></div>
          <div class="tr-per">${t.per}</div>
          <div class="pips">${pips}</div>
          <button class="buy ${state === 'poor' ? 'poor' : ''} ${state === 'max' ? 'dim' : ''}" data-ui="trainStat" data-arg="${t.id}">
            ${state === 'max' ? 'MAXED' : U.comma(cost) + ' ⬤'}
          </button>
        </div>`;
    }).join('');
    return `
      <div class="stat-summary">
        <span>Max HP <b>${c.maxHp}</b></span>
        <span>Attack <b>×${c.atkMul.toFixed(2)}</b></span>
        <span>Defence <b>${c.def}</b> <i>(−${Math.round(c.dr * 100)}% dmg)</i></span>
        <span>Speed <b>×${c.spdMul.toFixed(2)}</b></span>
        <span>Crit <b>${Math.round(c.crit * 100)}%</b></span>
        <span>Rage <b>×${c.rageMul.toFixed(2)}</b></span>
      </div>
      <div class="trains">${cards}</div>`;
  }

  function suppliesTab() {
    const d = Progress.data;
    const max = Progress.combat().tonics;
    return `
      <div class="supplies">
        <div class="train">
          <div class="tr-head"><span class="tr-icon">⚗</span><b>Health Tonic</b><span class="tr-lvl">${d.tonics}/${max}</span></div>
          <div class="tr-per">Restores 35% of your health mid-fight. Press the TONIC button (or Q) during a fight.</div>
          <button class="buy ${d.tonics >= max ? 'dim' : ''}" data-ui="tonic">${d.tonics >= max ? 'FULL' : U.comma(Shop.TONIC_COST) + ' ⬤'}</button>
        </div>
        <p class="note">Raise <b>Alchemy</b> in the Training tab to carry more tonics into each fight.</p>
      </div>`;
  }

  // ----------------------------------------------------------------- moves
  function movesScreen() {
    const lvl = Progress.data.level;
    const normals = [
      ['Punch 1', 'Jab — fastest poke, links into everything'],
      ['Punch 2', 'Cross — heavier, good punish'],
      ['Kick', 'Roundhouse — long reach, launches'],
      ['◀/▶ + Punch 2', 'Lunge Straight — closes distance'],
      ['◀ (away) + Kick', 'Spin Heel — big knockdown'],
      ['▼ + Punch 1', 'Low Jab — hits low, must be blocked crouching'],
      ['▼ + Punch 2', 'Body Blow — lifts them for a juggle'],
      ['▼ + Kick', 'Sweep — knockdown, hits low'],
      ['▲ + any button', 'Air attacks — overheads, must be blocked standing'],
      ['Hold away from boss', 'Block — hold ▼ too to block low'],
      ['Tap ◀◀ / ▶▶', 'Dash'],
    ].map(([k, v]) => `<div class="mv"><span class="mv-in">${esc(k)}</span><span class="mv-de">${esc(v)}</span></div>`).join('');

    const combos = Progress.allSpecials().map((sp) => {
      const unlocked = sp.unlock <= lvl;
      const seq = sp.seq.map((s) => `<i class="key ${s}">${s === 'P1' ? 'P1' : s === 'P2' ? 'P2' : s === 'K' ? 'K' : s === 'D' ? '▼' : s === 'F' ? '▶' : '◀'}</i>`).join('<b>→</b>');
      return `
        <div class="combo ${unlocked ? '' : 'locked'} ${sp.ultimate ? 'ult' : ''} ${sp.id.indexOf('sig') === 0 ? 'sig' : ''}">
          <div class="cb-head">
            <span class="cb-name">${esc(sp.name)}${sp.ultimate ? ' ★' : ''}${sp.id.indexOf('sig') === 0 ? ' <em>SIGNATURE</em>' : ''}</span>
            <span class="cb-cost">${sp.cost ? sp.cost + ' rage' : 'free'}</span>
          </div>
          <div class="cb-seq">${seq}</div>
          <div class="cb-desc">${esc(sp.desc)}</div>
          ${unlocked ? '<div class="cb-unlock ok">UNLOCKED</div>' : `<div class="cb-unlock">Unlocks at level ${sp.unlock}</div>`}
        </div>`;
    }).join('');

    return `${topBar('moves')}
      <div class="screen moves">
        <h2>Basic attacks</h2>
        <div class="mv-list">${normals}</div>
        <h2>Combo sequences <small>press the buttons in order, quickly</small></h2>
        <p class="note">A combo fires on the last button of the sequence, and cancels straight out of whatever attack you are already swinging — so a string flows the way it reads. Damage scales down through a long combo, so nothing loops forever.</p>
        <div class="combo-list">${combos}</div>
      </div>`;
  }

  // -------------------------------------------------------------- settings
  function settingsScreen() {
    const s = root.ST.Game.settings;
    const toggle = (key, label, help) => `
      <div class="setting">
        <div><b>${label}</b><span>${help}</span></div>
        <button class="toggle ${s[key] ? 'on' : ''}" data-ui="toggle" data-arg="${key}">${s[key] ? 'ON' : 'OFF'}</button>
      </div>`;
    const binds = [
      ['left', 'Move left'], ['right', 'Move right'], ['up', 'Jump'], ['down', 'Crouch'],
      ['p1', 'Punch 1'], ['p2', 'Punch 2'], ['kick', 'Kick'], ['block', 'Block'],
      ['potion', 'Use tonic'], ['pause', 'Pause'],
    ].map(([a, label]) => `
      <div class="bind">
        <span>${label}</span>
        <button class="keybtn" data-ui="rebind" data-arg="${a}">${esc(Input.bindingLabel(a))}</button>
      </div>`).join('');

    return `${topBar('settings')}
      <div class="screen settings">
        <h2>Options</h2>
        ${toggle('sfx', 'Sound effects', 'Punches, blocks, coins')}
        ${toggle('music', 'Music', 'Synth backing track per tier')}
        ${toggle('haptics', 'Vibration', 'Touch button feedback on phones')}
        ${toggle('showHints', 'Combo hints', 'Show a combo reminder at the start of a fight')}
        ${toggle('debug', 'Show hitboxes', 'Developer view of hit and hurt boxes')}

        <h2>Keyboard &amp; controller <small>works on laptop, and on iPhone/iPad with a paired keyboard or controller</small></h2>
        <div class="binds">${binds}</div>
        <div class="row">
          <button class="big ghost" data-ui="resetKeys">RESET KEYS</button>
        </div>
        <p class="note">Controllers are detected automatically: left stick / d-pad to move, A + X to punch, B or Y to kick, shoulder buttons to block.</p>

        <h2>Danger zone</h2>
        <button class="big danger" data-ui="wipe">ERASE ALL PROGRESS</button>
      </div>`;
  }

  function howtoScreen() {
    return `${topBar('')}
      <div class="screen howto">
        <h2>How to climb</h2>
        <ol class="steps">
          <li><b>Beat the boss of the floor to unlock the next floor.</b> There is exactly one boss per floor, all the way to 100.</li>
          <li><b>Winning pays.</b> Every win gives coins — enough to buy the gear and training you need for the next boss. Perfect wins and fast wins pay more.</li>
          <li><b>Spend before you climb.</b> The tower screen compares your power with the next boss's. If it says UNDERPOWERED, go shopping or replay a cleared floor in TRAIN mode for extra coins.</li>
          <li><b>Combos are sequences.</b> Press PUNCH 1 → PUNCH 1 → KICK quickly and your stickman performs Twin Jab Sweep instead of three separate hits. More sequences unlock as you level up.</li>
          <li><b>Rage</b> builds as you fight. Most combos cost rage; the ultimate costs a lot of it.</li>
          <li><b>Block</b> by holding away from the boss. Low attacks must be blocked crouching, jumping attacks must be blocked standing. Block too much and your guard breaks.</li>
        </ol>
        <div class="row"><button class="big primary" data-ui="play">GOT IT — CLIMB</button></div>
      </div>`;
  }

  function installScreen() {
    return `${topBar('')}
      <div class="screen howto">
        <h2>Install it like an app</h2>
        <h3>iPhone / iPad</h3>
        <ol class="steps">
          <li>Open this page in <b>Safari</b>.</li>
          <li>Tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</li>
          <li>Launch it from the home screen icon — it runs full screen, offline, with no browser bars.</li>
          <li>Pair a Bluetooth keyboard or an MFi / Xbox / PlayStation controller and it works instantly. Remap keys in Settings.</li>
        </ol>
        <h3>Mac / Windows / Linux</h3>
        <ol class="steps">
          <li>Open in Chrome or Edge and click the <b>Install</b> icon in the address bar (or ⋮ → Install). Safari: <b>File → Add to Dock</b>.</li>
          <li>Or just download <b>stickman-tower.html</b> from the repository and double-click it — the whole game is one file.</li>
        </ol>
        <p class="note">Progress, settings and key bindings are stored on the device you play on.</p>
        <div class="row"><button class="big primary" data-ui="title">BACK</button></div>
      </div>`;
  }

  // ------------------------------------------------------------ result
  UI.showResult = function (p) {
    const G = root.ST.Game;
    UI.setPaused(false);
    UI.el.classList.remove('hidden');
    UI.touch.classList.add('hidden');
    document.getElementById('app').classList.remove('fighting');
    const info = Floors.get(p.floor);
    const win = p.result === 'win';

    let rewardRows = '';
    if (p.training) {
      rewardRows = `<div class="rw"><span>Training payout</span><b>+${U.comma(p.coins)} ⬤</b></div>`;
    } else if (win) {
      const r = p.reward;
      rewardRows = `
        <div class="rw"><span>Floor ${p.floor} cleared</span><b>+${U.comma(r.base)} ⬤</b></div>
        ${r.perfect ? `<div class="rw bonus"><span>PERFECT — no damage taken</span><b>+${U.comma(r.perfect)} ⬤</b></div>` : ''}
        ${r.speed ? `<div class="rw bonus"><span>Fast win</span><b>+${U.comma(r.speed)} ⬤</b></div>` : ''}
        ${r.first ? `<div class="rw bonus"><span>First clear</span><b>+${U.comma(r.first)} ⬤</b></div>` : ''}
        ${r.mult > 1 ? `<div class="rw"><span>Charm coin bonus</span><b>×${r.mult.toFixed(2)}</b></div>` : ''}
        <div class="rw total"><span>Total</span><b>+${U.comma(r.coins)} ⬤</b></div>
        <div class="rw"><span>Experience</span><b>+${U.comma(r.xp)} xp</b></div>`;
    } else {
      rewardRows = `<div class="rw"><span>Consolation</span><b>+${U.comma(p.coins)} ⬤</b></div>`;
    }

    const levelUps = (p.levels && p.levels.length)
      ? `<div class="levelups">
          <div class="lv-title">LEVEL UP → ${p.levels[p.levels.length - 1]}</div>
          ${p.levels.map((lv) => Progress.newlyUnlockedAt(lv).map((sp) =>
        `<div class="unlock">NEW COMBO: <b>${esc(sp.name)}</b> — ${sp.seq.map((s) => G.btnLabel(s)).join(' → ')}</div>`).join('')).join('')}
        </div>` : '';

    const nextFloor = Math.min(100, p.floor + 1);
    const isFinal = p.floor === 100 && win;

    UI.el.innerHTML = `
      <div class="screen result ${win ? 'win' : 'lose'}">
        <div class="res-card">
          <div class="res-title">${isFinal ? 'TOWER CONQUERED' : win ? (p.training ? 'TRAINING COMPLETE' : 'FLOOR CLEARED') : 'DEFEATED'}</div>
          <div class="res-sub">${esc(info.name)} · Floor ${p.floor}</div>
          ${isFinal ? '<p class="note">You climbed all one hundred floors. The Ascendant is beaten. Go again on any floor for coins, or wipe the save and try a cleaner run.</p>' : ''}
          <div class="res-stats">
            <span>Best combo <b>${p.bestCombo}</b></span>
            ${p.perfect ? '<span class="hot">PERFECT</span>' : ''}
            ${p.fast ? '<span class="hot">FAST</span>' : ''}
          </div>
          <div class="rewards">${rewardRows}</div>
          ${levelUps}
          <div class="res-buttons">
            ${win && !p.training && !isFinal ? `<button class="big primary" data-ui="fight" data-arg="${nextFloor}">FLOOR ${nextFloor} →</button>` : ''}
            ${!win ? `<button class="big primary" data-ui="retry" data-arg="${p.floor}">TRY AGAIN</button>` : ''}
            <button class="big" data-ui="shop">SHOP &amp; UPGRADE</button>
            <button class="big ghost" data-ui="tower">TOWER MAP</button>
          </div>
        </div>
      </div>`;
  };

  // -------------------------------------------------------------- story
  /* A campaign beat. On a rival floor it doubles as the versus screen, which
   * is what the commissioned portraits were drawn for. */
  UI.showStory = function (beat, onContinue) {
    const G = root.ST.Game;
    UI.setPaused(false);
    UI.el.classList.remove('hidden');
    UI.touch.classList.add('hidden');
    document.getElementById('app').classList.remove('fighting');
    if (UI._portraitRAF) { cancelAnimationFrame(UI._portraitRAF); UI._portraitRAF = null; }
    UI.current = 'story';
    G.screen = 'story';

    const you = Progress.character();
    const rival = beat.rival ? root.ST.Characters.get(beat.rival) : null;
    const d = beat.data;

    const versus = rival ? `
      <div class="vs-strip">
        <div class="vs-side">
          <canvas class="vs-art" data-char="${you.id}" width="240" height="260"></canvas>
          <div class="vs-name" style="--c:${you.colors.body};--t:${you.portrait.nameColor}">
            <b>${esc(you.name)}</b><span>${esc(you.role)}</span>
          </div>
        </div>
        <div class="vs-mid">VS</div>
        <div class="vs-side">
          <canvas class="vs-art" data-char="${rival.id}" width="240" height="260"></canvas>
          <div class="vs-name" style="--c:${rival.colors.body};--t:${rival.portrait.nameColor}">
            <b>${esc(rival.name)}</b><span>${esc(rival.role)}</span>
          </div>
        </div>
      </div>` : '';

    UI.el.innerHTML = `
      <div class="screen story ${beat.kind}">
        <div class="story-card" style="--acc:${(rival || you).colors.accent}">
          <div class="story-title">${esc(d.title)}</div>
          ${versus}
          ${d.speaker ? `<div class="story-speaker">${esc(d.speaker)}</div>` : ''}
          <div class="story-lines">
            ${d.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
          </div>
          ${d.sting ? `<div class="story-sting">${esc(d.sting)}</div>` : ''}
          <button class="big primary" data-ui="storyGo">
            ${beat.kind === 'after' || beat.kind === 'ending' ? 'CONTINUE' : 'FIGHT'}
          </button>
        </div>
      </div>`;

    UI._storyContinue = onContinue;
    if (rival) startVersusArt();
  };

  function startVersusArt() {
    const canvases = Array.prototype.slice.call(document.querySelectorAll('.vs-art'));
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    canvases.forEach((cv) => {
      const r = cv.getBoundingClientRect();
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      const ch = root.ST.Characters.get(cv.dataset.char);
      root.ST.Render.drawPortraitArt(cv.getContext('2d'), ch, cv.width, cv.height);
    });
  }

  // -------------------------------------------------------------- pause
  UI.setPaused = function (paused) {
    let el = document.getElementById('pause');
    if (!paused) { if (el) el.remove(); return; }
    el = document.createElement('div');
    el.id = 'pause';
    el.className = 'pause';
    el.innerHTML = `
      <div class="pause-card">
        <h2>PAUSED</h2>
        <button class="big primary" data-ui="resume">RESUME</button>
        <button class="big" data-ui="quit">QUIT TO TOWER</button>
        <div class="pause-hints">
          ${Progress.unlockedSpecials().filter((s) => !s.motion).slice(0, 6).map((s) =>
      `<div><b>${esc(s.name)}</b> ${s.seq.join(' → ')}</div>`).join('')}
        </div>
      </div>`;
    el.addEventListener('click', onClick);
    document.getElementById('stage').appendChild(el);
  };

  /* Keep the on-screen TONIC button in sync with what's left. */
  UI.syncTonics = function () {
    const btn = document.querySelector('[data-action="potion"] .badge');
    if (btn) btn.textContent = root.ST.Game.tonics === undefined ? '' : root.ST.Game.tonics;
    const wrap = document.querySelector('[data-action="potion"]');
    if (wrap) wrap.classList.toggle('empty', !root.ST.Game.tonics);
  };

  root.ST = root.ST || {};
  root.ST.UI = UI;
})(window);
