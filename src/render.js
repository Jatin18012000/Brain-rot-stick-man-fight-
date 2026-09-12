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
      lean: 6, hip: 0, headTilt: 0,
      armF: [18, 26], armB: [-14, 30],
      legF: [10, 10], legB: [-12, 12],
      stretch: 1,
    };
  }

  function lerpPose(a, b, t) {
    const o = {};
    o.lean = U.lerp(a.lean, b.lean, t);
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
  function poseFor(f, t) {
    const anim = f.anim;
    const walkPhase = (t * 8) % (Math.PI * 2);

    switch (anim) {
      case 'idle': {
        const b = (Math.sin(t * 3.2) + 1) / 2;
        return lerpPose(POSE.idle, POSE.idle2, b);
      }
      case 'walk': case 'walkBack': {
        const s = Math.sin(walkPhase), c = Math.cos(walkPhase);
        const p = pose({
          lean: anim === 'walk' ? 10 : 4,
          armF: [18 - s * 26, 26 + Math.abs(s) * 10],
          armB: [-14 + s * 26, 30 + Math.abs(s) * 10],
          legF: [10 + s * 32, 10 + Math.max(0, c) * 26],
          legB: [-12 - s * 32, 12 + Math.max(0, -c) * 26],
        });
        return p;
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
      const key = attackPoses(m.id);
      if (fr < m.startup) {
        return lerpPose(key.idle, key.wind, U.easeOut(fr / Math.max(1, m.startup)));
      }
      if (fr < m.startup + m.active) {
        return lerpPose(key.wind, key.hit, U.easeOut((fr - m.startup) / Math.max(1, m.active)));
      }
      const rt = (fr - m.startup - m.active) / Math.max(1, m.recovery);
      return lerpPose(key.hit, key.idle, U.ease(U.clamp(rt, 0, 1)));
    }

    if (f.state === 'special' && f.special) {
      return specialPose(f);
    }

    return POSE.idle;
  }

  function attackPoses(id) {
    switch (id) {
      case 'jab': return { idle: POSE.idle, wind: POSE.jabWind, hit: POSE.jabHit };
      case 'cross': return { idle: POSE.idle, wind: POSE.crossWind, hit: POSE.crossHit };
      case 'kick': return { idle: POSE.idle, wind: POSE.kickWind, hit: POSE.kickHit };
      case 'lowJab': return { idle: POSE.crouch, wind: POSE.crouch, hit: POSE.lowJabHit };
      case 'bodyBlow': return { idle: POSE.crouch, wind: POSE.bodyWind, hit: POSE.bodyHit };
      case 'sweep': return { idle: POSE.crouch, wind: POSE.sweepWind, hit: POSE.sweepHit };
      case 'airPunch': return { idle: POSE.fall, wind: POSE.jabWind, hit: POSE.airPunchP };
      case 'airCross': return { idle: POSE.fall, wind: POSE.crossWind, hit: POSE.airPunchP };
      case 'airKick': return { idle: POSE.fall, wind: POSE.kickWind, hit: POSE.airKickP };
      case 'lunge': return { idle: POSE.idle, wind: POSE.crossWind, hit: POSE.lungeHit };
      case 'spinKick': return { idle: POSE.idle, wind: POSE.spinWind, hit: POSE.spinHit };
      default: return { idle: POSE.idle, wind: POSE.jabWind, hit: POSE.jabHit };
    }
  }

  /* Specials cycle through strike poses timed to their scripted hits. */
  function specialPose(f) {
    const sp = f.special;
    const fr = f.frame;
    const hits = sp.hits || [];
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
      return lerpPose(POSE.idle, POSE.jabWind, t);
    }
    const idx = hits.indexOf(prev);
    const cur = poseOfHit(prev, idx);
    if (next) {
      const t = U.clamp((fr - prev.f) / Math.max(1, next.f - prev.f), 0, 1);
      const mid = idx % 2 === 0 ? POSE.crossWind : POSE.jabWind;
      return t < 0.5 ? lerpPose(cur, mid, t * 2) : lerpPose(mid, poseOfHit(next, idx + 1), (t - 0.5) * 2);
    }
    const t = U.clamp((fr - prev.f) / Math.max(1, sp.duration - prev.f), 0, 1);
    return lerpPose(cur, POSE.idle, U.ease(t));
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

  // -------------------------------------------------------- fighter render
  function drawFighter(ctx, f, opts) {
    const o = opts || {};
    const s = f.scale;
    const p = poseFor(f, f.animT + (f.isPlayer ? 0 : 0.7));
    const facing = f.facing;
    const x = f.x;
    const y = f.y;

    const hipDrop = p.hip * s;
    const pelvis = { x: x + Math.sin(U.rad(p.lean)) * 4 * facing, y: y - P.pelvis * s + hipDrop };
    const leanV = dirVec(180 + p.lean, facing);
    const torsoLen = (P.neck - P.pelvis) * s;
    const neck = { x: pelvis.x + leanV.x * torsoLen, y: pelvis.y + leanV.y * torsoLen };
    const headC = { x: neck.x + leanV.x * (P.headY - P.neck + P.headR * 0.4) * s, y: neck.y + leanV.y * (P.headY - P.neck + P.headR * 0.4) * s };

    const shoulderF = { x: neck.x + facing * P.shoulderW * 0.35 * s, y: neck.y + 2 * s };
    const shoulderB = { x: neck.x - facing * P.shoulderW * 0.35 * s, y: neck.y + 3 * s };
    const hipF = { x: pelvis.x + facing * P.hipW * 0.3 * s, y: pelvis.y };
    const hipB = { x: pelvis.x - facing * P.hipW * 0.3 * s, y: pelvis.y };

    const armF = limb(shoulderF.x, shoulderF.y, p.armF[0], P.upperArm * s, p.armF[1], P.foreArm * s, facing);
    const armB = limb(shoulderB.x, shoulderB.y, p.armB[0], P.upperArm * s, p.armB[1], P.foreArm * s, facing);
    const legF = limb(hipF.x, hipF.y, p.legF[0], P.thigh * s, p.legF[1], P.shin * s, facing);
    const legB = limb(hipB.x, hipB.y, p.legB[0], P.thigh * s, p.legB[1], P.shin * s, facing);

    const gear = f.gear || {};
    const bodyColor = f.flash > 0 ? '#ffffff' : f.colors.body;
    const lw = 7 * s;

    ctx.save();

    // aura for wardens / rage
    if (f.colors.aura) {
      const pulse = 0.5 + 0.5 * Math.sin(f.animT * 4);
      ctx.globalAlpha = 0.16 + pulse * 0.12;
      ctx.fillStyle = f.colors.aura;
      ctx.beginPath(); ctx.ellipse(x, y - 56 * s, 44 * s, 66 * s, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (f.meter >= 100) {
      const pulse = 0.5 + 0.5 * Math.sin(f.animT * 9);
      ctx.globalAlpha = 0.10 + pulse * 0.14;
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.ellipse(x, y - 56 * s, 40 * s, 64 * s, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (f.tonicFlash > 0) {
      ctx.globalAlpha = f.tonicFlash * 0.5;
      ctx.fillStyle = '#7ee787';
      ctx.beginPath(); ctx.ellipse(x, y - 56 * s, 42 * s, 66 * s, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // shadow
    ctx.globalAlpha = U.clamp(1 - (GROUND_Y - y) / 260, 0.15, 0.5);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, GROUND_Y + 2, 26 * s, 6 * s, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // back limbs (darker, reads as depth)
    const backColor = shade(bodyColor, -0.35);
    stroke(ctx, [shoulderB, armB.joint, armB.end], lw * 0.9, backColor);
    stroke(ctx, [hipB, legB.joint, legB.end], lw, backColor);
    if (gear.boots) drawBoot(ctx, legB.end, p.legB[0] + p.legB[1], s, facing, gear.bootTier, backColor);

    // torso + armour
    if (gear.armor) {
      ctx.strokeStyle = gear.armorColor || f.colors.accent;
      ctx.lineWidth = lw * 2.2;
      ctx.beginPath(); ctx.moveTo(pelvis.x, pelvis.y); ctx.lineTo(neck.x, neck.y); ctx.stroke();
      ctx.strokeStyle = shade(gear.armorColor || f.colors.accent, -0.3);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pelvis.x, pelvis.y); ctx.lineTo(neck.x, neck.y); ctx.stroke();
    }
    stroke(ctx, [pelvis, neck], lw * 1.15, bodyColor);

    // head
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.arc(headC.x, headC.y, P.headR * s, 0, 7); ctx.fill();
    if (gear.head) {
      ctx.fillStyle = gear.headColor || f.colors.accent;
      ctx.beginPath();
      ctx.arc(headC.x, headC.y, P.headR * s * 1.06, Math.PI * (facing > 0 ? 0.95 : 0.05), Math.PI * (facing > 0 ? 2.05 : 1.15));
      ctx.fill();
      if (gear.headTier >= 5) {
        ctx.strokeStyle = gear.headColor || f.colors.accent;
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(headC.x - facing * 2 * s, headC.y - P.headR * s);
        ctx.lineTo(headC.x + facing * 3 * s, headC.y - P.headR * s * 2.1);
        ctx.stroke();
      }
    }
    // eye direction dot — sells which way the fighter faces
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(headC.x + facing * P.headR * 0.42 * s, headC.y - 1 * s, 1.9 * s, 0, 7); ctx.fill();

    // front limbs
    stroke(ctx, [hipF, legF.joint, legF.end], lw, bodyColor);
    if (gear.boots) drawBoot(ctx, legF.end, p.legF[0] + p.legF[1], s, facing, gear.bootTier, bodyColor);
    stroke(ctx, [shoulderF, armF.joint, armF.end], lw * 0.95, bodyColor);

    // weapon / gauntlet on the front hand
    if (gear.weaponTier) drawWeapon(ctx, armF.end, p.armF[0] + p.armF[1], s, facing, gear.weaponTier, gear.weaponColor || f.colors.accent);
    if (gear.glovesTier) {
      ctx.fillStyle = shade(f.colors.accent, 0.1);
      ctx.beginPath(); ctx.arc(armB.end.x, armB.end.y, 3.2 * s, 0, 7); ctx.fill();
    }
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
      f.activeHits().forEach((h) => {
        ctx.strokeStyle = '#ff3355'; ctx.strokeRect(h.box.x, h.box.y, h.box.w, h.box.h);
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
