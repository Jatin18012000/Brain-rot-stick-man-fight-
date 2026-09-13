/* Stickman Tower — playable characters.
 *
 * A character is pure data: palette, build, stat modifiers, stance, the soft
 * parts that trail behind them, and one signature combo. The fighting engine
 * is untouched — frame data, blocking, rage and combo matching are identical
 * for everyone. Characters change how you feel, not what the rules are.
 *
 * NOTE: BLAZE and VESPER are placeholder builds in the engine's own visual
 * language, standing in until the commissioned character sheets land. To swap
 * a real design in, edit this file only — nothing else knows their details.
 *
 * ---------------------------------------------------------------------------
 * ATTACHMENTS (the soft parts)
 *   joint:     head neck shoulderF/B elbowF/B handF/B pelvis hipF/B kneeF/B footF/B
 *   type chain: a verlet rope — ponytails, braids, coat tails, sashes
 *     segments  number of links
 *     length    total length in the 112-unit body space
 *     width     stroke width at the root, tapering to width*taper
 *     rest      [x, y] rest direction; x is facing-relative, +y is DOWN
 *     stiffness 0..1 pull back toward the rest direction
 *     gravity   px/s^2, damp 0..1 velocity retention
 *   type shape: a rigid piece — collars, guards, visors
 *     shape     'wedge' | 'plate' | 'disc'
 *     size      [w, h], offset [x, y] from the joint (facing-relative x)
 *     angle     degrees, or 'limb' to follow the limb it hangs from
 *   color:      'body' | 'accent' | 'trim' | any hex
 * ---------------------------------------------------------------------------
 * STATS are multipliers on the player's derived combat block, except `reach`
 * (flat units added to attack hitbox width) and `crit` (flat chance added).
 * Keep them modest and offsetting: tools/balance.mjs assumes roughly parity.
 */
