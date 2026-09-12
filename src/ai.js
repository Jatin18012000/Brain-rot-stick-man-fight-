/* Stickman Tower — boss brain.
 *
 * Produces the same `intent` object the player's controls produce, so bosses
 * are bound by exactly the same rules: same frame data, same blocking, same
 * meter. Difficulty comes from reaction time, spacing and discipline.
 */
(function (root) {
  'use strict';

  const U = root.ST.U;
  const Moves = root.ST.Moves;

  const BOSS_SPECIAL_IDS = ['twinSweep', 'risingFang', 'cyclone', 'hammerFall', 'tornado', 'shadowDance', 'dashSmash', 'ironWaltz', 'thunderCross'];

  function AI(fighter, profile, floor) {
    this.f = fighter;
    this.p = profile;
    this.floor = floor;
    this.queue = [];
    this.cool = 30;
    this.rng = U.rng(floor * 7919 + 17);
    this.phase = 1;
    this.specials = Moves.SPECIALS.filter((s) =>
      BOSS_SPECIAL_IDS.indexOf(s.id) !== -1 && s.unlock * 5 <= floor + 6);
    this.lastSpecial = -999;
    this.t = 0;
  }

  AI.prototype.enterPhase2 = function () {
    if (this.phase === 2) return;
    this.phase = 2;
    this.p = Object.assign({}, this.p, {
      aggression: U.clamp(this.p.aggression * 1.3, 0, 0.97),
      reaction: Math.max(3, Math.round(this.p.reaction * 0.7)),
      specialChance: U.clamp(this.p.specialChance + 0.18, 0, 0.7),
      comboLen: Math.min(6, this.p.comboLen + 1),
    });
  };

  AI.prototype.push = function (step, frames) {
    this.queue.push({ step, frames: frames, first: true });
  };

  AI.prototype.idleIntent = function () {
    return { dir: 0, crouch: false, jump: false, block: false, button: null, special: null, dashDir: 0 };
  };

  AI.prototype.update = function (dt, opp) {
    this.t += dt;
    const fr = dt * 60;
    const f = this.f;

    if (!f.alive() || f.state === 'ko' || opp.state === 'ko') return this.idleIntent();

    if (this.cool > 0) this.cool -= fr;

    if (!this.queue.length && this.cool <= 0) this.decide(opp);

    if (!this.queue.length) return this.idleIntent();

    const head = this.queue[0];
    const intent = Object.assign(this.idleIntent(), head.step);
    if (!head.first) { intent.button = null; intent.special = null; intent.jump = false; intent.dashDir = 0; }
    head.first = false;
    head.frames -= fr;
    if (head.frames <= 0) this.queue.shift();
    return intent;
  };

  AI.prototype.dist = function (opp) { return Math.abs(opp.x - this.f.x); };
  AI.prototype.toward = function (opp) { return opp.x >= this.f.x ? 1 : -1; };

  AI.prototype.decide = function (opp) {
    const f = this.f, p = this.p, rng = this.rng;
    const d = this.dist(opp);
    const toward = this.toward(opp);
    const away = -toward;

    this.cool = Math.max(2, p.reaction * rng.range(0.7, 1.3));

    // --- defensive reads first -------------------------------------------
    const oppAttacking = opp.state === 'attack' || opp.state === 'special';
    if (oppAttacking && d < 150 && rng.chance(p.blockChance)) {
      const low = opp.move ? opp.move.guard === 'low' : rng.chance(0.4);
      this.push({ dir: away, crouch: low, block: true }, 16 + rng.int(0, 14));
      return;
    }

    // Anti-air: they jumped, we swat them out of the sky.
    if (!opp.onGround && d < 190 && rng.chance(p.antiAir)) {
      const rising = this.specials.find((s) => s.id === 'risingFang');
      if (rising && f.meter >= rising.cost && rng.chance(0.5)) {
        this.push({ special: rising }, 8);
      } else {
        this.push({ button: 'K' }, 10);
      }
      return;
    }

    // Whiff punish: they swung and missed, close the gap and hit back.
    if (p.whiffPunish && opp.state === 'attack' && opp.frame > (opp.move ? opp.move.startup + opp.move.active : 6) && d < 210) {
      if (d > 90) this.push({ dashDir: toward }, 12);
      this.push({ button: rng.chance(0.5) ? 'P2' : 'K' }, 14);
      return;
    }

    // Wake-up pressure / okizeme.
    if (opp.state === 'knockdown' && d < 220) {
      if (d > 110) this.push({ dir: toward }, 12 + rng.int(0, 8));
      else this.push({ dir: 0 }, 10 + rng.int(0, 16));
      return;
    }

    // --- offence ---------------------------------------------------------
    const wantsSpecial = f.meter >= 25 && rng.chance(p.specialChance) && (this.t - this.lastSpecial) > 2.2;
    if (wantsSpecial) {
      const usable = this.specials.filter((s) => f.meter >= s.cost);
      if (usable.length) {
        const sp = rng.pick(usable);
        this.lastSpecial = this.t;
        if (d > 120 && sp.id !== 'dashSmash') this.push({ dir: toward }, Math.min(30, (d - 90) / 3));
        this.push({ special: sp }, 10);
        return;
      }
    }

    const inRange = d < 96;
    const nearRange = d < 150;

    if (inRange && rng.chance(p.aggression)) {
      this.pushCombo(opp, rng);
      return;
    }

    if (nearRange && rng.chance(p.aggression * 0.7)) {
      // Step in then swing.
      this.push({ dir: toward }, 8 + rng.int(0, 8));
      this.pushCombo(opp, rng);
      return;
    }

    if (p.projectile && d > 260 && rng.chance(0.35)) {
      const shock = Moves.SPECIAL_BY_ID.shockPalm;
      if (f.meter >= shock.cost) { this.push({ special: shock }, 10); return; }
    }

    // Jump-in approach.
    if (d > 140 && d < 340 && rng.chance(p.jumpiness)) {
      this.push({ dir: toward, jump: true }, 18);
      this.push({ dir: toward, button: rng.chance(0.5) ? 'K' : 'P1' }, 14);
      return;
    }

    // Spacing: hold their preferred range, don't just run in mindlessly.
    if (d > p.spacing + 30) {
      if (d > 260 && rng.chance(0.35)) this.push({ dashDir: toward }, 14);
      else this.push({ dir: toward }, 14 + rng.int(0, 16));
    } else if (d < p.spacing - 30 && rng.chance(0.5)) {
      this.push({ dir: away }, 12 + rng.int(0, 14));
    } else {
      // Feint / breathe — gives the player an opening, which is the point.
      if (rng.chance(0.35)) this.push({ dir: 0, crouch: rng.chance(0.3) }, 10 + rng.int(0, 18));
      else this.pushCombo(opp, rng);
    }
  };

  /* A short string of normals with a stance mix-up, like a human would throw. */
  AI.prototype.pushCombo = function (opp, rng) {
    const p = this.p;
    const len = 1 + rng.int(1, Math.max(1, p.comboLen));
    for (let i = 0; i < len; i++) {
      const last = i === len - 1;
      let button = 'P1';
      const r = rng();
      if (last) button = r < 0.45 ? 'K' : r < 0.8 ? 'P2' : 'P1';
      else button = r < 0.55 ? 'P1' : r < 0.85 ? 'P2' : 'K';
      const lowMix = p.mixup ? rng.chance(0.42) : rng.chance(0.2);
      const gap = button === 'P1' ? 12 : button === 'P2' ? 20 : 28;
      this.push({ button, crouch: lowMix }, gap + rng.int(0, 6));
    }
    // Small breather after a string so the player gets their turn.
    this.push({ dir: 0 }, 8 + rng.int(0, 18));
  };

  root.ST = root.ST || {};
  root.ST.AI = AI;
})(window);
