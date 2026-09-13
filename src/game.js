/* Stickman Tower — match engine, game loop and screen flow. */
(function (root) {
  'use strict';

  const U = root.ST.U;
  const R = root.ST.Render;
  const Moves = root.ST.Moves;
  const Fighter = root.ST.Fighter;
  const AI = root.ST.AI;
  const Floors = root.ST.Floors;
  const Progress = root.ST.Progress;
  const Input = root.ST.Input;
  const Audio = root.ST.Audio;
  const HUD = root.ST.HUD;

  const FIGHT_SECONDS = 99;
  const BOSS_FIGHT_SECONDS = 120;   // wardens and the final floor get longer
  const BOUNDS = { left: 70, right: R.W - 70, ground: R.GROUND_Y };

  const Game = {
    screen: 'title',
    canvas: null, ctx: null,
    dpr: 1, viewScale: 1, viewX: 0, viewY: 0,
    settings: { haptics: true, sfx: true, music: true, showHints: true, debug: false, touchScale: 1, lefty: false },
    save: null,
    running: false,
    paused: false,
    trainingMode: false,
  };

  // ------------------------------------------------------------------ boot
  Game.init = function (canvas, touchLayer) {
    Game.canvas = canvas;
    Game.ctx = canvas.getContext('2d', { alpha: false });
    Progress.load();
    Game.save = Progress.data;
    const s = U.storage.read('st.settings.v1', null);
    if (s) Object.assign(Game.settings, s);
    Audio.enabled = Game.settings.sfx;
    Audio.setMusic(Game.settings.music);

    Input.init(touchLayer);
    Input.onPause = () => {
      if (Game.screen === 'fight') Game.togglePause();
    };

    Game.resize();
    root.addEventListener('resize', Game.resize);
    root.addEventListener('orientationchange', () => setTimeout(Game.resize, 300));

    Game.last = performance.now();
    Game.acc = 0;
    Game.running = true;
    requestAnimationFrame(Game.frame);
  };

  Game.saveSettings = function () { U.storage.write('st.settings.v1', Game.settings); };

  Game.resize = function () {
    const c = Game.canvas;
    if (!c) return;
    const rect = c.parentElement.getBoundingClientRect();
    const dpr = Math.min(root.devicePixelRatio || 1, 2.5);
    Game.dpr = dpr;
    c.width = Math.max(1, Math.round(rect.width * dpr));
    c.height = Math.max(1, Math.round(rect.height * dpr));
    c.style.width = rect.width + 'px';
    c.style.height = rect.height + 'px';
    const scale = Math.min(rect.width / R.W, rect.height / R.H);
    Game.viewScale = scale * dpr;
    Game.viewX = (c.width - R.W * Game.viewScale) / 2;
    Game.viewY = (c.height - R.H * Game.viewScale) / 2;

    // Publish the letterboxed view rect in CSS pixels so the overlay buttons
    // can sit against the canvas edge instead of the screen edge.
    const stage = c.parentElement;
    stage.style.setProperty('--view-w', (R.W * scale) + 'px');
    stage.style.setProperty('--view-h', (R.H * scale) + 'px');
    stage.style.setProperty('--view-x', ((rect.width - R.W * scale) / 2) + 'px');
    stage.style.setProperty('--view-y', ((rect.height - R.H * scale) / 2) + 'px');
    stage.style.setProperty('--view-s', scale);
  };

  // ------------------------------------------------------------ fight setup
  Game.startFight = function (floor, opts) {
    const o = opts || {};
    const Campaign = root.ST.Campaign;
    const Characters = root.ST.Characters;
    const charId = Progress.data.character || 'classic';

    // A story beat interrupts the run-up to the fight, never the fight itself.
    if (!o.skipBeat) {
      const beat = Campaign.beatBefore(floor, charId, Progress.data);
      if (beat) {
        Campaign.markSeen(Progress.data, charId, beat.key);
        Progress.save();
        root.ST.UI.showStory(beat, () => Game.startFight(floor, Object.assign({}, o, { skipBeat: true })));
        return;
      }
    }

    Game.trainingMode = !!o.training;
    let info = Floors.get(floor);

    // On a rival floor the Warden is replaced by the fighter you did not pick.
    const rivalId = Campaign.isRivalFloor(floor) ? Campaign.rivalOf(charId) : null;
    const rival = rivalId ? Characters.get(rivalId) : null;
    if (rival) {
      info = Object.assign({}, info, {
        name: rival.name,
        title: rival.title,
        arch: rival.role,
        colors: rival.colors,
        taunt: rival.quote,
        isRival: true,
        rivalId: rivalId,
        scale: rival.build.scale,
      });
    }
    Game.rival = rival;
    const stats = Progress.combat();

    const gear = buildGearVisual();
    const character = Progress.character();
    const player = new Fighter({
      name: character.name, isPlayer: true, x: 300, facing: 1,
      colors: character.colors,
      character: character,
      stats: stats, gear: gear, scale: character.build.scale,
      specials: Progress.unlockedSpecials(),
    });
    player.y = BOUNDS.ground;

    const bossStats = {
      maxHp: info.hp, atkMul: info.atkMul, def: info.def, dr: info.dr,
      spdMul: info.speed / 178, aspdMul: 1 + Math.min(0.5, floor * 0.006),
      crit: Math.min(0.35, 0.02 + floor * 0.003), critDmg: 1.5,
      rageMul: 1 + floor * 0.01, lifesteal: info.final ? 0.08 : 0,
      reach: 0,
    };
    if (rival) {
      // A rival is the floor's stat block wearing a player character: same
      // curve, her modifiers, her reach, her signature.
      const esc = Campaign.rivalScale(floor);
      bossStats.maxHp = Math.round(bossStats.maxHp * rival.stats.hp * esc);
      bossStats.atkMul *= rival.stats.atk * esc;
      bossStats.spdMul *= rival.stats.spd;
      bossStats.aspdMul *= rival.stats.aspd;
      bossStats.crit = Math.min(0.5, bossStats.crit + rival.stats.crit);
      bossStats.rageMul *= rival.stats.rage;
      bossStats.reach = rival.stats.reach;
    }
    const boss = new Fighter({
      name: info.name, x: 660, facing: -1,
      colors: info.colors, stats: bossStats, scale: info.scale,
      character: rival,
      gear: rival ? rivalGearVisual(rival, floor) : bossGearVisual(info),
      specials: [],
    });
    boss.y = BOUNDS.ground;
    boss.auraColor = rival ? rival.colors.aura : info.colors.aura;
    if (rival) {
      boss._backColor = tooCloseToStage(rival.colors.back, info.tier.ground)
        ? (rival.colors.backBright || rival.colors.back)
        : rival.colors.back;
    }

    // The sheet flags one contrast risk: a dark-red back limb on a dark-red
    // stage. Lift it wherever the stage colour sits too close to it.
    player._backColor = tooCloseToStage(character.colors.back, info.tier.ground)
      ? (character.colors.backBright || character.colors.back)
      : character.colors.back;
    Game.band = Progress.gearBand();

    Game.player = player;
    Game.boss = boss;
    Game.bossInfo = info;
    const aiProfile = rival ? rivalProfile(info.ai, rivalId) : info.ai;
    Game.ai = new AI(boss, aiProfile, floor);
    if (rival && rival.signature) {
      Game.ai.specials = Game.ai.specials.concat([rival.signature]);
    }
    Game.clock = (info.warden || info.final) ? BOSS_FIGHT_SECONDS : FIGHT_SECONDS;
    Game.timer = Game.clock;
    Game.hitstop = 0;
    Game.shake = 0;
    Game.shakeX = 0; Game.shakeY = 0;
    Game.zoom = 1;
    Game.projectiles = [];
    Game.comboCount = 0;
    Game.comboDamage = 0;
    Game.comboTimer = 0;
    Game.bestCombo = 0;
    Game.specialsUsed = 0;
    Game.ghostP = 1; Game.ghostB = 1;
    Game.tonics = Game.trainingMode ? Progress.combat().tonics : Progress.data.tonics;
    Game.phaseTriggered = false;
    Game.result = null;
    Game.slowmo = 0;
    Game.endTimer = 0;
    Game.t = 0;
    Game.paused = false;
    Game.hint = null; Game.hintT = 0;
    Game.specialList = Progress.allSpecials().slice()
      .sort((a, b) => b.seq.length - a.seq.length);
    Game.specialBanner = null; Game.specialBannerT = 0;
    R.FX.clear();

    player.onSpecialStart = (sp) => {
      Game.specialBanner = sp.name.toUpperCase();
      Game.specialBannerT = 1.4;
      Game.specialsUsed++;
      Game.zoom = 1.12;
      Audio.duck(0.4, 0.8);
    };

    Game.state = 'intro';
    Game.introT = 2.6;
    player.state = 'intro'; player.setAnim('intro');
    boss.state = 'intro'; boss.setAnim('intro');
    Game.announce = null; Game.announceT = 0;

    Game.screen = 'fight';
    root.ST.UI.show('fight');
    Audio.startMusic(info.tierIndex);
  };

  /* Straight RGB distance is crude but it is the right crudeness here: the
   * problem is a back limb sharing a hue family with the stage, not luminance.
   * Below ~125 catches the Blood Arena and leaves every other stage alone. */
  function tooCloseToStage(colorA, colorB) {
    const rgb = (hex) => {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const a = rgb(colorA), b = rgb(colorB);
    return Math.sqrt(
      (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2])
    ) < 125;
  }

  function buildGearVisual() {
    const eq = Progress.data.equipped;
    const Shop = root.ST.Shop;
    const item = (id) => (id ? Shop.ITEM_BY_ID[id] : null);
    const w = item(eq.weapon), a = item(eq.armor), h = item(eq.head), b = item(eq.boots), gl = item(eq.gloves), ch = item(eq.charm);
    // Gear takes the character's own palette. A generic tier ramp put orange
    // plate on a cyan fighter; tier now reads through size and shape instead.
    const pal = Progress.character().colors;
    const tierColor = [pal.trim, pal.trim, pal.accent, pal.accent, pal.accent, pal.aura, pal.aura, pal.aura];
    return {
      weaponTier: w ? w.tier : 0, weaponColor: w ? tierColor[w.tier - 1] : null,
      armor: !!a, armorColor: a ? tierColor[a.tier - 1] : null, armorTier: a ? a.tier : 0,
      head: !!h, headColor: h ? tierColor[h.tier - 1] : null, headTier: h ? h.tier : 0,
      boots: !!b, bootTier: b ? b.tier : 0,
      glovesTier: gl ? gl.tier : 0,
      charm: !!ch, charmColor: ch ? tierColor[ch.tier - 1] : null,
    };
  }

  /* A rival fights like her design says she does, not like a generated boss. */
  function rivalProfile(base, rivalId) {
    const p = Object.assign({}, base);
    if (rivalId === 'raza') {
      p.aggression = U.clamp(p.aggression * 1.3, 0.3, 0.97);
      p.spacing = 46;
      p.jumpiness = p.jumpiness * 0.6;
      p.comboLen = Math.min(6, p.comboLen + 1);
      p.blockChance = p.blockChance * 0.85;
      p.mixup = true;
    } else if (rivalId === 'vane') {
      p.aggression = U.clamp(p.aggression * 0.8, 0.2, 0.8);
      p.spacing = 150;
      p.blockChance = U.clamp(p.blockChance * 1.25, 0, 0.85);
      p.whiffPunish = true;
      p.antiAir = U.clamp(p.antiAir + 0.2, 0, 0.9);
      p.jumpiness = p.jumpiness * 0.4;
    }
    p.specialChance = U.clamp(p.specialChance + 0.2, 0, 0.7);
    return p;
  }

  /* Rivals wear their own palette, scaled to how deep the floor is. */
  function rivalGearVisual(rival, floor) {
    const t = U.clamp(Math.ceil(floor / 13), 1, 8);
    return {
      weaponTier: floor > 20 ? t : 0, weaponColor: rival.colors.accent,
      armor: false,
      head: false,
      boots: floor > 40, bootTier: t,
      charm: false,
    };
  }

  function bossGearVisual(info) {
    const t = Math.min(8, Math.max(1, Math.ceil(info.floor / 13)));
    return {
      weaponTier: info.floor > 6 ? t : 0, weaponColor: info.colors.accent,
      armor: info.floor > 10, armorColor: info.colors.accent, armorTier: t,
      head: info.warden || info.final || info.floor > 24, headColor: info.colors.accent, headTier: t,
      boots: info.floor > 16, bootTier: t,
      glovesTier: info.floor > 30 ? t : 0,
      charm: info.final,
    };
  }

  // -------------------------------------------------------------- main loop
  Game.frame = function (now) {
    if (!Game.running) return;
    const raw = Math.min(0.05, (now - Game.last) / 1000);
    Game.last = now;
    Game.frameDt = raw;
    Input.update();

    if (Game.screen === 'fight' && !Game.paused) {
      const scale = Game.slowmo > 0 ? 0.32 : 1;
      Game.update(raw * scale);
      if (Game.slowmo > 0) Game.slowmo -= raw;
    }
    Game.draw();
    requestAnimationFrame(Game.frame);
  };

  Game.update = function (dt) {
    Game.t += dt;
    const p = Game.player, b = Game.boss;

    if (Game.specialBannerT > 0) Game.specialBannerT -= dt;
    if (Game.announceT > 0) Game.announceT -= dt;
    if (Game.comboTimer > 0) {
      Game.comboTimer -= dt;
      if (Game.comboTimer <= 0) { Game.comboCount = 0; Game.comboDamage = 0; }
    }
    if (Game.hintT > 0) Game.hintT -= dt;
    [p, b].forEach((f) => { if (f.chainTimer > 0) f.chainTimer -= dt; });

    Game.ghostP = U.approach(Game.ghostP, p.hp / p.maxHp, dt * 0.35);
    Game.ghostB = U.approach(Game.ghostB, b.hp / b.maxHp, dt * 0.35);

    if (Game.state === 'intro') {
      Game.introT -= dt;
      if (Game.introT <= 1.2 && !Game.announce) {
        Game.setAnnounce('FLOOR ' + Game.bossInfo.floor, Game.bossInfo.name, 1.2, '#ffd166');
      }
      if (Game.introT <= 0) {
        Game.state = 'fight';
        p.state = 'idle'; p.setAnim('idle');
        b.state = 'idle'; b.setAnim('idle');
        Game.setAnnounce('FIGHT!', null, 0.9, '#7ee787');
        Audio.play('fight');
        Game.showHint();
      }
      R.updateFx(dt);
      return;
    }

    if (Game.state === 'over') {
      Game.endTimer -= dt;
      stepFighters(dt, true);
      R.updateFx(dt);
      if (Game.endTimer <= 0) Game.finish();
      return;
    }

    // hitstop: freeze the action for impact weight, keep FX running
    if (Game.hitstop > 0) {
      Game.hitstop -= dt;
      R.updateFx(dt);
      decayShake(dt);
      return;
    }

    Game.timer -= dt;
    if (Game.timer <= 0) {
      Game.timer = 0;
      Game.endMatch(p.hp / p.maxHp >= b.hp / b.maxHp ? 'win' : 'lose', 'TIME UP');
      return;
    }

    // ---- controllers
    const pIntent = playerIntent(p, b);
    p.applyIntent(pIntent, b, dt);
    const bIntent = Game.ai.update(dt, p);
    b.applyIntent(bIntent, p, dt);

    // warden phase 2
    if (!Game.phaseTriggered && Game.bossInfo.phases > 1 && b.hp / b.maxHp < 0.5) {
      Game.phaseTriggered = true;
      Game.ai.enterPhase2();
      b.auraColor = b.auraColor || '#ff4d6d';
      b.addMeter(50);
      R.FX.ring(b.x, b.y - 55, '#ff4d6d', 10, 160, 0.6);
      R.FX.text(b.x, b.y - 130, 'SECOND WIND', '#ff4d6d', 22);
      Game.setAnnounce('PHASE 2', Game.bossInfo.name + ' is furious', 1.0, '#ff4d6d');
      Audio.play('guardBreak');
    }

    stepFighters(dt, false);
    signatureFx(p);
    if (p.partFlash > 0) p.partFlash -= dt;
    if (b.partFlash > 0) b.partFlash -= dt;
    updateProjectiles(dt);
    resolveHits();
    pushApart();
    updateCamera(dt);
    R.updateFx(dt);
    decayShake(dt);

    if (!p.alive() || !b.alive()) {
      if (!p.alive() && !b.alive()) Game.endMatch('win', 'DOUBLE K.O.');
      else if (!b.alive()) Game.endMatch('win', 'K.O.');
      else Game.endMatch('lose', 'K.O.');
    }
  };

  function stepFighters(dt, endMode) {
    const p = Game.player, b = Game.boss;
    p.update(dt, BOUNDS, b);
    b.update(dt, BOUNDS, p);
    if (!endMode) {
      if (p.dashTimer > 8) R.FX.trail(p.x, p.y, '#6ea8ff', p.scale);
      if (b.dashTimer > 8) R.FX.trail(b.x, b.y, b.colors.body, b.scale);
      if (p.state === 'special') R.FX.trail(p.x, p.y, '#ffd166', p.scale);
    }
  }

  /* Beat-timed effects for the character signatures, exactly as the sheets
   * specify them. Fires once per frame crossing so a slow frame cannot
   * double-trigger or skip. */
  function signatureFx(f) {
    if (f.state !== 'special' || !f.special || !f.special.fx) {
      f._sigPrev = -1;
      return;
    }
    const sp = f.special;
    const prev = f._sigPrev === undefined ? -1 : f._sigPrev;
    const now = f.frame;
    f._sigPrev = now;
    const crossed = (n) => prev < n && now >= n;
    const c = f.character.colors;

    if (sp.fx === 'raza') {
      if (crossed(10)) {
        [0.40, 0.25, 0.12].forEach((a, i) => {
          setTimeout(() => R.FX.afterimage(f, a, 0.26), i * 28);
        });
      }
      if (crossed(58)) {
        R.FX.ring(f.x + f.facing * 40, f.y - 62 * f.scale, c.aura, 12, 46, 0.14);
      }
    } else if (sp.fx === 'vane') {
      if (crossed(32)) {
        R.FX.groundWave(f.x + f.facing * 30, Game.BOUNDS.ground, f.facing, c.aura, 120, 0.17);
        for (let i = 0; i < 5; i++) {
          R.FX.trail(f.x + f.facing * (20 + i * 14), f.y, c.body, f.scale * 0.6);
        }
      }
    }
  }

  function decayShake(dt) {
    Game.shake = Math.max(0, Game.shake - dt * 42);
    Game.shakeX = (Math.random() - 0.5) * Game.shake;
    Game.shakeY = (Math.random() - 0.5) * Game.shake * 0.6;
  }

  function pushApart() {
    const p = Game.player, b = Game.boss;
    const minDist = 42 * ((p.scale + b.scale) / 2);
    const d = b.x - p.x;
    const ad = Math.abs(d);
    if (ad < minDist && p.onGround && b.onGround) {
      const push = (minDist - ad) / 2;
      const s = U.sign(d) || 1;
      p.x -= push * s; b.x += push * s;
      p.x = U.clamp(p.x, BOUNDS.left, BOUNDS.right);
      b.x = U.clamp(b.x, BOUNDS.left, BOUNDS.right);
    }
  }

  function updateCamera(dt) {
    const p = Game.player, b = Game.boss;
    const d = Math.abs(p.x - b.x);
    const targetZoom = U.clamp(1.32 - d / 700, 1.0, 1.24);
    Game.zoom = U.lerp(Game.zoom, targetZoom, dt * 2.4);
    const mid = (p.x + b.x) / 2;
    const viewW = R.W / Game.zoom;
    Game.camX = U.clamp(mid, viewW / 2, R.W - viewW / 2);
  }

  // -------------------------------------------------------- player controls
  let lastTap = { dir: 0, t: -999 };

  function playerIntent(p, b) {
    const dir = (Input.down('right') ? 1 : 0) + (Input.down('left') ? -1 : 0);
    const intent = {
      dir,
      crouch: Input.down('down'),
      jump: Input.pressed('up'),
      block: Input.down('block'),
      button: null,
      special: null,
      dashDir: 0,
    };

    // double-tap dash
    if (Input.pressed('right') || Input.pressed('left')) {
      const d = Input.pressed('right') ? 1 : -1;
      const now = performance.now();
      if (lastTap.dir === d && now - lastTap.t < 280) { intent.dashDir = d; lastTap.t = -999; }
      else { lastTap = { dir: d, t: now }; }
    }

    if (Input.pressed('potion')) useTonic();

    let btn = null;
    if (Input.pressed('p1')) btn = 'P1';
    else if (Input.pressed('p2')) btn = 'P2';
    else if (Input.pressed('kick')) btn = 'K';

    if (btn) {
      const spec = matchSpecial(p);
      if (spec) {
        intent.special = spec;
        if (p.meter < spec.cost) {
          intent.special = null;
          intent.button = btn;
          R.FX.text(p.x, p.y - 130, 'NO RAGE', '#ff5c7c', 16);
          Audio.play('deny');
        }
      } else {
        intent.button = btn;
      }
    }
    return intent;
  }

  /* Match the recent input history against unlocked combo recipes. Button-only
   * recipes ignore direction inputs so walking doesn't break your string. */
  function matchSpecial(p) {
    const tokens = Input.recentTokens(p.facing);
    if (!tokens.length) return null;
    const buttonsOnly = tokens.filter((t) => t === 'P1' || t === 'P2' || t === 'K');
    const list = Game.specialList || Moves.SPECIALS_BY_LENGTH;
    for (let i = 0; i < list.length; i++) {
      const sp = list[i];
      if (sp.unlock > Progress.data.level) continue;
      const src = sp.motion ? tokens : buttonsOnly;
      if (src.length < sp.seq.length) continue;
      const tail = src.slice(src.length - sp.seq.length);
      let ok = true;
      for (let k = 0; k < sp.seq.length; k++) if (tail[k] !== sp.seq[k]) { ok = false; break; }
      if (ok) {
        Input.clearBuffer();
        return sp;
      }
    }
    return null;
  }

  function useTonic() {
    const p = Game.player;
    if (Game.tonics <= 0 || !p.canAct()) return;
    Game.tonics--;
    if (!Game.trainingMode) { Progress.data.tonics--; Progress.save(); }
    p.heal(Math.round(p.maxHp * 0.35));
    R.FX.text(p.x, p.y - 130, '+' + Math.round(p.maxHp * 0.35) + ' HP', '#7ee787', 20);
    R.FX.ring(p.x, p.y - 55, '#7ee787', 8, 70, 0.4);
    root.ST.UI.syncTonics();
  }
  Game.useTonic = useTonic;

  // ------------------------------------------------------------ projectiles
  function updateProjectiles(dt) {
    const p = Game.player;
    // spawn from special definitions
    [Game.player, Game.boss].forEach((f) => {
      if (f.state === 'special' && f.special && f.special.projectile && !f.projectileFired) {
        const pr = f.special.projectile;
        if (f.frame >= pr.f) {
          f.projectileFired = true;
          Game.projectiles.push({
            owner: f, x: f.x + f.facing * 40, y: f.y - pr.y, vx: f.facing * pr.speed,
            w: pr.w, h: pr.h, dmg: pr.dmg, life: pr.life,
            color: f.isPlayer ? '#9ad0ff' : f.colors.accent,
          });
          R.FX.ring(f.x + f.facing * 40, f.y - pr.y, '#9ad0ff', 6, 60, 0.3);
        }
      }
    });

    for (let i = Game.projectiles.length - 1; i >= 0; i--) {
      const pr = Game.projectiles[i];
      pr.x += pr.vx * dt;
      pr.life -= dt;
      const target = pr.owner === Game.player ? Game.boss : Game.player;
      const box = { x: pr.x - pr.w / 2, y: pr.y - pr.h / 2, w: pr.w, h: pr.h };
      if (U.aabb(box, target.hurtbox())) {
        const hit = { data: { dmg: pr.dmg, guard: 'mid', hitstun: 18, blockstun: 12, kb: 180, meter: 4, special: true, pushback: 40 } };
        const res = target.receiveHit(pr.owner, hit, comboScale(target));
        onHitResolved(pr.owner, target, hit, res, pr.x, pr.y);
        Game.projectiles.splice(i, 1);
        continue;
      }
      if (pr.life <= 0 || pr.x < BOUNDS.left - 80 || pr.x > BOUNDS.right + 80) Game.projectiles.splice(i, 1);
    }
  }

  // ------------------------------------------------------------- hit checks
  function comboScale(defender) {
    const chain = defender.chainTimer > 0 ? defender.chain : 0;
    return Math.max(0.35, Math.pow(0.9, chain));
  }

  function resolveHits() {
    const pair = [[Game.player, Game.boss], [Game.boss, Game.player]];
    pair.forEach(([atk, def]) => {
      if (!atk.alive() || !def.alive()) return;
      const hits = atk.activeHits();
      if (!hits.length) return;
      const hurt = def.hurtbox();
      hits.forEach((h) => {
        if (!U.aabb(h.box, hurt)) return;
        atk.markHitUsed(h.key);
        const res = def.receiveHit(atk, h, comboScale(def));
        const cx = U.clamp((h.box.x + h.box.w / 2 + hurt.x + hurt.w / 2) / 2, 0, R.W);
        const cy = (h.box.y + h.box.h / 2 + hurt.y + hurt.h / 2) / 2;
        onHitResolved(atk, def, h, res, cx, cy);
      });
    });
  }

  function onHitResolved(atk, def, h, res, cx, cy) {
    const d = h.data;
    if (res.result === 'miss') return;

    if (res.result === 'block' || res.result === 'guardbreak') {
      R.FX.spark(cx, cy, 6, '#9ad0ff', 140);
      R.FX.ring(cx, cy, '#9ad0ff', 4, 26, 0.18);
      Game.hitstop = Math.max(Game.hitstop, 0.035);
      Game.shake = Math.max(Game.shake, 3);
      if (res.result === 'guardbreak') {
        R.FX.text(cx, cy - 40, 'GUARD BREAK', '#ffd166', 22);
        Game.hitstop = 0.14;
        Game.shake = 14;
      }
      return;
    }

    // clean hit
    const heavy = d.dmg >= 14 || d.special;
    def.chain = (def.chainTimer > 0 ? def.chain : 0) + 1;
    def.chainTimer = 1.1;

    const acc = atk.character ? atk.character.colors.accent : '#fff3b0';
    const trim = atk.character ? atk.character.colors.trim : '#ffffff';
    if (d.special && atk.character) {
      // Sparks run along the punch vector rather than bursting in a ball.
      R.FX.shards(cx, cy, atk.facing > 0 ? -0.35 : Math.PI + 0.35, heavy ? 8 : 6, acc, 0.9, heavy ? 340 : 240);
    } else {
      R.FX.spark(cx, cy, heavy ? 14 : 8, res.crit ? '#ffd166' : acc, heavy ? 280 : 180);
    }
    R.FX.ring(cx, cy, res.crit ? '#ffd166' : trim, 4, heavy ? 60 : 36, 0.2);
    if (d.shock) R.FX.shock(cx, cy, acc);
    atk.partFlash = 0.034;   // two frames — the sheet's forearm-wrap flash

    Game.hitstop = Math.max(Game.hitstop, heavy ? 0.085 : 0.045);
    Game.shake = Math.max(Game.shake, heavy ? 12 : 6);

    if (atk === Game.player) {
      Game.comboCount = def.chain;
      Game.comboDamage += res.dmg;
      Game.comboTimer = 1.4;
      if (def.chain > Game.bestCombo) Game.bestCombo = def.chain;
      R.FX.text(cx, cy - 30, (res.crit ? 'CRIT ' : '') + Math.round(res.dmg), res.crit ? '#ffd166' : '#ffffff', res.crit ? 24 : 18);
    } else {
      R.FX.text(cx, cy - 30, '-' + Math.round(res.dmg), '#ff7b7b', 16);
    }

    if (res.knockdown) R.FX.dust(def.x, BOUNDS.ground, -def.facing);
  }

  // ------------------------------------------------------------- match end
  Game.setAnnounce = function (text, sub, seconds, color) {
    Game.announce = text;
    Game.announceSub = sub || null;
    Game.announceT = seconds;
    Game.announceMax = seconds;
    Game.announceColor = color || '#ffd166';
  };

  Game.endMatch = function (result, label) {
    if (Game.state === 'over') return;
    Game.state = 'over';
    Game.result = result;
    Game.endTimer = 2.6;
    Game.slowmo = 1.1;
    Game.shake = 16;
    const perfect = result === 'win' && Game.player.damageTaken === 0;
    Game.setAnnounce(label || 'K.O.', perfect ? 'PERFECT' : null, 2.4, result === 'win' ? '#7ee787' : '#ff5c7c');
    const winner = result === 'win' ? Game.player : Game.boss;
    const loser = result === 'win' ? Game.boss : Game.player;
    if (loser.alive()) loser.toKO();
    winner.state = 'win'; winner.setAnim('win');
    Audio.duck(0.2, 2);
  };

  Game.finish = function () {
    Audio.stopMusic();
    const info = Game.bossInfo;
    const perfect = Game.result === 'win' && Game.player.damageTaken === 0;
    const fast = Game.result === 'win' && Game.timer > Game.clock * 0.5;
    const first = Game.result === 'win' && info.floor >= Progress.data.highest;

    let payload;
    if (Game.trainingMode) {
      const reward = Progress.rewardFor(info.floor, { perfect, fast, first: false });
      const coins = Math.round(reward.coins * 0.4);
      if (Game.result === 'win') {
        Progress.data.coins += coins;
        Progress.data.stats.coinsEarned += coins;
        Progress.addXp(Math.round(reward.xp * 0.3));
        Progress.save();
      }
      payload = { training: true, result: Game.result, coins: Game.result === 'win' ? coins : 0, xp: 0, levels: [], perfect, fast, first: false, floor: info.floor, bestCombo: Game.bestCombo };
    } else if (Game.result === 'win') {
      const reward = Progress.rewardFor(info.floor, { perfect, fast, first });
      const levels = Progress.recordWin(info.floor, reward, { perfect, bestCombo: Game.bestCombo });
      payload = { result: 'win', reward, levels, perfect, fast, first, floor: info.floor, bestCombo: Game.bestCombo };
      Audio.play(info.floor % 10 === 0 ? 'floorUp' : 'coin');
      if (levels.length) setTimeout(() => Audio.play('levelUp'), 400);
    } else {
      Progress.recordLoss();
      const consolation = Math.round((40 + info.floor * 6) * Progress.combat().coinMul);
      Progress.data.coins += consolation;
      Progress.data.stats.coinsEarned += consolation;
      Progress.save();
      payload = { result: 'lose', coins: consolation, floor: info.floor, bestCombo: Game.bestCombo };
    }
    Game.screen = 'result';
    Input.releaseAll();

    const charId = Progress.data.character || 'classic';
    const after = Game.result === 'win' && !Game.trainingMode
      ? root.ST.Campaign.beatAfter(info.floor, charId, Progress.data)
      : null;
    if (after) {
      root.ST.Campaign.markSeen(Progress.data, charId, after.key);
      Progress.save();
      root.ST.UI.showStory(after, () => root.ST.UI.showResult(payload));
      return;
    }
    root.ST.UI.showResult(payload);
  };

  Game.togglePause = function () {
    if (Game.screen !== 'fight' || Game.state === 'over') return;
    Game.paused = !Game.paused;
    root.ST.UI.setPaused(Game.paused);
    Input.releaseAll();
  };

  Game.quitFight = function () {
    Audio.stopMusic();
    Game.paused = false;
    root.ST.UI.setPaused(false);
    Input.releaseAll();
    Game.screen = 'tower';
    root.ST.UI.show('tower');
  };

  Game.showHint = function () {
    if (!Game.settings.showHints) return;
    const specials = Progress.unlockedSpecials().filter((s) => !s.motion);
    if (!specials.length) return;
    const sp = specials[Math.floor(Math.random() * specials.length)];
    Game.hint = 'COMBO: ' + sp.seq.map(btnLabel).join(' → ') + '  =  ' + sp.name;
    Game.hintT = 5.5;
  };

  function btnLabel(b) { return b === 'P1' ? 'PUNCH 1' : b === 'P2' ? 'PUNCH 2' : b === 'K' ? 'KICK' : b; }
  Game.btnLabel = btnLabel;

  // ----------------------------------------------------------------- draw
  Game.draw = function () {
    const ctx = Game.ctx;
    if (!ctx) return;
    const c = Game.canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.save();
    ctx.translate(Game.viewX, Game.viewY);
    ctx.scale(Game.viewScale, Game.viewScale);
    ctx.beginPath(); ctx.rect(0, 0, R.W, R.H); ctx.clip();

    if (Game.screen === 'fight' && Game.player) {
      drawFight(ctx);
    } else {
      drawMenuBackdrop(ctx);
    }

    ctx.restore();
  };

  function drawFight(ctx) {
    const zoom = Game.zoom || 1;
    const camX = Game.camX === undefined ? R.W / 2 : Game.camX;

    ctx.save();
    ctx.translate(R.W / 2, R.H * 0.56);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX + Game.shakeX, -R.H * 0.56 + Game.shakeY);

    R.drawBackground(ctx, Game.bossInfo.tier, Game.t, Game.shakeX);

    const order = Game.player.y <= Game.boss.y ? [Game.boss, Game.player] : [Game.player, Game.boss];
    order.forEach((f) => R.drawFighter(ctx, f, {
      debug: Game.settings.debug, dt: Game.frameDt,
      band: f.isPlayer ? Game.band : 'mid',
    }));

    Game.projectiles.forEach((pr) => R.drawProjectile(ctx, pr, Game.t));
    R.drawFx(ctx);

    ctx.restore();

    // vignette
    const vg = ctx.createRadialGradient(R.W / 2, R.H / 2, R.H * 0.35, R.W / 2, R.H / 2, R.H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, R.W, R.H);

    HUD.draw(ctx, Game);

    if (Game.state === 'intro' && Game.introT > 1.2) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 180, R.W, 150);
      ctx.textAlign = 'center';
      ctx.fillStyle = Game.bossInfo.colors.body;
      ctx.font = '900 44px system-ui, sans-serif';
      ctx.fillText(Game.bossInfo.name.toUpperCase(), R.W / 2, 236);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillText(Game.bossInfo.title, R.W / 2, 264);
      ctx.fillStyle = 'rgba(255,255,255,0.62)';
      ctx.font = 'italic 500 16px system-ui, sans-serif';
      ctx.fillText('"' + Game.bossInfo.taunt + '"', R.W / 2, 296);
      ctx.restore();
    }
  }

  /* Animated backdrop behind the menus so the app never looks static. */
  function drawMenuBackdrop(ctx) {
    const t = performance.now() / 1000;
    const floor = Progress.data ? Progress.data.floor : 1;
    const tier = Floors.tierOf(floor);
    R.drawBackground(ctx, tier, t, 0);
    const demo = Game.demoFighter || (Game.demoFighter = makeDemoFighter());
    demo.animT = t;
    const cycle = (t % 9);
    demo.anim = cycle < 3 ? 'idle' : cycle < 4.4 ? 'walk' : cycle < 5.4 ? 'jump' : cycle < 6.6 ? 'idle' : 'win';
    demo.vy = cycle >= 4.4 && cycle < 5.4 ? -100 : 0;
    demo.y = R.GROUND_Y - (cycle >= 4.4 && cycle < 5.4 ? Math.sin((cycle - 4.4) * Math.PI) * 90 : 0);
    demo.x = 170 + Math.sin(t * 0.6) * 40;
    demo.gear = buildGearVisual();
    const ch = Progress.character();
    demo.character = ch;
    demo.colors = ch.colors;
    demo.scale = ch.build.scale;
    R.drawFighter(ctx, demo, { dt: Game.frameDt, band: Progress.gearBand() });
    ctx.fillStyle = 'rgba(4,6,12,0.55)';
    ctx.fillRect(0, 0, R.W, R.H);
  }

  function makeDemoFighter() {
    const f = new Fighter({
      name: 'demo', isPlayer: true, x: 180, facing: 1,
      colors: { body: '#f2f4f8', accent: '#6ea8ff' },
      stats: { maxHp: 100, atkMul: 1, dr: 0, spdMul: 1, aspdMul: 1, crit: 0, critDmg: 1, rageMul: 1 },
      gear: {},
    });
    f.y = R.GROUND_Y;
    return f;
  }

  Game.BOUNDS = BOUNDS;
  Game.FIGHT_SECONDS = FIGHT_SECONDS;
  root.ST = root.ST || {};
  root.ST.Game = Game;
})(window);
