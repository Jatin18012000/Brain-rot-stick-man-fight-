/* Stickman Tower — rendering: skeletal stickmen, tiered arenas, FX, fight HUD.
 * Everything is drawn procedurally; there are no image assets to download.
 */
(function (root) {
  'use strict';

  const U = root.ST.U;

  const W = 960, H = 540;              // logical resolution (letterboxed to fit)
  const GROUND_Y = 470;

  // Stickman proportions, in local units (multiplied by fighter.scale).
  const P = {
    pelvis: 52, neck: 86, headY: 100, headR: 11,
    thigh: 28, shin: 26, upperArm: 24, foreArm: 22, shoulderW: 9, hipW: 7,
  };

  const R = { W, H, GROUND_Y };

  // ------------------------------------------------------------------ math
  function dirVec(angleDeg, facing) {
    const a = U.rad(angleDeg);
    return { x: Math.sin(a) * facing, y: Math.cos(a) };
  }

  function limb(ox, oy, a1, l1, a2, l2, facing) {
    const d1 = dirVec(a1, facing);
    const j = { x: ox + d1.x * l1, y: oy + d1.y * l1 };
    const d2 = dirVec(a1 + a2, facing);
    const e = { x: j.x + d2.x * l2, y: j.y + d2.y * l2 };
    return { joint: j, end: e };
  }

  // ----------------------------------------------------------------- poses
  // A pose is: torso lean, hip drop, and [shoulder, elbow] / [hip, knee] pairs
  // for front + back limbs. Angles: 0 = straight down, 90 = straight forward.
  function basePose() {
    return {
      lean: 6, hip: 0, headTilt: 0, armLen: 1, legLen: 1,
      armF: [18, 26], armB: [-14, 30],
      legF: [10, 10], legB: [-12, 12],
      stretch: 1,
    };
  }

  function lerpPose(a, b, t) {
    const o = {};
    o.lean = U.lerp(a.lean, b.lean, t);
    o.bounce = U.lerp(a.bounce || 0, b.bounce || 0, t);
    o.armLen = U.lerp(a.armLen === undefined ? 1 : a.armLen, b.armLen === undefined ? 1 : b.armLen, t);
    o.legLen = U.lerp(a.legLen === undefined ? 1 : a.legLen, b.legLen === undefined ? 1 : b.legLen, t);
    o.hip = U.lerp(a.hip, b.hip, t);
    o.headTilt = U.lerp(a.headTilt, b.headTilt, t);
    o.stretch = U.lerp(a.stretch === undefined ? 1 : a.stretch, b.stretch === undefined ? 1 : b.stretch, t);
    ['armF', 'armB', 'legF', 'legB'].forEach((k) => {
      o[k] = [U.lerp(a[k][0], b[k][0], t), U.lerp(a[k][1], b[k][1], t)];
    });
    return o;
  }

  function pose(mods) { return Object.assign(basePose(), mods); }

  const POSE = {
    idle: pose({}),
    idle2: pose({ lean: 8, armF: [22, 28], armB: [-10, 34], legF: [8, 12], legB: [-10, 14] }),
    guardUp: pose({ lean: 10, armF: [70, 95], armB: [55, 100], legF: [14, 16], legB: [-18, 18] }),
    guardLow: pose({ lean: 16, hip: 26, armF: [62, 90], armB: [50, 96], legF: [40, 78], legB: [-30, 70] }),
    crouch: pose({ lean: 18, hip: 28, armF: [30, 50], armB: [-8, 46], legF: [42, 80], legB: [-32, 72] }),
    jump: pose({ lean: 4, armF: [-40, 20], armB: [-60, 24], legF: [46, 58], legB: [-26, 40] }),
    fall: pose({ lean: 10, armF: [-70, 14], armB: [-84, 18], legF: [30, 30], legB: [-16, 28] }),
    land: pose({ lean: 14, hip: 16, armF: [40, 40], armB: [-20, 40], legF: [30, 52], legB: [-24, 50] }),

    jabWind: pose({ lean: 4, armF: [42, 78], armB: [-20, 40] }),
    jabHit: pose({ lean: 12, armF: [90, 2], armB: [-30, 56], legF: [16, 14], legB: [-16, 14] }),
    crossWind: pose({ lean: -6, armF: [20, 60], armB: [-46, 84] }),
    crossHit: pose({ lean: 18, armF: [-24, 48], armB: [92, 4], legF: [22, 12], legB: [-20, 20] }),
    kickWind: pose({ lean: -10, armF: [-10, 50], armB: [-40, 60], legF: [44, 92], legB: [-8, 10] }),
    kickHit: pose({ lean: 22, armF: [-40, 40], armB: [-70, 44], legF: [92, 4], legB: [-6, 8] }),
    lowJabHit: pose({ lean: 20, hip: 24, armF: [78, 6], armB: [10, 50], legF: [42, 78], legB: [-30, 70] }),
    bodyWind: pose({ lean: 10, hip: 26, armF: [10, 60], armB: [-30, 70], legF: [42, 78], legB: [-30, 70] }),
    bodyHit: pose({ lean: 2, hip: 18, armF: [-10, 40], armB: [62, 10], legF: [36, 64], legB: [-26, 60] }),
    sweepWind: pose({ lean: 24, hip: 34, armF: [30, 60], armB: [-10, 60], legF: [50, 86], legB: [-34, 76] }),
    sweepHit: pose({ lean: 34, hip: 40, armF: [10, 70], armB: [-30, 70], legF: [104, 6], legB: [-40, 80] }),
    airPunchP: pose({ lean: 14, armF: [86, 8], armB: [-50, 36], legF: [36, 46], legB: [-20, 34] }),
    airKickP: pose({ lean: 20, armF: [-46, 30], armB: [-66, 34], legF: [96, 8], legB: [-16, 30] }),
    lungeHit: pose({ lean: 26, armF: [-30, 50], armB: [96, 2], legF: [46, 26], legB: [-34, 22] }),
    spinWind: pose({ lean: -16, armF: [-40, 60], armB: [40, 70], legF: [20, 40], legB: [-18, 30] }),
    spinHit: pose({ lean: 26, armF: [-60, 40], armB: [-20, 60], legF: [100, 10], legB: [-10, 14] }),

    hurt: pose({ lean: -18, armF: [-36, 40], armB: [-54, 44], legF: [-8, 18], legB: [16, 22] }),
    hurtLow: pose({ lean: -10, hip: 20, armF: [-20, 50], armB: [-40, 54], legF: [20, 60], legB: [-10, 50] }),
    airHurt: pose({ lean: -30, armF: [-80, 30], armB: [-96, 34], legF: [-30, 30], legB: [-50, 34] }),
    down: pose({ lean: -84, hip: 46, armF: [-100, 20], armB: [-110, 24], legF: [-86, 20], legB: [-96, 24] }),
    stunned: pose({ lean: 2, armF: [-20, 80], armB: [20, 80], legF: [16, 24], legB: [-16, 26] }),
    win: pose({ lean: 0, armF: [-150, 20], armB: [-40, 40], legF: [12, 10], legB: [-14, 12] }),
    ready: pose({ lean: 8, armF: [46, 70], armB: [26, 76], legF: [18, 18], legB: [-20, 20] }),
  };

  /* Resolve the pose for a fighter this frame. Attacks interpolate through
   * windup -> strike -> recover using real frame data so the visuals and the
   * hitboxes always agree. */
  /* A character's idle is their own stance, taken straight from the sheet, not
   * the engine default with an offset. Everything else — attacks, hurt, walk —
   * departs from and returns to it. */
  function characterIdle(f) {
    const base = basePose();
    const st = f.character && f.character.stance;
    if (!st) return base;
    if (st.pose) {
      base.armF = st.pose.armF.slice();
      base.armB = st.pose.armB.slice();
      base.legF = st.pose.legF.slice();
      base.legB = st.pose.legB.slice();
    }
    if (st.lean !== undefined) base.lean = st.lean;
    if (st.armLen !== undefined) base.armLen = st.armLen;
    if (st.legLen !== undefined) base.legLen = st.legLen;
    return base;
  }

  function poseFor(f, t) {
    return basePoseFor(f, t);
  }

  /* Resolve the animation pose before character stance is layered on. */
  function basePoseFor(f, t) {
    const anim = f.anim;
    const walkPhase = (t * 8) % (Math.PI * 2);

    switch (anim) {
      case 'idle': {
        if (!f.character || !f.character.stance || !f.character.stance.pose) {
          const b = (Math.sin(t * 3.2) + 1) / 2;
          return lerpPose(POSE.idle, POSE.idle2, b);
        }
        const cfg = f.character.stance.idle || { amp: 1.6, hz: 1.6, hold: 0 };
        let phase = Math.sin(t * cfg.hz * Math.PI * 2);
        if (cfg.hold) {
          // Flatten the peaks so the pose lingers at the top of the breath.
          const k = 1 + cfg.hold * 4;
          phase = Math.tanh(phase * k) / Math.tanh(k);
        }
        const o = characterIdle(f);
        o.bounce = (0.5 + 0.5 * phase) * cfg.amp;
        o.armF[0] += phase * 1.6;
        o.armB[0] -= phase * 1.6;
        o.lean += phase * 0.8;
        return o;
      }
      case 'walk': case 'walkBack': {
        const idle = characterIdle(f);
        const wcfg = (f.character && f.character.stance && f.character.stance.walk) || { stride: 12 };
        const k = wcfg.stride / 12;
        // Longer strides mean a slower cadence, which is most of the read.
        const ph = t * 8 / k;
        const sn = Math.sin(ph), cs = Math.cos(ph);
        if (!f.character || !f.character.stance || !f.character.stance.pose) {
          return pose({
            lean: anim === 'walk' ? 10 : 4,
            armF: [18 - sn * 26, 26 + Math.abs(sn) * 10],
            armB: [-14 + sn * 26, 30 + Math.abs(sn) * 10],
            legF: [10 + sn * 32, 10 + Math.max(0, cs) * 26],
            legB: [-12 - sn * 32, 12 + Math.max(0, -cs) * 26],
          });
        }
        const o = characterIdle(f);
        o.legF = [idle.legF[0] + sn * 28 * k, idle.legF[1] + Math.max(0, cs) * 22 * k];
        o.legB = [idle.legB[0] - sn * 28 * k, idle.legB[1] + Math.max(0, -cs) * 22 * k];
        o.armF = [idle.armF[0] - sn * 14, idle.armF[1]];
        o.armB = [idle.armB[0] + sn * 14, idle.armB[1]];
        o.bounce = Math.abs(sn) * 1.2;
        return o;
      }
      case 'dash': return lerpPose(POSE.idle, POSE.land, 0.5);
      case 'crouch': return POSE.crouch;
      case 'block': return POSE.guardUp;
      case 'blockLow': return POSE.guardLow;
      case 'jump': return f.vy < 0 ? POSE.jump : POSE.fall;
      case 'land': return lerpPose(POSE.land, POSE.idle, U.clamp(f.animT * 6, 0, 1));
      case 'wakeup': return lerpPose(POSE.down, POSE.idle, U.clamp(f.animT * 5, 0, 1));
      case 'hurt': return lerpPose(POSE.hurt, POSE.idle, U.clamp(f.animT * 3.5, 0, 1));
      case 'hurtLow': return lerpPose(POSE.hurtLow, POSE.crouch, U.clamp(f.animT * 3.5, 0, 1));
      case 'airHurt': return POSE.airHurt;
      case 'down': return POSE.down;
      case 'ko': return lerpPose(POSE.airHurt, POSE.down, U.clamp(f.animT * 2.2, 0, 1));
      case 'stunned': {
        const w = Math.sin(t * 9) * 0.5 + 0.5;
        return lerpPose(POSE.stunned, POSE.hurt, w * 0.4);
      }
      case 'win': {
        const b = (Math.sin(t * 4) + 1) / 2;
        return lerpPose(POSE.win, POSE.idle2, b * 0.35);
      }
      case 'intro': return lerpPose(POSE.ready, POSE.idle, (Math.sin(t * 5) + 1) / 2 * 0.5);
      default: break;
    }

    // ---- attack animations, driven by the move's own frame data
    if (f.state === 'attack' && f.move) {
      const m = f.move;
      const fr = f.frame;
      const key = attackPoses(m.id, f);
      let out, hitness;
      if (fr < m.startup) {
        const k = U.easeOut(fr / Math.max(1, m.startup));
        out = lerpPose(key.idle, key.wind, k);
        hitness = k * 0.3;
      } else if (fr < m.startup + m.active) {
        const k = U.easeOut((fr - m.startup) / Math.max(1, m.active));
        out = lerpPose(key.wind, key.hit, k);
        hitness = 0.3 + k * 0.7;
      } else {
        const rt = U.ease(U.clamp((fr - m.startup - m.active) / Math.max(1, m.recovery), 0, 1));
        out = lerpPose(key.hit, key.idle, rt);
        hitness = 1 - rt;
      }
      return applyStrike(f, out, m, hitness);
    }

    if (f.state === 'special' && f.special) {
      const sp = f.special;
      const prog = U.clamp(f.frame / Math.max(1, sp.duration), 0, 1);
      // peak near the middle of the routine, settle at the end
      const hitness = prog < 0.7 ? U.clamp(prog / 0.4, 0, 1) : U.clamp((1 - prog) / 0.3, 0, 1);
      return applyStrike(f, specialPose(f), null, hitness);
    }

    return POSE.idle;
  }

  /* How a fighter throws, as opposed to how they stand. RAZA drives her whole
   * body in behind a compact strike; VANE stays upright and reaches. Cheap
   * modifiers on the shared attack poses, which is enough to read at a glance. */
  const ARM_MOVES = ['jab', 'cross', 'lowJab', 'bodyBlow', 'airPunch', 'airCross', 'lunge'];

  function applyStrike(f, p, move, hitness) {
    const st = f.character && f.character.strikes;
    if (!st) return p;
    const usesArm = !move || ARM_MOVES.indexOf(move.id) !== -1;
    p.lean += (st.leanOnHit || 0) * hitness;
    if (usesArm) {
      if (st.armLen) p.armLen = (p.armLen === undefined ? 1 : p.armLen) * U.lerp(1, st.armLen, hitness);
      p.armF[0] += (st.extend || 0) * hitness;
    } else {
      if (st.legLen) p.legLen = (p.legLen === undefined ? 1 : p.legLen) * U.lerp(1, st.legLen, hitness);
      p.legF[0] += (st.extend || 0) * hitness;
    }
    return p;
  }

  function attackPoses(id, f) {
    const neutral = f && f.character && f.character.stance && f.character.stance.pose
      ? characterIdle(f) : POSE.idle;
    switch (id) {
      case 'jab': return { idle: neutral, wind: POSE.jabWind, hit: POSE.jabHit };
      case 'cross': return { idle: neutral, wind: POSE.crossWind, hit: POSE.crossHit };
      case 'kick': return { idle: neutral, wind: POSE.kickWind, hit: POSE.kickHit };
      case 'lowJab': return { idle: POSE.crouch, wind: POSE.crouch, hit: POSE.lowJabHit };
      case 'bodyBlow': return { idle: POSE.crouch, wind: POSE.bodyWind, hit: POSE.bodyHit };
      case 'sweep': return { idle: POSE.crouch, wind: POSE.sweepWind, hit: POSE.sweepHit };
      case 'airPunch': return { idle: POSE.fall, wind: POSE.jabWind, hit: POSE.airPunchP };
      case 'airCross': return { idle: POSE.fall, wind: POSE.crossWind, hit: POSE.airPunchP };
      case 'airKick': return { idle: POSE.fall, wind: POSE.kickWind, hit: POSE.airKickP };
      case 'lunge': return { idle: neutral, wind: POSE.crossWind, hit: POSE.lungeHit };
      case 'spinKick': return { idle: neutral, wind: POSE.spinWind, hit: POSE.spinHit };
      default: return { idle: neutral, wind: POSE.jabWind, hit: POSE.jabHit };
    }
  }

  /* Specials cycle through strike poses timed to their scripted hits. */
  function specialPose(f) {
    const sp = f.special;
    const fr = f.frame;
    const hits = sp.hits || [];
    const clone = (q) => lerpPose(q, q, 0);
    if (!hits.length) {
      // Projectile specials: crouch, charge, thrust.
      const t = fr / sp.duration;
      if (t < 0.3) return lerpPose(POSE.crouch, POSE.bodyWind, t / 0.3);
      if (t < 0.5) return lerpPose(POSE.bodyWind, POSE.lungeHit, (t - 0.3) / 0.2);
      return lerpPose(POSE.lungeHit, POSE.idle, (t - 0.5) / 0.5);
    }
    let prev = null, next = hits[0];
    for (let i = 0; i < hits.length; i++) {
      if (hits[i].f <= fr) { prev = hits[i]; next = hits[i + 1] || null; }
    }
    const poseOfHit = (h, i) => {
      const isKick = (h.box.y < 50) || (h.guard === 'low');
      const isOver = h.guard === 'overhead';
      if (isOver) return POSE.airKickP;
      if (h.knockdown && isKick) return POSE.sweepHit;
      if (isKick) return POSE.kickHit;
      return i % 2 === 0 ? POSE.jabHit : POSE.crossHit;
    };
    if (!prev) {
      const t = U.clamp(fr / Math.max(1, next.f), 0, 1);
      return lerpPose(characterIdle(f), POSE.jabWind, t);
    }
    const idx = hits.indexOf(prev);
    const cur = clone(poseOfHit(prev, idx));
    if (next) {
      const t = U.clamp((fr - prev.f) / Math.max(1, next.f - prev.f), 0, 1);
      const mid = idx % 2 === 0 ? POSE.crossWind : POSE.jabWind;
      return t < 0.5 ? lerpPose(cur, mid, t * 2) : lerpPose(mid, poseOfHit(next, idx + 1), (t - 0.5) * 2);
    }
    const t = U.clamp((fr - prev.f) / Math.max(1, sp.duration - prev.f), 0, 1);
    return lerpPose(cur, characterIdle(f), U.ease(t));
  }

  // ------------------------------------------------------------- fx system
  const fx = [];

  function addFx(o) { fx.push(o); if (fx.length > 400) fx.shift(); }

  const FX = {
    spark(x, y, count, color, power) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (0.5 + Math.random()) * (power || 200);
        addFx({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0.32 + Math.random() * 0.25, max: 0.5, color: color || '#fff3b0', size: 2 + Math.random() * 2.5 });
      }
    },
    ring(x, y, color, r0, r1, life) {
      addFx({ type: 'ring', x, y, r: r0 || 6, r1: r1 || 70, life: life || 0.3, max: life || 0.3, color: color || '#ffffff' });
    },
    dust(x, y, dir) {
      for (let i = 0; i < 5; i++) {
        addFx({ type: 'dust', x, y, vx: dir * (30 + Math.random() * 90), vy: -Math.random() * 50, life: 0.4, max: 0.4, size: 3 + Math.random() * 5 });
      }
    },
    text(x, y, text, color, size) {
      addFx({ type: 'text', x, y, vy: -70, life: 0.85, max: 0.85, text, color: color || '#fff', size: size || 22 });
    },
    shock(x, y, color) {
      addFx({ type: 'shock', x, y, life: 0.4, max: 0.4, color: color || '#9ad0ff' });
    },
    trail(x, y, color, scale) {
      addFx({ type: 'trail', x, y, life: 0.22, max: 0.22, color: color || '#ffffff', scale: scale || 1 });
    },
    /* A frozen copy of the fighter, redrawn behind them. Used for Raza's
     * step-in, where the sheet asks for three ghosts at 40/25/12%. */
    afterimage(f, alpha, life) {
      addFx({
        type: 'ghost', life: life || 0.3, max: life || 0.3, alpha: alpha,
        snap: {
          x: f.x, y: f.y, facing: f.facing, scale: f.scale, character: f.character,
          colors: f.colors, anim: f.anim, animT: f.animT, state: f.state,
          frame: f.frame, move: f.move, special: f.special, vy: f.vy,
          isPlayer: f.isPlayer, gear: null, meter: 0, flash: 0, tonicFlash: 0,
          blocking: false, partFlash: 0, _att: null,
          hurtbox: () => ({ x: 0, y: 0, w: 0, h: 0 }), activeHits: () => [],
        },
      });
    },
    /* A wave that runs along the floor away from the fighter. */
    groundWave(x, y, dir, color, distance, seconds) {
      addFx({
        type: 'gwave', x, y, dir, color: color || '#8A5CFF',
        speed: (distance || 120) / (seconds || 0.17),
        life: seconds || 0.17, max: seconds || 0.17,
      });
    },
    /* Sparks thrown along one vector rather than in a ball. */
    shards(x, y, angleRad, count, color, spread, power) {
      for (let i = 0; i < count; i++) {
        const a = angleRad + (Math.random() - 0.5) * (spread === undefined ? 0.8 : spread);
        const sp = (0.6 + Math.random() * 0.8) * (power || 320);
        addFx({
          type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.22 + Math.random() * 0.18, max: 0.4,
          color: color || '#FFC93C', size: 2 + Math.random() * 2,
        });
      }
    },
    clear() { fx.length = 0; },
  };

  function updateFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const p = fx[i];
      p.life -= dt;
      if (p.life <= 0) { fx.splice(i, 1); continue; }
      if (p.vx !== undefined) p.x += p.vx * dt;
      if (p.vy !== undefined) { p.y += p.vy * dt; p.vy += (p.type === 'spark' ? 900 : 200) * dt; }
      if (p.type === 'ring') p.r = U.lerp(p.r, p.r1, 1 - Math.pow(p.life / p.max, 2));
      if (p.type === 'gwave') p.x += p.dir * p.speed * dt;
    }
  }

  function drawFx(ctx) {
    fx.forEach((p) => {
      const a = U.clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (p.type === 'dust') {
        ctx.fillStyle = 'rgba(200,200,210,0.5)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.4 - a), 0, 7); ctx.fill();
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 3 * a + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke();
      } else if (p.type === 'text') {
        ctx.fillStyle = p.color;
        ctx.font = '900 ' + (p.size * (0.8 + a * 0.4)) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillText(p.text, p.x, p.y);
      } else if (p.type === 'shock') {
        const r = (1 - a) * 120;
        ctx.strokeStyle = p.color; ctx.lineWidth = 6 * a;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.stroke();
        ctx.lineWidth = 2 * a;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.6, 0, 7); ctx.stroke();
      } else if (p.type === 'ghost') {
        ctx.globalAlpha = p.alpha * (p.life / p.max);
        drawFighter(ctx, p.snap, { noShadow: true, noAttach: true, dt: 0 });
        ctx.globalAlpha = 1;
      } else if (p.type === 'gwave') {
        const k = p.life / p.max;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = k;
        const hgt = 18 * k + 6;
        ctx.beginPath();
        ctx.moveTo(p.x - p.dir * 10, p.y);
        ctx.quadraticCurveTo(p.x, p.y - hgt, p.x + p.dir * 10, p.y);
        ctx.stroke();
        ctx.globalAlpha = k * 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x - p.dir * 20, p.y);
        ctx.quadraticCurveTo(p.x - p.dir * 6, p.y - hgt * 0.6, p.x + p.dir * 4, p.y);
        ctx.stroke();
      } else if (p.type === 'trail') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 2;
        ctx.globalAlpha = a * 0.35;
        ctx.beginPath(); ctx.arc(p.x, p.y - 50 * p.scale, 34 * p.scale, 0, 7); ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------- backgrounds
  const bgCache = {};

  function drawBackground(ctx, tier, t, shakeX) {
    const key = tier.name;
    if (!bgCache[key]) bgCache[key] = buildBg(tier);
    const bg = bgCache[key];

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, tier.sky[0]);
    g.addColorStop(1, tier.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(-100, -100, W + 200, H + 200);

    // far silhouettes (slow parallax)
    ctx.save();
    ctx.translate(shakeX * 0.25, 0);
    bg.far.forEach((s) => {
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.w, s.h);
    });
    ctx.restore();

    drawDeco(ctx, tier, t, bg);

    // ground
    ctx.fillStyle = tier.ground;
    ctx.fillRect(-100, GROUND_Y, W + 200, H - GROUND_Y + 100);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-100, GROUND_Y + 0.5); ctx.lineTo(W + 100, GROUND_Y + 0.5); ctx.stroke();

    // floor perspective lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 16; i++) {
      const x = (i / 16) * W;
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y);
      ctx.lineTo(W / 2 + (x - W / 2) * 2.4, H + 40);
      ctx.stroke();
    }

    // accent glow strip
    const gg = ctx.createLinearGradient(0, GROUND_Y - 40, 0, GROUND_Y);
    gg.addColorStop(0, 'rgba(0,0,0,0)');
    gg.addColorStop(1, hexA(tier.accent, 0.16));
    ctx.fillStyle = gg;
    ctx.fillRect(-100, GROUND_Y - 40, W + 200, 40);
  }

  function buildBg(tier) {
    const rng = U.rng(tier.name.length * 977 + tier.name.charCodeAt(0) * 31);
    const far = [];
    for (let i = 0; i < 22; i++) {
      const w = rng.range(30, 90);
      const h = rng.range(60, 260);
      far.push({ x: rng.range(-40, W), y: GROUND_Y - h, w, h, color: 'rgba(255,255,255,' + rng.range(0.015, 0.05).toFixed(3) + ')' });
    }
    const motes = [];
    for (let i = 0; i < 46; i++) {
      motes.push({ x: rng.range(0, W), y: rng.range(0, GROUND_Y), s: rng.range(0.6, 2.6), sp: rng.range(6, 34), ph: rng.range(0, 7) });
    }
    return { far, motes, rng };
  }

  function drawDeco(ctx, tier, t, bg) {
    const acc = tier.accent;
    switch (tier.deco) {
      case 'dojo':
        for (let i = 0; i < 5; i++) {
          const x = 70 + i * 210;
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(x, 120, 26, GROUND_Y - 120);
          ctx.fillStyle = hexA(acc, 0.10);
          ctx.fillRect(x - 6, 112, 38, 12);
        }
        ctx.fillStyle = hexA(acc, 0.07);
        ctx.beginPath(); ctx.arc(W / 2, 180, 90, 0, 7); ctx.fill();
        break;
      case 'market':
        for (let i = 0; i < 7; i++) {
          const x = 40 + i * 140;
          ctx.fillStyle = hexA(acc, 0.09);
          ctx.beginPath();
          ctx.moveTo(x, 200); ctx.lineTo(x + 120, 200); ctx.lineTo(x + 100, 240); ctx.lineTo(x + 20, 240);
          ctx.closePath(); ctx.fill();
        }
        break;
      case 'neon': {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
        for (let i = 0; i < 6; i++) {
          const x = 60 + i * 160, y = 120 + (i % 3) * 70;
          ctx.strokeStyle = hexA(acc, 0.22 + 0.2 * ((pulse + i * 0.2) % 1));
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, 90, 40);
        }
        break;
      }
      case 'roof':
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        for (let i = 0; i < 9; i++) ctx.fillRect(i * 120, GROUND_Y - 70 - (i % 4) * 40, 90, 200);
        break;
      case 'ice':
        for (let i = 0; i < 12; i++) {
          const x = (i * 97) % W;
          ctx.fillStyle = hexA(acc, 0.08);
          ctx.beginPath();
          ctx.moveTo(x, 0); ctx.lineTo(x + 26, 0); ctx.lineTo(x + 13, 90 + (i % 5) * 40);
          ctx.closePath(); ctx.fill();
        }
        break;
      case 'fire': {
        const fl = 0.5 + 0.5 * Math.sin(t * 6);
        ctx.fillStyle = hexA(acc, 0.10 + fl * 0.08);
        ctx.beginPath(); ctx.arc(W / 2, GROUND_Y, 260, Math.PI, 0); ctx.fill();
        break;
      }
      case 'garden':
        for (let i = 0; i < 8; i++) {
          const x = 50 + i * 125;
          ctx.fillStyle = hexA(acc, 0.10);
          ctx.beginPath(); ctx.arc(x, 150 + (i % 3) * 50, 34, 0, 7); ctx.fill();
          ctx.fillRect(x - 3, 150, 6, GROUND_Y - 150);
        }
        break;
      case 'lab':
        ctx.strokeStyle = hexA(acc, 0.14);
        ctx.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
          ctx.beginPath();
          ctx.arc(W / 2, GROUND_Y - 100, 40 + i * 34, Math.PI * 0.9 + Math.sin(t * 0.4 + i) * 0.1, Math.PI * 2.1);
          ctx.stroke();
        }
        break;
      case 'arena':
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let r = 0; r < 4; r++) ctx.fillRect(0, 150 + r * 46, W, 30);
        ctx.fillStyle = hexA(acc, 0.10);
        for (let i = 0; i < 40; i++) ctx.fillRect((i * 47 + (i % 3) * 11) % W, 152 + (i % 4) * 46, 10, 24);
        break;
      case 'spire': {
        const sh = 0.5 + 0.5 * Math.sin(t * 1.2);
        ctx.fillStyle = hexA(acc, 0.06 + sh * 0.05);
        ctx.beginPath(); ctx.arc(W / 2, 210, 150 + sh * 14, 0, 7); ctx.fill();
        ctx.strokeStyle = hexA(acc, 0.2);
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const a = t * 0.3 + (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(W / 2, 210, 190, 46, a, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      default: break;
    }

    // ambient motes / snow / embers
    ctx.fillStyle = hexA(acc, 0.35);
    bg.motes.forEach((m) => {
      const y = (m.y + t * m.sp) % GROUND_Y;
      const x = m.x + Math.sin(t * 0.7 + m.ph) * 18;
      ctx.globalAlpha = 0.10 + 0.18 * (0.5 + 0.5 * Math.sin(t * 2 + m.ph));
      ctx.fillRect(x, y, m.s, m.s);
    });
    ctx.globalAlpha = 1;
  }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  R.hexA = hexA;

  // ---------------------------------------------------------- attachments
  /* The soft parts — tails, sashes, coat tails, braids — are verlet ropes hung
   * off the skeleton joints the renderer already computes. They are what stop a
   * character reading as a plain stick figure: the body stops, the hair does
   * not, and the eye reads weight and speed from the lag.
   *
   * Rest angles use the character sheet's convention: degrees, 0 = forward,
   * counter-clockwise, y up. Canvas y is down, hence the negated sine. */
  function restVec(cfg, facing) {
    if (cfg.angle !== undefined && typeof cfg.angle === 'number' && cfg.type === 'chain') {
      const a = U.rad(cfg.angle);
      return { x: Math.cos(a) * facing, y: -Math.sin(a) };
    }
    const r = cfg.rest || [-1, 0];
    return { x: r[0] * facing, y: r[1] };
  }

  function partLength(cfg, band) {
    const mul = cfg.lenByTier ? cfg.lenByTier[root.ST.Characters.BAND_INDEX[band]] : 1;
    return cfg.length * mul;
  }

  function chainState(f, cfg, anchor, s, facing, length) {
    if (!f._att) f._att = {};
    let st = f._att[cfg.id];
    const count = (cfg.segments || 4) + 1;
    if (!st || st.pts.length !== count) {
      const d = restVec(cfg, facing);
      const segLen = (length / (count - 1)) * s;
      const pts = [];
      for (let i = 0; i < count; i++) {
        const x = anchor.x + d.x * segLen * i;
        const y = anchor.y + d.y * segLen * i;
        pts.push({ x, y, px: x, py: y });
      }
      st = { pts };
      f._att[cfg.id] = st;
    }
    return st;
  }

  function stepChain(st, anchor, cfg, s, facing, h, length) {
    const pts = st.pts;
    const segLen = (length / (pts.length - 1)) * s;
    pts[0].x = anchor.x; pts[0].y = anchor.y;
    pts[0].px = anchor.x; pts[0].py = anchor.y;

    const damp = cfg.damp === undefined ? 0.92 : cfg.damp;
    const g = (cfg.gravity === undefined ? 1500 : cfg.gravity) * s;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * damp;
      const vy = (p.y - p.py) * damp;
      p.px = p.x; p.py = p.y;
      p.x += vx;
      p.y += vy + g * h * h;
    }

    // Pull back toward the rest direction, so a swept tail holds its shape.
    const k = cfg.stiffness || 0;
    if (k > 0) {
      const d = restVec(cfg, facing);
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1], p = pts[i];
        p.x += (prev.x + d.x * segLen - p.x) * k * 0.5;
        p.y += (prev.y + d.y * segLen - p.y) * k * 0.5;
      }
    }

    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const diff = (d - segLen) / d;
        b.x -= dx * diff;
        b.y -= dy * diff;
      }
    }
  }

  function drawChain(ctx, st, cfg, s, color) {
    const pts = st.pts;
    const w0 = (cfg.width || 5) * s;
    const taper = cfg.taper === undefined ? 0.35 : cfg.taper;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    for (let i = 1; i < pts.length; i++) {
      const t = (i - 1) / (pts.length - 1);
      ctx.lineWidth = w0 * U.lerp(1, taper, t);
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
  }

  function drawRigid(ctx, cfg, joint, limbAngle, s, facing, color, band) {
    const off = cfg.origin || cfg.offset || [0, 0];
    const cx = joint.x + off[0] * facing * s;
    const cy = joint.y - off[1] * s;          // origin y is measured up, like the sheet

    if (cfg.shape === 'ring') {
      const r = (cfg.radiusByTier ? cfg.radiusByTier[root.ST.Characters.BAND_INDEX[band]] : cfg.radius) * s;
      ctx.strokeStyle = color;
      ctx.lineWidth = (cfg.stroke || 1.6) * s;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
      return;
    }

    const a = cfg.angle === 'limb' ? limbAngle : (cfg.angle || 0);
    if (cfg.shape === 'arc') {
      // A 180-degree cap opening downward, rigid to its joint.
      ctx.strokeStyle = color;
      ctx.lineWidth = (cfg.stroke || 4) * s;
      ctx.lineCap = 'butt';
      const span = U.rad(cfg.span || 180);
      const mid = -Math.PI / 2 + U.rad(cfg.angle || 0) * facing;
      ctx.beginPath();
      ctx.arc(cx, cy, (cfg.radius || 7) * s, mid - span / 2, mid + span / 2);
      ctx.stroke();
      ctx.lineCap = 'round';
      return;
    }

    const d = cfg.angle === 'limb' ? dirVec(a, facing) : dirVec(a, facing);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(d.y, d.x));
    ctx.fillStyle = color;
    const w = (cfg.size ? cfg.size[0] : 10) * s;
    const h = (cfg.size ? cfg.size[1] : 6) * s;
    if (cfg.shape === 'wedge' || cfg.shape === 'tri') {
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, -h / 2);
      ctx.lineTo(w * 0.7, 0);
      ctx.lineTo(-w * 0.3, h / 2);
      ctx.closePath();
      ctx.fill();
    } else if (cfg.shape === 'disc') {
      ctx.beginPath(); ctx.arc(0, 0, w / 2, 0, 7); ctx.fill();
    } else if (cfg.shape === 'capsule') {
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = h;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + h / 2, 0);
      ctx.lineTo(w / 2 - h / 2, 0);
      ctx.stroke();
    } else {
      ctx.beginPath();
      const r = Math.min(w, h) * 0.35;
      ctx.moveTo(-w / 2 + r, -h / 2);
      ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
      ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
      ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
      ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function attachColor(f, name, flashing) {
    const c = (f.character && f.character.colors) || f.colors;
    if (flashing && c.aura) return c.aura;
    if (name === 'body') return c.body || f.colors.body;
    if (name === 'accent') return c.accent || f.colors.accent;
    if (name === 'trim') return c.trim || shade(c.accent || f.colors.accent, 0.5);
    if (name === 'aura') return c.aura || c.accent || f.colors.accent;
    if (name === 'back') return f._backColor || c.back || shade(c.body, -0.35);
    return name || f.colors.accent;
  }

  /* Step every rope once per frame (on the back pass), then draw one layer. */
  function attachments(ctx, f, joints, angles, s, facing, h, layer, band) {
    const ch = f.character;
    if (!ch) return;
    const list = root.ST.Characters.partsFor(ch, band);
    if (!list.length) return;
    const flashing = f.partFlash > 0;
    list.forEach((cfg) => {
      const joint = joints[cfg.joint];
      if (!joint) return;
      const isFront = cfg.layer ? cfg.layer === 'front' : cfg.type === 'shape';
      if (cfg.type === 'chain') {
        const length = partLength(cfg, band);
        const origin = cfg.origin
          ? { x: joint.x + cfg.origin[0] * facing * s, y: joint.y - cfg.origin[1] * s }
          : joint;
        const st = chainState(f, cfg, origin, s, facing, length);
        if (layer === 'back') stepChain(st, origin, cfg, s, facing, h, length);
        if ((layer === 'front') === isFront) {
          drawChain(ctx, st, cfg, s, attachColor(f, cfg.color, flashing && cfg.flashOn === 'hit'));
        }
      } else if ((layer === 'front') === isFront) {
        drawRigid(ctx, cfg, joint, angles[cfg.joint] || 0, s, facing,
          attachColor(f, cfg.color, flashing && cfg.flashOn === 'hit'), band);
      }
    });
  }


  // -------------------------------------------------------- fighter render
  /* Every fighter is drawn from the same skeleton, but the bone lengths, stroke
   * weights and head radius come from the character's build block, so RAZA and
   * VANE are genuinely different bodies rather than recoloured copies. */
  function drawFighter(ctx, f, opts) {
    const o = opts || {};
    const s = f.scale;
    const p = poseFor(f, f.animT + (f.isPlayer ? 0 : 0.7));
    const facing = f.facing;
    const x = f.x;
    const y = f.y;
    const ch = f.character;
    const B = (ch && ch.build && ch.build.limbs) || P;
    const band = o.band || 'mid';

    // Joint heights follow the bones: shorter legs means a lower pelvis, or the
    // feet would not reach the floor.
    const pelvisH = (B.thigh + B.shin) * 0.963;
    const neckH = pelvisH + (B.torso || 34);
    const headH = neckH + 14;
    const headR = B.headR * s;
    const lw = (B.limbW || 7) * s;
    const torsoW = (B.torsoW || lw * 1.15) * s;

    const hipDrop = (p.hip + (p.bounce || 0)) * s;
    const pelvis = { x: x + Math.sin(U.rad(p.lean)) * 4 * facing, y: y - pelvisH * s + hipDrop };
    const leanV = dirVec(180 + p.lean, facing);
    const torsoLen = (neckH - pelvisH) * s;
    const neck = { x: pelvis.x + leanV.x * torsoLen, y: pelvis.y + leanV.y * torsoLen };
    const headC = {
      x: neck.x + leanV.x * (headH - neckH + B.headR * 0.4) * s,
      y: neck.y + leanV.y * (headH - neckH + B.headR * 0.4) * s,
    };

    const shoulderF = { x: neck.x + facing * B.shoulderW * 0.35 * s, y: neck.y + 2 * s };
    const shoulderB = { x: neck.x - facing * B.shoulderW * 0.35 * s, y: neck.y + 3 * s };
    const hipF = { x: pelvis.x + facing * B.hipW * 0.3 * s, y: pelvis.y };
    const hipB = { x: pelvis.x - facing * B.hipW * 0.3 * s, y: pelvis.y };

    // A guard held close to the body is foreshortened in profile; the sheets
    // draw it that way, so poses can shorten the bones without changing them.
    const al = (p.armLen === undefined ? 1 : p.armLen) * s;
    const ll = (p.legLen === undefined ? 1 : p.legLen) * s;
    const armF = limb(shoulderF.x, shoulderF.y, p.armF[0], B.upperArm * al, p.armF[1], B.foreArm * al, facing);
    const armB = limb(shoulderB.x, shoulderB.y, p.armB[0], B.upperArm * al, p.armB[1], B.foreArm * al, facing);
    const legF = limb(hipF.x, hipF.y, p.legF[0], B.thigh * ll, p.legF[1], B.shin * ll, facing);
    const legB = limb(hipB.x, hipB.y, p.legB[0], B.thigh * ll, p.legB[1], B.shin * ll, facing);

    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const joints = {
      head: headC, neck: neck, pelvis: pelvis,
      shoulderF: shoulderF, shoulderB: shoulderB,
      elbowF: armF.joint, elbowB: armB.joint,
      handF: armF.end, handB: armB.end,
      upperArmF: mid(shoulderF, armF.joint), upperArmB: mid(shoulderB, armB.joint),
      foreArmF: mid(armF.joint, armF.end), foreArmB: mid(armB.joint, armB.end),
      hipF: hipF, hipB: hipB,
      kneeF: legF.joint, kneeB: legB.joint,
      footF: legF.end, footB: legB.end,
      thighF: mid(hipF, legF.joint), thighB: mid(hipB, legB.joint),
      shinF: mid(legF.joint, legF.end), shinB: mid(legB.joint, legB.end),
    };
    const angles = {
      head: p.lean, neck: p.lean, pelvis: 180 + p.lean,
      shoulderF: p.armF[0], shoulderB: p.armB[0],
      upperArmF: p.armF[0], upperArmB: p.armB[0],
      elbowF: p.armF[0] + p.armF[1], elbowB: p.armB[0] + p.armB[1],
      foreArmF: p.armF[0] + p.armF[1], foreArmB: p.armB[0] + p.armB[1],
      handF: p.armF[0] + p.armF[1], handB: p.armB[0] + p.armB[1],
      hipF: p.legF[0], hipB: p.legB[0],
      thighF: p.legF[0], thighB: p.legB[0],
      kneeF: p.legF[0] + p.legF[1], kneeB: p.legB[0] + p.legB[1],
      shinF: p.legF[0] + p.legF[1], shinB: p.legB[0] + p.legB[1],
      footF: p.legF[0] + p.legF[1], footB: p.legB[0] + p.legB[1],
    };
    const h = Math.min(o.dt === undefined ? 1 / 60 : o.dt, 1 / 30);

    const gear = f.gear || {};
    const bodyColor = f.flash > 0 ? '#ffffff' : (ch ? ch.colors.body : f.colors.body);
    const backColor = f.flash > 0 ? '#ffffff' : attachColor(f, 'back');

    ctx.save();

    // aura marks a warden; a character's aura colour is for FX only
    if (f.auraColor) {
      const pulse = 0.5 + 0.5 * Math.sin(f.animT * 4);
      ctx.globalAlpha = 0.16 + pulse * 0.12;
      ctx.fillStyle = f.auraColor;
      ctx.beginPath(); ctx.ellipse(x, y - 56 * s, 44 * s, 66 * s, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (f.meter >= 100) {
      const pulse = 0.5 + 0.5 * Math.sin(f.animT * 9);
      ctx.globalAlpha = 0.10 + pulse * 0.14;
      ctx.fillStyle = ch ? ch.colors.aura : '#ffd166';
      ctx.beginPath(); ctx.ellipse(x, y - 56 * s, 40 * s, 64 * s, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (f.tonicFlash > 0) {
      ctx.globalAlpha = f.tonicFlash * 0.5;
      ctx.fillStyle = '#7ee787';
      ctx.beginPath(); ctx.ellipse(x, y - 56 * s, 42 * s, 66 * s, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // shadow (skipped for character-select cards, which have no floor)
    if (!o.noShadow) {
      ctx.globalAlpha = U.clamp(1 - (GROUND_Y - y) / 260, 0.15, 0.5);
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(x, GROUND_Y + 2, 26 * s, 6 * s, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (!o.noAttach) attachments(ctx, f, joints, angles, s, facing, h, 'back', band);

    // back limbs read as depth
    stroke(ctx, [shoulderB, armB.joint, armB.end], lw * 0.9, backColor);
    stroke(ctx, [hipB, legB.joint, legB.end], lw, backColor);
    if (gear.boots) drawBoot(ctx, legB.end, p.legB[0] + p.legB[1], s, facing, gear.bootTier, backColor);

    // torso + armour
    if (gear.armor) {
      ctx.strokeStyle = gear.armorColor || f.colors.accent;
      ctx.lineWidth = torsoW * 1.9;
      ctx.beginPath(); ctx.moveTo(pelvis.x, pelvis.y); ctx.lineTo(neck.x, neck.y); ctx.stroke();
      ctx.strokeStyle = shade(gear.armorColor || f.colors.accent, -0.3);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pelvis.x, pelvis.y); ctx.lineTo(neck.x, neck.y); ctx.stroke();
    }
    stroke(ctx, [pelvis, neck], torsoW, bodyColor);

    if (!o.noAttach) attachments(ctx, f, joints, angles, s, facing, h, 'front', band);

    // head
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.arc(headC.x, headC.y, headR, 0, 7); ctx.fill();
    if (gear.head) {
      ctx.fillStyle = gear.headColor || f.colors.accent;
      ctx.beginPath();
      ctx.arc(headC.x, headC.y, headR * 1.06, Math.PI * (facing > 0 ? 0.95 : 0.05), Math.PI * (facing > 0 ? 2.05 : 1.15));
      ctx.fill();
      if (gear.headTier >= 5) {
        ctx.strokeStyle = gear.headColor || f.colors.accent;
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(headC.x - facing * 2 * s, headC.y - headR);
        ctx.lineTo(headC.x + facing * 3 * s, headC.y - headR * 2.1);
        ctx.stroke();
      }
    }
    // eye dot — sells which way the fighter faces
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(headC.x + facing * headR * 0.42, headC.y - 1 * s, 1.9 * s, 0, 7); ctx.fill();

    // front limbs
    stroke(ctx, [hipF, legF.joint, legF.end], lw, bodyColor);
    if (gear.boots) drawBoot(ctx, legF.end, p.legF[0] + p.legF[1], s, facing, gear.bootTier, bodyColor);
    stroke(ctx, [shoulderF, armF.joint, armF.end], lw * 0.95, bodyColor);

    // weapon / gauntlet on the front hand
    if (gear.weaponTier) drawWeapon(ctx, armF.end, p.armF[0] + p.armF[1], s, facing, gear.weaponTier, gear.weaponColor || f.colors.accent);
    if (gear.charm) {
      const cx = pelvis.x - facing * 8 * s, cy = pelvis.y + 2 * s;
      const glow = 0.5 + 0.5 * Math.sin(f.animT * 5);
      ctx.globalAlpha = 0.5 + glow * 0.5;
      ctx.fillStyle = gear.charmColor || '#ffd166';
      ctx.beginPath(); ctx.arc(cx, cy, 3 * s, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // block spark
    if (f.blocking && f.state !== 'attack' && f.state !== 'special') {
      ctx.strokeStyle = hexA('#9ad0ff', 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + facing * 18 * s, y - 62 * s, 26 * s, -0.9, 0.9);
      ctx.stroke();
    }

    // guard-break stars
    if (f.state === 'guardbreak') {
      for (let i = 0; i < 3; i++) {
        const a = f.animT * 6 + (i / 3) * Math.PI * 2;
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(headC.x + Math.cos(a) * 18 * s, headC.y - 14 * s + Math.sin(a) * 6 * s, 2.6 * s, 0, 7);
        ctx.fill();
      }
    }

    ctx.restore();

    if (o.debug) {
      const hb = f.hurtbox();
      ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1; ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
      f.activeHits().forEach((hit) => {
        ctx.strokeStyle = '#ff3355'; ctx.strokeRect(hit.box.x, hit.box.y, hit.box.w, hit.box.h);
      });
    }
  }


  function stroke(ctx, pts, width, color) {
    if (!width || !color) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  function drawWeapon(ctx, hand, angle, s, facing, tier, color) {
    const d = dirVec(angle, facing);
    ctx.save();
    ctx.translate(hand.x, hand.y);
    ctx.rotate(Math.atan2(d.y, d.x));
    ctx.fillStyle = color;
    if (tier <= 2) {
      ctx.fillRect(-3 * s, -3.5 * s, 8 * s, 7 * s);
    } else if (tier <= 4) {
      ctx.fillRect(-4 * s, -4.5 * s, 12 * s, 9 * s);
      ctx.fillStyle = shade(color, 0.3);
      for (let i = 0; i < 3; i++) ctx.fillRect(6 * s + i * 2.5 * s, -4 * s + i * 3 * s, 3 * s, 1.6 * s);
    } else if (tier <= 6) {
      ctx.fillRect(-5 * s, -5 * s, 14 * s, 10 * s);
      ctx.fillStyle = shade(color, 0.4);
      ctx.beginPath();
      ctx.moveTo(9 * s, -5 * s); ctx.lineTo(20 * s, 0); ctx.lineTo(9 * s, 5 * s);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.shadowColor = color; ctx.shadowBlur = 12;
      ctx.fillRect(-6 * s, -5.5 * s, 16 * s, 11 * s);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(10 * s, -6 * s); ctx.lineTo(26 * s, 0); ctx.lineTo(10 * s, 6 * s);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function drawBoot(ctx, foot, angle, s, facing, tier, color) {
    ctx.fillStyle = shade(color, 0.15);
    ctx.save();
    ctx.translate(foot.x, foot.y);
    ctx.fillRect(-3 * s, -2 * s, 10 * s * facing, 5 * s);
    if (tier >= 5) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-2 * s, -3.5 * s, 7 * s * facing, 1.6 * s);
    }
    ctx.restore();
  }

  function shade(hex, amt) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  R.shade = shade;

  // ------------------------------------------------------- projectiles
  function drawProjectile(ctx, pr, t) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    const grad = ctx.createRadialGradient(pr.x, pr.y, 2, pr.x, pr.y, pr.w);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, pr.color || '#9ad0ff');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(pr.x, pr.y, pr.w * (1 + Math.sin(t * 20) * 0.06), pr.h * 0.6, 0, 0, 7);
    ctx.fill();
    ctx.restore();
  }

  /* The flat screen-print bust from the character sheet. Four or five shapes,
   * no shading, drawn in the sheet's own 240x260 space and scaled to fit. */
  function drawPortraitArt(ctx, character, w, hgt) {
    const art = character.portrait;
    if (!art) return;
    const k = Math.min(w / art.w, hgt / art.h);
    ctx.save();
    ctx.translate((w - art.w * k) / 2, (hgt - art.h * k) / 2);
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.rect(0, 0, art.w, art.h);
    ctx.clip();
    art.shapes.forEach((sh) => {
      if (sh.t === 'rect') {
        ctx.fillStyle = sh.fill;
        ctx.fillRect(sh.x, sh.y, sh.w, sh.h);
      } else if (sh.t === 'poly') {
        ctx.fillStyle = sh.fill;
        ctx.beginPath();
        sh.pts.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
        ctx.closePath();
        ctx.fill();
      } else if (sh.t === 'circle') {
        ctx.beginPath();
        ctx.arc(sh.x, sh.y, sh.r, 0, 7);
        if (sh.fill) { ctx.fillStyle = sh.fill; ctx.fill(); }
        if (sh.stroke) { ctx.strokeStyle = sh.stroke; ctx.lineWidth = sh.width || 4; ctx.stroke(); }
      } else if (sh.t === 'arc') {
        ctx.beginPath();
        ctx.arc(sh.x, sh.y, sh.r, U.rad(sh.from), U.rad(sh.to));
        ctx.strokeStyle = sh.stroke; ctx.lineWidth = sh.width || 6; ctx.stroke();
      }
    });
    ctx.restore();
  }

  /* Character-select cards draw the real fighter, hair physics and all, rather
   * than a separate piece of art that could drift out of sync with the game. */
  function drawPortrait(ctx, character, t, w, hgt, dt) {
    const pf = portraitFighters[character.id] || (portraitFighters[character.id] = {
      scale: 1, colors: character.colors, character: character,
      flash: 0, animT: 0, anim: 'idle', vy: 0, x: 0, y: 0, facing: 1,
      gear: {}, meter: 0, state: 'idle', blocking: false, tonicFlash: 0,
      hurtbox: () => ({ x: 0, y: 0, w: 0, h: 0 }), activeHits: () => [],
    });
    pf.animT = t;
    pf.character = character;
    pf.colors = character.colors;
    const cycle = t % 6;
    pf.anim = cycle < 3.4 ? 'idle' : cycle < 4.2 ? 'walk' : cycle < 5.2 ? 'block' : 'idle';

    const scale = Math.min(w / 90, hgt / 135);
    ctx.save();
    ctx.clearRect(0, 0, w, hgt);
    ctx.translate(w / 2, hgt * 0.94);
    ctx.scale(scale, scale);
    pf.x = 0; pf.y = 0;
    drawFighter(ctx, pf, { dt: dt, noShadow: true, band: 'mid' });
    ctx.restore();
  }
  const portraitFighters = {};

  R.drawPortrait = drawPortrait;
  R.drawPortraitArt = drawPortraitArt;
  R.characterIdle = characterIdle;
  R.POSE = POSE;
  R.P = P;
  R.FX = FX;
  R.fx = fx;
  R.updateFx = updateFx;
  R.drawFx = drawFx;
  R.drawBackground = drawBackground;
  R.drawFighter = drawFighter;
  R.drawProjectile = drawProjectile;
  R.poseFor = poseFor;

  root.ST = root.ST || {};
  root.ST.Render = R;
})(window);
