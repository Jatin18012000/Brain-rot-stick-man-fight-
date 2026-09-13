/* Stickman Tower — the fighter: physics, state machine, hit/hurt boxes.
 *
 * Player and boss share this class entirely. The only difference is who fills
 * in the `intent` each frame: the input layer, or the AI brain.
 */
(function (root) {
  'use strict';

  const U = root.ST.U;
  const Moves = root.ST.Moves;

  const GRAVITY = 2100;
  const JUMP_V = 700;
  const WALK_F = 178;
  const WALK_B = 148;
  const DASH_V = 430;
  const GROUND_FRICTION = 1500;
  const AIR_DRAG = 220;
  const MAX_GUARD = 100;
  const BUFFER_SECONDS = 0.28;   // attack input buffer window

  const HURT = {
    stand: { x: -16, y: 0, w: 32, h: 112 },
    crouch: { x: -18, y: 0, w: 36, h: 74 },
    air: { x: -16, y: 8, w: 32, h: 96 },
    down: { x: -32, y: 0, w: 64, h: 34 },
  };

  function Fighter(cfg) {
    this.name = cfg.name || 'Fighter';
    this.isPlayer = !!cfg.isPlayer;
    this.colors = cfg.colors || { body: '#eaeaea', accent: '#6ea8ff' };
    this.scale = cfg.scale || 1;
    this.gear = cfg.gear || null;          // equipped ids, for rendering
    this.character = cfg.character || null; // palette, build, soft parts
    this.stats = cfg.stats;                // combat stats block
    this.specials = cfg.specials || [];    // available special defs
    this.maxHp = this.stats.maxHp;
    this.reset(cfg.x || 0, cfg.facing || 1);
  }

  Fighter.prototype.reset = function (x, facing) {
    this.x = x;
    this.y = 0;                 // set by arena (ground line)
    this.vx = 0; this.vy = 0;
    this.facing = facing;
    this.onGround = true;
    this.hp = this.maxHp;
    this.meter = 0;
    this.guard = MAX_GUARD;
    this.state = 'idle';
    this.move = null;
    this.special = null;
    this.frame = 0;
    this.stateTime = 0;
    this.stun = 0;
    this.hitUsed = false;
    this.specialHitFlags = [];
    this.comboCount = 0;
    this.comboDecay = 0;
    this.damageTaken = 0;
    this.dashTimer = 0;
    this.dashDir = 0;
    this.lastDirTap = { dir: 0, t: -999 };
    this.invuln = 0;
    this.blocking = false;
    this.blockLow = false;
    this.guardBroken = 0;
    this.knockdownTimer = 0;
    this.flash = 0;
    this.winPose = 0;
    this.intro = 0;
    this.anim = 'idle';
    this.animT = 0;
    this.facingLock = false;
    this.pendingSpecial = null;
    this.juggle = 0;
    this.lastHitBy = null;
    this.tonicFlash = 0;
    this.buffered = null;
    this.chain = 0;
    this.chainTimer = 0;
  };

  Fighter.prototype.alive = function () { return this.hp > 0; };

  Fighter.prototype.stance = function () {
    if (!this.onGround) return 'air';
    if (this.state === 'crouch' || (this.state === 'idle' && this.crouchHeld)) return 'crouch';
    return 'stand';
  };

  Fighter.prototype.canAct = function () {
    if (this.state === 'ko' || this.state === 'intro' || this.state === 'win') return false;
    if (this.state === 'attack' || this.state === 'special') return false;
    if (this.state === 'hitstun' || this.state === 'blockstun' || this.state === 'knockdown' || this.state === 'guardbreak') return false;
    return true;
  };

  /* Ground normals cancel into specials from their startup onward, hit or
   * miss. Strict hit-confirm reads better on a pad, but this game is played
   * with thumbs: a combo sequence has to flow out of whatever you are already
   * swinging, or the last button of a six-input string never lands in time. */
  Fighter.prototype.canCancel = function () {
    if (this.state !== 'attack' || !this.move) return false;
    if (Moves.CANCELABLE.indexOf(this.move.id) === -1) return false;
    return this.frame >= Math.max(1, this.move.startup - 2);
  };

  Fighter.prototype.hurtbox = function () {
    let b;
    if (this.state === 'knockdown' || this.state === 'ko') b = HURT.down;
    else if (!this.onGround) b = HURT.air;
    else if (this.stance() === 'crouch') b = HURT.crouch;
    else b = HURT.stand;
    return this.toWorld(b);
  };

  Fighter.prototype.toWorld = function (b) {
    const s = this.scale;
    const w = b.w * s, h = b.h * s;
    const lx = this.facing > 0 ? b.x * s : -b.x * s - w;
    return { x: this.x + lx, y: this.y - (b.y * s) - h, w, h };
  };

  Fighter.prototype.height = function () { return HURT.stand.h * this.scale; };

  // ---------------------------------------------------------------- intent
  /* intent: {dir:-1|0|1, crouch, jump, block, button:'P1'|'P2'|'K'|null,
   *          special: specDef|null, dashDir:-1|0|1}
   *
   * Attacks pressed a few frames too early are remembered and fired the moment
   * the fighter can act again. Without this, tapping a 3-button combo at human
   * speed loses inputs to the previous move's recovery. */
  Fighter.prototype.applyIntent = function (intent, opponent, dt) {
    if (this.state === 'ko' || this.state === 'intro' || this.state === 'win') return;

    if (this.buffered) {
      this.buffered.life -= (dt || 1 / 60);
      if (this.buffered.life <= 0) this.buffered = null;
    }
    const canUseBuffer = this.buffered &&
      (this.canAct() || (this.buffered.special && this.canCancel()));
    if (canUseBuffer) {
      intent = Object.assign({}, intent, {
        button: this.buffered.button,
        special: this.buffered.special,
        crouch: this.buffered.crouch,
      });
      this.buffered = null;
    } else if ((intent.button || intent.special) && !this.canAct() &&
               !(intent.special && this.canCancel())) {
      this.buffered = {
        button: intent.button, special: intent.special,
        crouch: intent.crouch, life: BUFFER_SECONDS,
      };
    }

    // Face the opponent whenever we're free to turn.
    if (opponent && this.canAct() && !this.facingLock) {
      const want = opponent.x >= this.x ? 1 : -1;
      if (this.state !== 'crouch' || Math.abs(opponent.x - this.x) > 20) this.facing = want;
    }

    this.crouchHeld = !!intent.crouch && this.onGround;

    // Special takes priority: from neutral, or cancelling a connected normal.
    if (intent.special && (this.canAct() || this.canCancel())) {
      if (this.meter >= intent.special.cost) {
        this.startSpecial(intent.special);
        return;
      }
    }

    if (!this.canAct()) return;

    if (intent.button) {
      const dirIntent = intent.dir === 0 ? null : (intent.dir === this.facing ? 'fwd' : 'back');
      const mv = Moves.normalFor(intent.button, this.stance(), dirIntent);
      this.startMove(mv);
      return;
    }

    if (intent.jump && this.onGround) {
      this.vy = -JUMP_V;
      this.onGround = false;
      this.state = 'jump';
      this.vx = intent.dir * WALK_F * 0.95 * this.stats.spdMul;
      this.setAnim('jump');
      root.ST.Audio.play('jump');
      return;
    }

    if (intent.dashDir && this.onGround && this.dashTimer <= 0) {
      this.dashTimer = 13;
      this.dashDir = intent.dashDir;
      this.vx = intent.dashDir * DASH_V * this.stats.spdMul;
      this.setAnim('dash');
      return;
    }

    // Holding away from the opponent = block (classic street-fighter guard).
    const away = opponent ? (opponent.x >= this.x ? -1 : 1) : 0;
    const holdingBack = intent.dir === away && away !== 0;
    this.blocking = this.onGround && this.guardBroken <= 0 && (holdingBack || !!intent.block);
    this.blockLow = this.blocking && this.crouchHeld;

    if (this.onGround) {
      if (this.crouchHeld) {
        this.state = 'crouch';
        this.vx = U.approach(this.vx, 0, GROUND_FRICTION / 60);
        this.setAnim(this.blocking ? 'blockLow' : 'crouch');
      } else if (intent.dir !== 0 && !this.blocking) {
        this.state = 'walk';
        const fwd = intent.dir === this.facing;
        this.vx = intent.dir * (fwd ? WALK_F : WALK_B) * this.stats.spdMul;
        this.setAnim(fwd ? 'walk' : 'walkBack');
      } else if (intent.dir !== 0 && this.blocking) {
        this.state = 'walk';
        this.vx = intent.dir * WALK_B * 0.7 * this.stats.spdMul;
        this.setAnim('block');
      } else {
        this.state = 'idle';
        this.vx = U.approach(this.vx, 0, GROUND_FRICTION / 60);
        this.setAnim(this.blocking ? 'block' : 'idle');
      }
    }
  };

  Fighter.prototype.setAnim = function (name) {
    if (this.anim !== name) { this.anim = name; this.animT = 0; }
  };

  Fighter.prototype.startMove = function (mv) {
    this.move = mv;
    this.special = null;
    this.state = 'attack';
    this.frame = 0;
    this.hitUsed = false;
    this.moveConnected = false;
    this.blocking = false;
    this.setAnim(mv.anim);
    this.facingLock = true;
    if (mv.stance !== 'air') this.vx = 0;
    root.ST.Audio.play(mv.sfx || 'whiffLight');
  };

  Fighter.prototype.startSpecial = function (spec) {
    this.special = spec;
    this.move = null;
    this.state = 'special';
    this.frame = 0;
    this.specialHitFlags = spec.hits.map(() => false);
    this.projectileFired = false;
    this.meter = Math.max(0, this.meter - spec.cost);
    this.blocking = false;
    this.facingLock = true;
    this.setAnim(spec.anim || 'special');
    root.ST.Audio.play('whiffHeavy');
    this.onSpecialStart && this.onSpecialStart(spec);
  };

  // ---------------------------------------------------------------- update
  Fighter.prototype.update = function (dt, bounds, opponent) {
    const fr = dt * 60;                 // fraction of a 60fps frame
    this.stateTime += dt;
    this.animT += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.tonicFlash > 0) this.tonicFlash -= dt;
    if (this.invuln > 0) this.invuln -= fr;
    if (this.dashTimer > 0) this.dashTimer -= fr;
    if (this.guardBroken > 0) this.guardBroken -= fr;
    if (this.comboDecay > 0) {
      this.comboDecay -= dt;
      if (this.comboDecay <= 0) this.comboCount = 0;
    }

    // Guard regenerates while you're not eating pressure.
    if (this.guard < MAX_GUARD && this.state !== 'blockstun' && this.guardBroken <= 0) {
      this.guard = Math.min(MAX_GUARD, this.guard + 16 * dt);
    }

    if (this.state === 'attack') this.tickMove(fr);
    else if (this.state === 'special') this.tickSpecial(fr);
    else if (this.state === 'hitstun' || this.state === 'blockstun' || this.state === 'guardbreak') {
      this.stun -= fr;
      if (this.stun <= 0) {
        if (!this.onGround) { this.state = 'jump'; this.setAnim('jump'); }
        else { this.state = 'idle'; this.setAnim('idle'); this.facingLock = false; }
      }
    } else if (this.state === 'knockdown') {
      this.knockdownTimer -= fr;
      if (this.knockdownTimer <= 0 && this.onGround) {
        this.state = 'idle';
        this.invuln = 12;
        this.setAnim('wakeup');
        this.facingLock = false;
      }
    }

    // Physics
    if (!this.onGround) {
      this.vy += GRAVITY * dt;
      this.vx = U.approach(this.vx, 0, AIR_DRAG * dt);
    } else if (this.state !== 'walk' && this.dashTimer <= 0 && this.state !== 'attack' && this.state !== 'special') {
      this.vx = U.approach(this.vx, 0, GROUND_FRICTION * dt);
    } else if (this.dashTimer <= 0 && (this.state === 'attack' || this.state === 'special')) {
      this.vx = U.approach(this.vx, 0, GROUND_FRICTION * 0.8 * dt);
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const groundY = bounds.ground;
    if (this.y >= groundY) {
      if (!this.onGround) {
        this.onGround = true;
        this.vy = 0;
        this.y = groundY;
        if (this.state === 'hitstun' && this.pendingKnockdown) {
          this.toKnockdown();
        } else if (this.state === 'hitstun') {
          this.stun = Math.max(this.stun, 8);
        } else if (this.state === 'attack' || this.state === 'special') {
          // land out of an air normal
          if (this.move && this.move.stance === 'air') this.endMove();
        } else if (this.state !== 'knockdown' && this.state !== 'ko') {
          this.state = 'idle';
          this.setAnim('land');
          root.ST.Audio.play('land');
        }
      }
      this.y = groundY;
      this.vy = 0;
    } else {
      this.onGround = false;
    }

    this.x = U.clamp(this.x, bounds.left, bounds.right);

    if (this.hp <= 0 && this.state !== 'ko') this.toKO();
  };

  Fighter.prototype.tickMove = function (fr) {
    const mv = this.move;
    const speed = mv.stance === 'air' ? 1 : this.stats.aspdMul;
    this.frame += fr * speed;
    const total = Moves.totalFrames(mv);

    if (mv.moveX && this.frame < mv.startup + mv.active && this.onGround) {
      this.vx = this.facing * mv.moveX * 3.2 * (this.frame < mv.startup ? 0.5 : 1);
    }
    if (this.frame >= total) this.endMove();
  };

  Fighter.prototype.endMove = function () {
    this.move = null;
    this.frame = 0;
    this.facingLock = false;
    this.state = this.onGround ? 'idle' : 'jump';
    this.setAnim(this.onGround ? 'idle' : 'jump');
  };

  Fighter.prototype.tickSpecial = function (fr) {
    const sp = this.special;
    this.frame += fr;
    (sp.steps || []).forEach((s) => {
      if (this.frame >= s.f && this.frame - fr < s.f) {
        if (s.vx) this.vx = this.facing * s.vx;
        if (s.vy) { this.vy = -s.vy; this.onGround = false; }
      }
    });
    if (sp.invuln && this.frame >= sp.invuln[0] && this.frame <= sp.invuln[1]) this.invuln = 2;
    if (this.frame >= sp.duration) {
      this.special = null;
      this.frame = 0;
      this.facingLock = false;
      this.state = this.onGround ? 'idle' : 'jump';
      this.setAnim(this.onGround ? 'idle' : 'jump');
    }
  };

  // ------------------------------------------------------------ hit output
  /* Active hitboxes this frame, with the data needed to resolve a hit. */
  Fighter.prototype.activeHits = function () {
    const out = [];
    if (this.state === 'attack' && this.move && !this.hitUsed) {
      const mv = this.move;
      if (this.frame >= mv.startup && this.frame < mv.startup + mv.active) {
        out.push({ box: this.reachBox(mv.box), data: mv, key: 'normal' });
      }
    } else if (this.state === 'special' && this.special) {
      const sp = this.special;
      sp.hits.forEach((h, i) => {
        if (this.specialHitFlags[i]) return;
        if (this.frame >= h.f && this.frame < h.f + h.active) {
          out.push({ box: this.reachBox(h.box), data: Object.assign({ special: sp, name: sp.name }, h), key: i });
        }
      });
    }
    return out;
  };

  /* Character reach extends every attack box forward — the whole identity of a
   * long-limbed fighter is winning trades a short one cannot reach. */
  Fighter.prototype.reachBox = function (b) {
    const reach = this.stats.reach || 0;
    return this.toWorld(reach ? { x: b.x, y: b.y, w: b.w + reach, h: b.h } : b);
  };

  Fighter.prototype.markHitUsed = function (key) {
    if (key === 'normal') { this.hitUsed = true; this.moveConnected = true; }
    else this.specialHitFlags[key] = true;
  };

  Fighter.prototype.addMeter = function (amount) {
    const before = this.meter;
    this.meter = U.clamp(this.meter + amount * (this.stats.rageMul || 1), 0, 100);
    if (before < 100 && this.meter >= 100 && this.isPlayer) root.ST.Audio.play('meterFull');
  };

  // ------------------------------------------------------------- hit input
  /* Decide block vs hit and apply the result. Returns a result descriptor the
   * arena uses for FX, combo counting and score. */
  Fighter.prototype.receiveHit = function (attacker, hit, scaling) {
    if (this.invuln > 0 || this.state === 'ko') return { result: 'miss' };

    const d = hit.data;
    const guardType = d.guard || 'mid';
    let blocked = false;

    if (this.blocking && this.onGround && this.guardBroken <= 0) {
      if (guardType === 'low') blocked = this.blockLow;
      else if (guardType === 'overhead') blocked = !this.blockLow;
      else blocked = true;
    }

    const dirFromAttacker = this.x >= attacker.x ? 1 : -1;

    if (blocked) {
      const bs = d.blockstun || 10;
      this.state = 'blockstun';
      this.stun = bs;
      this.setAnim(this.blockLow ? 'blockLow' : 'block');
      this.vx = dirFromAttacker * (d.pushback || 40) * 1.6;
      const drain = (d.guardCrush || 0) + (d.dmg || 6) * 0.9;
      this.guard -= drain;
      const chip = d.special ? Math.max(1, d.dmg * 0.12) : 0;
      if (chip) this.hp = Math.max(1, this.hp - chip);
      this.addMeter(1.5);
      attacker.addMeter((d.meter || 3) * 0.4);
      if (this.guard <= 0) {
        this.guard = 0;
        this.guardBroken = 110;
        this.state = 'guardbreak';
        this.stun = 46;
        this.setAnim('stunned');
        this.blocking = false;
        root.ST.Audio.play('guardBreak');
        return { result: 'guardbreak', dmg: chip };
      }
      root.ST.Audio.play('block');
      return { result: 'block', dmg: chip };
    }

    // ------- clean hit
    const scale = scaling === undefined ? 1 : scaling;
    let dmg = d.dmg * (attacker.stats.atkMul || 1) * scale;
    const pierce = d.armorPierce || 0;
    const dr = Math.max(0, this.stats.dr * (1 - pierce));
    dmg *= (1 - dr);

    let crit = false;
    if (Math.random() < (attacker.stats.crit || 0)) {
      crit = true;
      dmg *= attacker.stats.critDmg || 1.6;
    }
    dmg = Math.max(1, Math.round(dmg));

    this.hp = Math.max(0, this.hp - dmg);
    this.damageTaken += dmg;
    this.flash = 0.12;
    this.lastHitBy = attacker;

    if (attacker.stats.lifesteal) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + dmg * attacker.stats.lifesteal);
    }

    this.addMeter(dmg * 0.22);
    attacker.addMeter(d.meter || (d.special ? 0 : 4));

    const airborne = !this.onGround;
    this.blocking = false;
    this.facingLock = true;

    if (d.lift) {
      this.vy = -d.lift;
      this.onGround = false;
      this.juggle++;
    }
    this.vx = dirFromAttacker * (d.kb || 100) * 1.15;

    this.pendingKnockdown = !!d.knockdown || (airborne && !d.lift);
    if (d.knockdown && this.onGround) {
      this.vy = -260;
      this.onGround = false;
    }

    this.state = 'hitstun';
    this.stun = (d.hitstun || 14) * (airborne ? 0.85 : 1);
    this.setAnim(airborne || d.lift ? 'airHurt' : (guardType === 'low' ? 'hurtLow' : 'hurt'));

    root.ST.Audio.play(d.special ? 'hitSpecial' : (d.dmg >= 14 ? 'hitHeavy' : 'hitLight'));

    return { result: 'hit', dmg, crit, knockdown: this.pendingKnockdown };
  };

  Fighter.prototype.toKnockdown = function () {
    this.state = 'knockdown';
    this.knockdownTimer = 44;
    this.pendingKnockdown = false;
    this.juggle = 0;
    this.vx *= 0.3;
    this.setAnim('down');
    root.ST.Audio.play('knockdown');
  };

  Fighter.prototype.toKO = function () {
    this.state = 'ko';
    this.hp = 0;
    this.vy = -300;
    this.vx = -this.facing * 180;
    this.onGround = false;
    this.setAnim('ko');
    this.blocking = false;
    root.ST.Audio.play('ko');
  };

  Fighter.prototype.heal = function (amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.tonicFlash = 0.5;
    root.ST.Audio.play('potion');
  };

  Fighter.CONST = { GRAVITY, JUMP_V, WALK_F, WALK_B, MAX_GUARD, HURT };

  root.ST = root.ST || {};
  root.ST.Fighter = Fighter;
})(window);