(function (root) {
  'use strict';

  const CHARACTERS = [
    {
      id: 'classic',
      name: 'The Stickman',
      title: 'Floor One, Day One',
      tagline: 'No gimmicks. No excuses. Every stat dead average, every option open.',
      role: 'All-rounder',
      colors: { body: '#f2f4f8', accent: '#6ea8ff', trim: '#9aa3b5', aura: null },
      build: { scale: 1.00, limbWidth: 1.00, headR: 1.00 },
      stats: { hp: 1.00, atk: 1.00, spd: 1.00, aspd: 1.00, crit: 0, rage: 1.00, reach: 0 },
      stance: { lean: 0, guard: 0 },
      attachments: [],
      signature: null,
      blurb: 'The baseline. If a floor is beatable, it is beatable with him.',
    },

    {
      id: 'blaze',
      name: 'BLAZE',
      title: 'Sixteen Hits and Counting',
      tagline: 'Gets in, stays in. The whole game plan is not letting you breathe.',
      role: 'Rushdown',
      colors: { body: '#ffe3ec', accent: '#ff2d75', trim: '#ffd166', aura: null },
      build: { scale: 0.96, limbWidth: 0.92, headR: 1.02 },
      // Fast and relentless, but she has to take risks to win the damage race.
      stats: { hp: 0.90, atk: 0.96, spd: 1.14, aspd: 1.12, crit: 0.04, rage: 1.12, reach: -3 },
      stance: { lean: 6, guard: 12 },   // coiled forward, hands up
      attachments: [
        {
          id: 'ponytail', type: 'chain', joint: 'head',
          segments: 6, length: 32, width: 5.5, taper: 0.2,
          rest: [-1, 0.12], stiffness: 0.10, gravity: 1600, damp: 0.90,
          color: 'accent',
        },
        {
          id: 'sash', type: 'chain', joint: 'pelvis',
          segments: 5, length: 27, width: 4.5, taper: 0.25,
          rest: [-0.7, 0.7], stiffness: 0.07, gravity: 1800, damp: 0.93,
          color: 'trim',
        },
        {
          id: 'cuff', type: 'shape', joint: 'elbowF',
          shape: 'plate', size: [9, 5], offset: [0, 0], angle: 'limb',
          color: 'accent',
        },
      ],
      signature: {
        id: 'sigEmber', name: 'Ember Rush', seq: ['K', 'P1', 'P1'],
        unlock: 1, cost: 14, duration: 54, anim: 'sigEmber',
        desc: 'Kick, punch, punch. A running start into a two-fist flurry that drags you forward.',
        hits: [
          { f: 8, dmg: 11, active: 3, guard: 'mid', hitstun: 16, blockstun: 10, kb: 40, lift: 0, box: { x: 14, y: 46, w: 62, h: 30 } },
          { f: 20, dmg: 9, active: 3, guard: 'mid', hitstun: 16, blockstun: 10, kb: 30, lift: 0, box: { x: 16, y: 66, w: 50, h: 24 } },
          { f: 28, dmg: 9, active: 3, guard: 'mid', hitstun: 16, blockstun: 10, kb: 30, lift: 0, box: { x: 16, y: 66, w: 52, h: 24 } },
          { f: 40, dmg: 24, active: 4, guard: 'mid', hitstun: 28, blockstun: 14, kb: 300, lift: 120, knockdown: true, box: { x: 14, y: 54, w: 72, h: 40 } },
        ],
        steps: [{ f: 6, vx: 260 }, { f: 26, vx: 160 }, { f: 38, vx: 200 }],
      },
      blurb: 'Fastest walk speed and attack recovery in the game, and the thinnest health bar. '
        + 'Her signature starts with a kick, so it comes out of neutral when a punch string would be read.',
    },

    {
      id: 'vesper',
      name: 'VESPER',
      title: 'One Step Is Enough',
      tagline: 'Holds the space you want to stand in, and charges rent.',
      role: 'Zoner / Power',
      colors: { body: '#e8e3ff', accent: '#8b5cf6', trim: '#ffd166', aura: null },
      build: { scale: 1.10, limbWidth: 1.08, headR: 0.96 },
      // Longer reach and heavier hits, paid for with speed.
      stats: { hp: 1.12, atk: 1.10, spd: 0.90, aspd: 0.93, crit: 0, rage: 0.96, reach: 9 },
      stance: { lean: -4, guard: -9 },  // upright, low relaxed guard
      attachments: [
        {
          id: 'coatBack', type: 'chain', joint: 'pelvis',
          segments: 6, length: 42, width: 9, taper: 0.4,
          rest: [-0.8, 0.7], stiffness: 0.09, gravity: 1400, damp: 0.94,
          color: 'accent',
        },
        {
          id: 'coatFront', type: 'chain', joint: 'hipF',
          segments: 5, length: 31, width: 6, taper: 0.35,
          rest: [-0.25, 0.95], stiffness: 0.08, gravity: 1500, damp: 0.94,
          color: 'accent',
        },
        {
          id: 'collar', type: 'shape', joint: 'neck',
          shape: 'wedge', size: [12, 9], offset: [-3, -1], angle: -20,
          color: 'trim',
        },
      ],
      signature: {
        id: 'sigTollBell', name: 'Toll the Bell', seq: ['P2', 'P1', 'K'],
        unlock: 1, cost: 18, duration: 62, anim: 'sigTollBell',
        desc: 'Cross, jab, then a long pivot kick that catches anyone who stepped in.',
        hits: [
          { f: 10, dmg: 14, active: 3, guard: 'mid', hitstun: 18, blockstun: 12, kb: 90, lift: 0, box: { x: 16, y: 64, w: 66, h: 28 } },
          { f: 22, dmg: 10, active: 3, guard: 'mid', hitstun: 16, blockstun: 10, kb: 60, lift: 0, box: { x: 16, y: 68, w: 58, h: 24 } },
          { f: 42, dmg: 32, active: 5, guard: 'mid', hitstun: 30, blockstun: 16, kb: 360, lift: 150, knockdown: true, guardCrush: 26, box: { x: 14, y: 44, w: 96, h: 40 } },
        ],
        steps: [{ f: 40, vx: 120 }],
      },
      blurb: 'Every attack box is nine units wider than anyone else\'s, so she wins trades she '
        + 'has no business winning. Slow enough that a whiff is a real invitation.',
    },
  ];

  const BY_ID = {};
  CHARACTERS.forEach((c) => { BY_ID[c.id] = c; });

  function get(id) { return BY_ID[id] || BY_ID.classic; }

  /* Every special this character can perform: the shared list plus their own. */
  function specialsFor(id) {
    const c = get(id);
    const base = root.ST.Moves.SPECIALS;
    return c.signature ? base.concat([c.signature]) : base.slice();
  }

  root.ST = root.ST || {};
  root.ST.Characters = { CHARACTERS, BY_ID, get, specialsFor };
})(window);
