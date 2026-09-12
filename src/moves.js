/* Stickman Tower — move set, frame data and combo recipes.
 *
 * All timings are in 60fps frames: startup -> active -> recovery, the standard
 * fighting-game model. Hitboxes are in "fighter local space": origin at the
 * feet, +x is forward (mirrored by facing), +y is up.
 */
(function (root) {
  'use strict';

  const box = (x, y, w, h) => ({ x, y, w, h });

  // ---------------------------------------------------------------- normals
  const MOVES = {
    jab: {
      id: 'jab', name: 'Jab', button: 'P1', stance: 'stand',
      startup: 4, active: 3, recovery: 7,
      dmg: 6, guard: 'mid', hitstun: 14, blockstun: 9,
      kb: 90, lift: 0, meter: 3, pushback: 26,
      box: box(16, 68, 46, 24), moveX: 24, anim: 'jab', sfx: 'whiffLight',
    },
    cross: {
      id: 'cross', name: 'Cross', button: 'P2', stance: 'stand',
      startup: 8, active: 4, recovery: 14,
      dmg: 12, guard: 'mid', hitstun: 19, blockstun: 12,
      kb: 160, lift: 0, meter: 5, pushback: 40,
      box: box(16, 66, 60, 28), moveX: 34, anim: 'cross', sfx: 'whiffHeavy',
    },
    kick: {
      id: 'kick', name: 'Roundhouse', button: 'K', stance: 'stand',
      startup: 12, active: 5, recovery: 18,
      dmg: 17, guard: 'mid', hitstun: 22, blockstun: 14,
      kb: 240, lift: 90, meter: 6, pushback: 54,
      box: box(16, 46, 72, 32), moveX: 30, anim: 'kick', sfx: 'whiffHeavy',
    },
    lowJab: {
      id: 'lowJab', name: 'Low Jab', button: 'P1', stance: 'crouch',
      startup: 5, active: 3, recovery: 8,
      dmg: 5, guard: 'low', hitstun: 13, blockstun: 9,
      kb: 70, lift: 0, meter: 3, pushback: 22,
      box: box(14, 40, 40, 20), moveX: 10, anim: 'lowJab', sfx: 'whiffLight',
    },
    bodyBlow: {
      id: 'bodyBlow', name: 'Body Blow', button: 'P2', stance: 'crouch',
      startup: 9, active: 4, recovery: 16,
      dmg: 13, guard: 'mid', hitstun: 20, blockstun: 12,
      kb: 120, lift: 150, meter: 5, pushback: 34,
      box: box(14, 30, 48, 36), moveX: 16, anim: 'bodyBlow', sfx: 'whiffHeavy',
    },
    sweep: {
      id: 'sweep', name: 'Sweep', button: 'K', stance: 'crouch',
      startup: 11, active: 4, recovery: 22,
      dmg: 12, guard: 'low', hitstun: 24, blockstun: 13,
      kb: 180, lift: 0, knockdown: true, meter: 6, pushback: 46,
      box: box(12, 4, 62, 26), moveX: 26, anim: 'sweep', sfx: 'whiffHeavy',
    },
    airPunch: {
      id: 'airPunch', name: 'Dive Fist', button: 'P1', stance: 'air',
      startup: 5, active: 8, recovery: 6,
      dmg: 10, guard: 'overhead', hitstun: 18, blockstun: 11,
      kb: 110, lift: 0, meter: 4, pushback: 20,
      box: box(10, 52, 48, 34), moveX: 0, anim: 'airPunch', sfx: 'whiffLight',
    },
    airKick: {
      id: 'airKick', name: 'Sky Heel', button: 'K', stance: 'air',
      startup: 7, active: 9, recovery: 8,
      dmg: 15, guard: 'overhead', hitstun: 21, blockstun: 13,
      kb: 150, lift: 0, meter: 5, pushback: 26,
      box: box(8, 26, 58, 40), moveX: 0, anim: 'airKick', sfx: 'whiffHeavy',
    },
    airCross: {
      id: 'airCross', name: 'Falling Hammer', button: 'P2', stance: 'air',
      startup: 8, active: 7, recovery: 8,
      dmg: 14, guard: 'overhead', hitstun: 20, blockstun: 12,
      kb: 130, lift: 0, meter: 5, pushback: 24,
      box: box(6, 44, 52, 44), moveX: 0, anim: 'airCross', sfx: 'whiffHeavy',
    },
    lunge: {
      id: 'lunge', name: 'Lunge Straight', button: 'P2', stance: 'stand', dir: 'fwd',
      startup: 11, active: 4, recovery: 19,
      dmg: 19, guard: 'mid', hitstun: 23, blockstun: 14,
      kb: 260, lift: 0, meter: 7, pushback: 60,
      box: box(18, 62, 74, 30), moveX: 96, anim: 'lunge', sfx: 'whiffHeavy',
    },
    spinKick: {
      id: 'spinKick', name: 'Spin Heel', button: 'K', stance: 'stand', dir: 'back',
      startup: 15, active: 5, recovery: 21,
      dmg: 21, guard: 'mid', hitstun: 24, blockstun: 15,
      kb: 300, lift: 170, knockdown: true, meter: 8, pushback: 70,
      box: box(14, 48, 78, 36), moveX: 18, anim: 'spinKick', sfx: 'whiffHeavy',
    },
  };

  // Normals that a special may be cancelled out of on hit (hit-confirm).
  const CANCELABLE = ['jab', 'cross', 'kick', 'lowJab', 'bodyBlow', 'lunge'];

  // ------------------------------------------------------------- specials
  // A special is a scripted string of hits. `hits[].f` is the frame the hit
  // becomes active; each hit has its own box so the animation reads clearly.
  const hit = (f, dmg, b, extra) =>
    Object.assign({ f, dmg, box: b, active: 3, guard: 'mid', hitstun: 16, blockstun: 10, kb: 60, lift: 0 }, extra || {});

  const SPECIALS = [
    {
      id: 'twinSweep', name: 'Twin Jab Sweep', seq: ['P1', 'P1', 'K'],
      unlock: 1, cost: 0, duration: 44, anim: 'twinSweep',
      desc: 'Two quick jabs into a leg sweep. Your bread and butter — knocks the boss down.',
      hits: [
        hit(6, 6, box(16, 68, 46, 22)),
        hit(14, 7, box(16, 68, 50, 22)),
        hit(26, 14, box(12, 4, 66, 26), { guard: 'low', knockdown: true, kb: 210, hitstun: 26 }),
      ],
      steps: [{ f: 22, vx: 210 }],
    },
    {
      id: 'risingFang', name: 'Rising Fang', seq: ['P1', 'P2', 'K'],
      unlock: 2, cost: 12, duration: 50, anim: 'risingFang',
      desc: 'Jab, cross, then a rising knee that launches. Great anti-air, invincible on startup.',
      invuln: [4, 16],
      hits: [
        hit(5, 6, box(16, 68, 44, 22)),
        hit(13, 11, box(16, 66, 56, 26)),
        hit(24, 20, box(10, 40, 52, 62), { lift: 430, kb: 120, hitstun: 30 }),
      ],
      steps: [{ f: 22, vx: 120, vy: 300 }],
    },
    {
      id: 'cyclone', name: 'Cyclone Heel', seq: ['K', 'K', 'P2'],
      unlock: 3, cost: 16, duration: 56, anim: 'cyclone',
      desc: 'Two spinning heels into a hammer. Hits wide — good for crowding bosses.',
      hits: [
        hit(9, 12, box(14, 46, 70, 30)),
        hit(21, 13, box(14, 46, 74, 30)),
        hit(36, 22, box(12, 40, 62, 54), { kb: 280, knockdown: true, hitstun: 28 }),
      ],
      steps: [{ f: 8, vx: 160 }, { f: 34, vx: 120 }],
    },
    {
      id: 'hammerFall', name: 'Hammer Fall', seq: ['P2', 'P2', 'K'],
      unlock: 4, cost: 18, duration: 58, anim: 'hammerFall',
      desc: 'Two heavy crosses into an axe kick that crushes guard.',
      hits: [
        hit(9, 12, box(16, 66, 56, 26)),
        hit(20, 13, box(16, 66, 60, 26)),
        hit(38, 26, box(14, 30, 54, 82), { guard: 'overhead', kb: 150, knockdown: true, hitstun: 30, guardCrush: 34 }),
      ],
      steps: [{ f: 34, vx: 90 }],
    },
    {
      id: 'shadowDance', name: 'Shadow Dance', seq: ['P1', 'K', 'P1', 'K'],
      unlock: 6, cost: 26, duration: 72, anim: 'shadowDance',
      desc: 'Four-beat rushdown. Each hit pulls you forward — huge damage if it connects clean.',
      hits: [
        hit(5, 7, box(16, 68, 46, 22)),
        hit(16, 12, box(14, 46, 66, 30)),
        hit(30, 12, box(16, 68, 52, 24)),
        hit(48, 28, box(12, 44, 76, 40), { kb: 300, knockdown: true, hitstun: 30 }),
      ],
      steps: [{ f: 4, vx: 140 }, { f: 28, vx: 180 }, { f: 46, vx: 200 }],
    },
    {
      id: 'ironWaltz', name: 'Iron Waltz', seq: ['P2', 'K', 'P2', 'K'],
      unlock: 8, cost: 30, duration: 78, anim: 'ironWaltz',
      desc: 'Heavy alternating strikes. Slow to start but each blow chunks armour.',
      hits: [
        hit(10, 14, box(16, 62, 60, 30), { armorPierce: 0.25 }),
        hit(24, 15, box(14, 46, 70, 32), { armorPierce: 0.25 }),
        hit(40, 16, box(16, 62, 64, 30), { armorPierce: 0.25 }),
        hit(58, 30, box(12, 40, 78, 52), { armorPierce: 0.4, kb: 320, knockdown: true, hitstun: 32 }),
      ],
      steps: [{ f: 8, vx: 90 }, { f: 38, vx: 110 }, { f: 56, vx: 140 }],
    },
    {
      id: 'thunderCross', name: 'Thunder Cross', seq: ['P1', 'P1', 'P2', 'P2', 'K'],
      unlock: 10, cost: 40, duration: 86, anim: 'thunderCross',
      desc: 'Five-piece rush ending in a thunderous cross kick. Big meter, bigger payoff.',
      hits: [
        hit(5, 7, box(16, 68, 44, 22)),
        hit(13, 8, box(16, 68, 48, 22)),
        hit(24, 14, box(16, 64, 58, 28)),
        hit(38, 15, box(16, 64, 62, 28)),
        hit(60, 38, box(10, 40, 84, 56), { kb: 380, knockdown: true, hitstun: 34, shock: true }),
      ],
      steps: [{ f: 22, vx: 120 }, { f: 56, vx: 220 }],
    },
    {
      id: 'dragonLadder', name: 'Dragon Ladder', seq: ['K', 'P1', 'P2', 'K'],
      unlock: 12, cost: 34, duration: 80, anim: 'dragonLadder',
      desc: 'Climbing chain that juggles the boss upward, then spikes them back down.',
      hits: [
        hit(10, 13, box(14, 46, 66, 30), { lift: 260 }),
        hit(24, 12, box(14, 56, 54, 40), { lift: 200 }),
        hit(40, 14, box(12, 62, 56, 48), { lift: 220 }),
        hit(60, 34, box(10, 30, 66, 86), { guard: 'overhead', kb: 200, knockdown: true, hitstun: 34, spike: true }),
      ],
      steps: [{ f: 38, vy: 340 }],
    },
    {
      id: 'hundredFists', name: 'Hundred Fists', seq: ['P1', 'P1', 'P1', 'P2', 'P2', 'K'],
      unlock: 15, cost: 60, duration: 118, anim: 'hundredFists', ultimate: true,
      desc: 'ULTIMATE. Three jabs, two crosses, then a blur of fists into a finishing heel. Ignores a chunk of defence.',
      invuln: [2, 10],
      hits: [
        hit(6, 6, box(16, 68, 46, 22), { armorPierce: 0.3 }),
        hit(12, 6, box(16, 68, 46, 22), { armorPierce: 0.3 }),
        hit(18, 7, box(16, 66, 50, 24), { armorPierce: 0.3 }),
        hit(24, 7, box(16, 66, 50, 24), { armorPierce: 0.3 }),
        hit(30, 8, box(16, 64, 54, 26), { armorPierce: 0.3 }),
        hit(36, 8, box(16, 64, 54, 26), { armorPierce: 0.3 }),
        hit(42, 9, box(16, 62, 58, 28), { armorPierce: 0.3 }),
        hit(48, 9, box(16, 62, 58, 28), { armorPierce: 0.3 }),
        hit(56, 10, box(16, 60, 62, 30), { armorPierce: 0.3 }),
        hit(64, 11, box(16, 60, 62, 30), { armorPierce: 0.3 }),
        hit(82, 24, box(12, 44, 76, 44), { armorPierce: 0.4, lift: 300, kb: 160 }),
        hit(98, 44, box(10, 40, 88, 56), { armorPierce: 0.5, kb: 420, knockdown: true, hitstun: 40, shock: true }),
      ],
      steps: [{ f: 4, vx: 90 }, { f: 78, vx: 140 }, { f: 94, vx: 200 }],
    },
    // Direction-motion specials for players who want classic inputs.
    {
      id: 'shockPalm', name: 'Shock Palm', seq: ['D', 'F', 'P1'], motion: true,
      unlock: 5, cost: 20, duration: 46, anim: 'shockPalm',
      desc: 'Down, Forward + Punch 1. Fires a shockwave across the floor.',
      projectile: { f: 14, speed: 520, dmg: 16, w: 44, h: 46, y: 42, life: 1.6 },
      hits: [], steps: [],
    },
    {
      id: 'tornado', name: 'Tornado Kick', seq: ['D', 'B', 'K'], motion: true,
      unlock: 7, cost: 24, duration: 62, anim: 'tornado',
      desc: 'Down, Back + Kick. Spinning multi-hit that sucks the boss in.',
      hits: [
        hit(12, 9, box(10, 30, 74, 62), { kb: 20 }),
        hit(20, 9, box(10, 30, 74, 62), { kb: 20 }),
        hit(28, 9, box(10, 30, 74, 62), { kb: 20 }),
        hit(38, 22, box(10, 30, 80, 66), { kb: 300, knockdown: true, hitstun: 30 }),
      ],
      steps: [{ f: 10, vx: 80 }],
    },
    {
      id: 'dashSmash', name: 'Dash Smash', seq: ['F', 'F', 'P2'], motion: true,
      unlock: 9, cost: 22, duration: 52, anim: 'dashSmash',
      desc: 'Forward, Forward + Punch 2. Crosses the screen and cracks guard open.',
      hits: [hit(18, 28, box(16, 54, 76, 42), { kb: 340, knockdown: true, hitstun: 30, guardCrush: 40 })],
      steps: [{ f: 6, vx: 520 }],
    },
  ];

  const SPECIAL_BY_ID = {};
  SPECIALS.forEach((s) => { SPECIAL_BY_ID[s.id] = s; });

  // Longest recipes first so "P1 P2 P1 P2 K K" wins over "P1 P2 K".
  const SPECIALS_BY_LENGTH = SPECIALS.slice().sort((a, b) => b.seq.length - a.seq.length);

  /* Pick the normal that matches the current stance + held direction. */
  function normalFor(button, stance, dirIntent) {
    if (stance === 'air') {
      if (button === 'P1') return MOVES.airPunch;
      if (button === 'P2') return MOVES.airCross;
      return MOVES.airKick;
    }
    if (stance === 'crouch') {
      if (button === 'P1') return MOVES.lowJab;
      if (button === 'P2') return MOVES.bodyBlow;
      return MOVES.sweep;
    }
    if (dirIntent === 'fwd' && button === 'P2') return MOVES.lunge;
    if (dirIntent === 'back' && button === 'K') return MOVES.spinKick;
    if (button === 'P1') return MOVES.jab;
    if (button === 'P2') return MOVES.cross;
    return MOVES.kick;
  }

  function totalFrames(m) { return m.startup + m.active + m.recovery; }

  root.ST = root.ST || {};
  root.ST.Moves = {
    MOVES, SPECIALS, SPECIALS_BY_LENGTH, SPECIAL_BY_ID, CANCELABLE,
    normalFor, totalFrames, box,
  };
})(window);
