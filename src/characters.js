/* Stickman Tower — playable characters.
 *
 * RAZA and VANE are implemented from the commissioned character sheets
 * (Stickman Tower / character build spec / v1). Every number here traces to
 * that document: proportions, palette hex, attachment joints, rest angles,
 * damping, stance, signature beats and FX colours.
 *
 * The sheet ships two artboards per fighter. The *side* view is authoritative
 * for this renderer — it faces +x, which is exactly the engine's facing=+1.
 * The front view is a compositional piece and its limb ordering does not map
 * to a profile fighter.
 *
 * A character is pure data. The fighting engine is untouched: identical frame
 * data, blocking, rage and combo matching for everyone. Characters change how
 * you feel, not what the rules are.
 *
 * ---------------------------------------------------------------------------
 * ANGLES
 *   attachments use the sheet's convention — degrees, 0 = forward, CCW, y up.
 *   poses use the engine's — degrees, 0 = straight down, positive = forward.
 *   `lean` is negative for a forward tilt (the torso draws along 180 + lean).
 * ATTACHMENTS
 *   joint:   head neck shoulderF/B elbowF/B handF/B foreArmF/B upperArmF/B
 *            pelvis hipF/B kneeF/B footF/B shinF/B thighF/B
 *   chain:   a verlet rope. segments, length, width (root), taper (tip/root),
 *            angle (rest), stiffness, gravity, damp, origin [x,y] from joint.
 *   shape:   rigid. capsule | arc | ring | wedge | plate | disc | tri.
 *   minTier: hidden until the player's average gear tier reaches this.
 *   flashOn: 'hit' recolours the part to the aura colour for 2 frames.
 * STATS are multipliers on the derived combat block, except reach (flat units
 *   on attack-box width) and crit (flat chance). tools/balance.mjs assumes
 *   rough parity, so keep them modest and offsetting.
 * ---------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  const CHARACTERS = [
    // ---------------------------------------------------------------- RAZA
    {
      id: 'raza',
      name: 'RAZA',
      title: 'Fighter 01',
      role: 'Rushdown',
      tagline: 'Gets in, stays in. The whole plan is not letting you breathe.',
      quote: 'You get one clean breath a round. I take that one too.',
      philosophy: 'Street-circuit brawler who fights on the front foot and never resets. '
        + 'Distance is a mistake you only get to make once.',
      recognisable: 'Twin gold tails flaring off a hot-pink body, short sash snapping behind '
        + 'the hips. The only silhouette on screen wider above the shoulders than below.',

      colors: {
        body: '#F0356B',
        back: '#A61E49',
        backBright: '#C42756',   // sheet: lift back limbs on stages above 0.10 luminance
        accent: '#FFC93C',
        trim: '#FFF0E6',
        aura: '#FF7A2F',
      },

      build: {
        scale: 0.94,
        limbs: {
          thigh: 26, shin: 25, upperArm: 22, foreArm: 20,
          shoulderW: 9, hipW: 7, headR: 11, torso: 34,
          limbW: 7.5, torsoW: 10.5,
        },
      },

      // Fast and relentless, paid for with health and reach.
      stats: { hp: 0.93, atk: 1.00, spd: 1.14, aspd: 1.12, crit: 0.04, rage: 1.12, reach: -3 },

      stance: {
        lean: -7,                       // 6-7° forward, per sheet
        armLen: 0.72, legLen: 1.0,      // guard held in tight, as drawn
        idle: { amp: 2.0, hz: 3.4, hold: 0 },   // "fast 2u pulse" — 7Hz reads as a buzz, halved
        walk: { stride: 9, backRatio: 0.77 },   // forward walk 1.3x back walk
        pose: {                         // derived from the side artboard
          armF: [27, -192], armB: [-25, 183],
          legF: [17, -11], legB: [-15, 6],
        },
      },

      attachments: [
        {
          id: 'tailA', type: 'chain', joint: 'head', origin: [3, 5],
          segments: 2, length: 20, width: 6, taper: 0.45,
          angle: 139, stiffness: 0.55, gravity: 420, damp: 0.86,
          color: 'accent', layer: 'back', lenByTier: [1, 1.2, 1.3],
        },
        {
          id: 'tailB', type: 'chain', joint: 'head', origin: [3, 4],
          segments: 2, length: 18, width: 5.5, taper: 0.4,
          angle: 162, stiffness: 0.55, gravity: 420, damp: 0.86,
          color: 'accent', layer: 'back', lenByTier: [1, 1.2, 1.3],
        },
        {
          id: 'sash', type: 'chain', joint: 'pelvis', origin: [-1, 1],
          segments: 2, length: 21, width: 5, taper: 0.4,
          angle: 215, stiffness: 0.10, gravity: 1500, damp: 0.90,
          color: 'aura', layer: 'back', lenByTier: [0.7, 1, 1],
        },
        {
          id: 'wrapF', type: 'shape', joint: 'foreArmF', shape: 'capsule',
          size: [8, 8], angle: 'limb', color: 'trim', layer: 'front', flashOn: 'hit',
        },
        {
          id: 'wrapB', type: 'shape', joint: 'foreArmB', shape: 'capsule',
          size: [8, 8], angle: 'limb', color: 'trim', layer: 'front', flashOn: 'hit',
        },
        {
          id: 'band', type: 'shape', joint: 'head', origin: [3, 6], shape: 'plate',
          size: [19, 4.5], angle: 0, color: 'accent', layer: 'front',
        },
      ],

      // Extra pieces bolted on as your equipment tier climbs.
      gearLooks: {
        low: [
          { id: 'tapeF', type: 'shape', joint: 'handF', shape: 'disc', size: [7, 7], color: 'trim', layer: 'front' },
          { id: 'tapeB', type: 'shape', joint: 'handB', shape: 'disc', size: [7, 7], color: 'trim', layer: 'front' },
        ],
        mid: [
          { id: 'cuffF', type: 'shape', joint: 'elbowF', shape: 'capsule', size: [9, 9], angle: 'limb', color: 'accent', layer: 'front' },
          { id: 'cuffB', type: 'shape', joint: 'elbowB', shape: 'capsule', size: [9, 9], angle: 'limb', color: 'accent', layer: 'front' },
          { id: 'shinF', type: 'shape', joint: 'shinF', shape: 'capsule', size: [9, 8], angle: 'limb', color: 'trim', layer: 'front' },
          { id: 'shinB', type: 'shape', joint: 'shinB', shape: 'capsule', size: [9, 8], angle: 'limb', color: 'trim', layer: 'back' },
        ],
        high: [
          { id: 'gauntF', type: 'shape', joint: 'handF', shape: 'tri', size: [13, 11], angle: 'limb', color: 'accent', layer: 'front' },
          { id: 'gauntB', type: 'shape', joint: 'handB', shape: 'tri', size: [13, 11], angle: 'limb', color: 'accent', layer: 'front' },
          { id: 'greaveF', type: 'shape', joint: 'shinF', shape: 'capsule', size: [11, 10], angle: 'limb', color: 'accent', layer: 'front' },
          { id: 'greaveB', type: 'shape', joint: 'shinB', shape: 'capsule', size: [11, 10], angle: 'limb', color: 'accent', layer: 'back' },
          { id: 'halo', type: 'shape', joint: 'head', shape: 'ring', radius: 17, stroke: 1.6, color: 'aura', layer: 'back' },
        ],
      },

      signature: {
        id: 'sigNineBells', name: 'Nine Bells', seq: ['K', 'P1', 'P1'],
        unlock: 1, cost: 30, duration: 76, anim: 'sigNineBells',
        desc: 'Kick, punch, punch. She drops, steps in, and rings nine straight punches off you '
          + 'before the hook lands. Hands never leave guard height.',
        fx: 'raza',
        hits: (function () {
          const out = [];
          // nine alternating straights, one every four frames
          for (let i = 0; i < 9; i++) {
            out.push({
              f: 16 + i * 4, dmg: 7, active: 2, guard: 'mid',
              hitstun: 12, blockstun: 8, kb: 14, lift: 0,
              box: { x: 16, y: i % 2 ? 68 : 64, w: 50, h: 24 },
            });
          }
          // final hook, full hip rotation
          out.push({
            f: 58, dmg: 30, active: 4, guard: 'mid',
            hitstun: 30, blockstun: 15, kb: 330, lift: 140, knockdown: true,
            box: { x: 14, y: 56, w: 70, h: 38 },
          });
          return out;
        }()),
        steps: [{ f: 10, vx: 300 }, { f: 56, vx: 140 }],
      },

      portrait: {
        w: 240, h: 260,
        shapes: [
          { t: 'rect', x: 0, y: 0, w: 240, h: 260, fill: '#F0356B' },
          { t: 'poly', pts: [[0, 190], [240, 150], [240, 260], [0, 260]], fill: '#A61E49' },
          { t: 'poly', pts: [[120, 150], [28, 60], [4, 124]], fill: '#FFC93C' },
          { t: 'poly', pts: [[120, 150], [214, 52], [238, 120]], fill: '#FFC93C' },
          { t: 'poly', pts: [[52, 260], [86, 178], [154, 178], [188, 260]], fill: '#2B0F1C' },
          { t: 'circle', x: 120, y: 118, r: 58, fill: '#2B0F1C' },
          { t: 'rect', x: 62, y: 106, w: 116, h: 15, fill: '#FFF0E6' },
          { t: 'rect', x: 62, y: 86, w: 116, h: 9, fill: '#FFC93C' },
          { t: 'rect', x: 0, y: 232, w: 240, h: 28, fill: '#FFC93C' },
        ],
        nameColor: '#2B0F1C',
      },

      blurb: 'Fastest walk and recovery in the game, thinnest health bar, quickest rage build. '
        + 'Her signature opens with a kick, so it comes out of neutral when a punch string is read.',
    },

    // ---------------------------------------------------------------- VANE
    {
      id: 'vane',
      name: 'VANE',
      title: 'Fighter 02',
      role: 'Zoner',
      tagline: 'Holds the space you want to stand in, and charges rent.',
      quote: 'Stand where I tell you to stand.',
      philosophy: 'Former tower champion who fights the floor, not the opponent. '
        + 'Every round is won in the gap.',
      recognisable: 'A tall cyan column with a violet halo, one arm always extended, two long '
        + 'coat tails falling almost to the floor. The vertical shape on the screen.',

      colors: {
        body: '#38D2F0',
        back: '#176B85',
        backBright: '#176B85',
        accent: '#B388FF',
        trim: '#F2FAFF',
        aura: '#8A5CFF',
      },

      build: {
        scale: 1.18,
        limbs: {
          thigh: 28, shin: 28, upperArm: 26, foreArm: 25,
          shoulderW: 11, hipW: 7, headR: 11, torso: 34,
          limbW: 6.5, torsoW: 9.5,
        },
      },

      // Longer reach and heavier hits, paid for with speed.
      stats: { hp: 1.12, atk: 1.10, spd: 0.88, aspd: 0.93, crit: 0, rage: 0.96, reach: 9 },

      stance: {
        lean: -3,                        // torso vertical
        armLen: 0.62, legLen: 1.0,       // lead arm long but not absurd
        idle: { amp: 3.0, hz: 1.0, hold: 0.3 },  // slow breath, hold at the top
        walk: { stride: 16, backRatio: 1.0 },    // back walk as fast as forward
        pose: {
          armF: [60, 4], armB: [-27, 187],
          legF: [19, -8], legB: [-19, 8],
        },
      },

      attachments: [
        {
          id: 'coatBack', type: 'chain', joint: 'hipB', origin: [-2, 2],
          segments: 3, length: 46, width: 9, taper: 0.55,
          angle: 265, stiffness: 0.06, gravity: 1400, damp: 0.82,
          color: 'back', layer: 'back', lenByTier: [0.62, 1, 1.08],
        },
        {
          id: 'coatFront', type: 'chain', joint: 'hipF', origin: [2, 2],
          segments: 3, length: 46, width: 9, taper: 0.55,
          angle: 275, stiffness: 0.06, gravity: 1400, damp: 0.82,
          color: 'body', layer: 'back', lenByTier: [0.62, 1, 1.08],
        },
        {
          id: 'braid', type: 'chain', joint: 'head', origin: [1, 4],
          segments: 2, length: 45, width: 5, taper: 0.6,
          angle: 268, stiffness: 0.05, gravity: 1200, damp: 0.95,
          color: 'accent', layer: 'back',
        },
        {
          id: 'halo', type: 'shape', joint: 'head', shape: 'ring',
          radius: 15.5, stroke: 1.6, color: 'accent', layer: 'back', minTier: 3,
          radiusByTier: [15.5, 15.5, 20],
        },
        {
          id: 'pauldronF', type: 'shape', joint: 'shoulderF', shape: 'arc',
          radius: 7, stroke: 4, span: 180, angle: 0, color: 'trim', layer: 'front', minTier: 3,
        },
        {
          id: 'pauldronB', type: 'shape', joint: 'shoulderB', shape: 'arc',
          radius: 7, stroke: 4, span: 180, angle: 0, color: 'trim', layer: 'back', minTier: 3,
        },
      ],

      gearLooks: {
        low: [
          { id: 'wrapF', type: 'shape', joint: 'foreArmF', shape: 'capsule', size: [9, 6], angle: 'limb', color: 'trim', layer: 'front' },
          { id: 'wrapB', type: 'shape', joint: 'foreArmB', shape: 'capsule', size: [9, 6], angle: 'limb', color: 'trim', layer: 'front' },
        ],
        mid: [
          { id: 'hipPlate', type: 'shape', joint: 'pelvis', shape: 'plate', size: [14, 7], angle: 0, color: 'accent', layer: 'front' },
          { id: 'bootF', type: 'shape', joint: 'footF', shape: 'plate', size: [10, 5], angle: 'limb', color: 'trim', layer: 'front' },
          { id: 'bootB', type: 'shape', joint: 'footB', shape: 'plate', size: [10, 5], angle: 'limb', color: 'trim', layer: 'back' },
          { id: 'sleeveF', type: 'shape', joint: 'foreArmF', shape: 'capsule', size: [11, 7], angle: 'limb', color: 'accent', layer: 'front' },
        ],
        high: [
          { id: 'blade', type: 'shape', joint: 'handF', shape: 'tri', size: [20, 9], angle: 'limb', color: 'trim', layer: 'front' },
          { id: 'collar', type: 'shape', joint: 'neck', origin: [-4, 4], shape: 'wedge', size: [14, 12], angle: 150, color: 'accent', layer: 'back' },
          { id: 'greaveF', type: 'shape', joint: 'shinF', shape: 'capsule', size: [10, 9], angle: 'limb', color: 'accent', layer: 'front' },
          { id: 'greaveB', type: 'shape', joint: 'shinB', shape: 'capsule', size: [10, 9], angle: 'limb', color: 'accent', layer: 'back' },
          { id: 'pauldron2F', type: 'shape', joint: 'shoulderF', shape: 'arc', radius: 10, stroke: 4, span: 180, angle: 0, color: 'accent', layer: 'front' },
        ],
      },

      signature: {
        id: 'sigFullStop', name: 'Full Stop', seq: ['P2', 'P1', 'K'],
        unlock: 1, cost: 28, duration: 68, anim: 'sigFullStop',
        desc: 'Cross, jab, kick. She plants, winds, holds absolutely still for six frames, '
          + 'then puts one straight arm through where your head used to be.',
        fx: 'vane',
        hits: [{
          f: 32, dmg: 62, active: 5, guard: 'mid',
          hitstun: 34, blockstun: 18, kb: 400, lift: 90,
          knockdown: true, guardCrush: 40,
          box: { x: 14, y: 46, w: 100, h: 40 },
        }],
        steps: [{ f: 30, vx: 90 }],
      },

      portrait: {
        w: 240, h: 260,
        shapes: [
          { t: 'rect', x: 0, y: 0, w: 240, h: 260, fill: '#38D2F0' },
          { t: 'poly', pts: [[0, 170], [240, 200], [240, 260], [0, 260]], fill: '#176B85' },
          { t: 'circle', x: 120, y: 76, r: 104, stroke: '#B388FF', width: 9 },
          { t: 'poly', pts: [[46, 260], [74, 182], [166, 182], [194, 260]], fill: '#0B2430' },
          { t: 'rect', x: 108, y: 150, w: 24, h: 110, fill: '#B388FF' },
          { t: 'circle', x: 120, y: 112, r: 56, fill: '#0B2430' },
          { t: 'rect', x: 64, y: 100, w: 112, h: 13, fill: '#F2FAFF' },
          { t: 'arc', x: 120, y: 146, r: 56, from: 0, to: 180, stroke: '#B388FF', width: 8 },
          { t: 'rect', x: 0, y: 234, w: 240, h: 26, fill: '#B388FF' },
        ],
        nameColor: '#0B2430',
      },

      blurb: 'Every attack box is nine units wider than anyone else\'s, so she wins trades she '
        + 'has no business winning. Slow enough that a whiff is a real invitation.',
    },

    // ------------------------------------------------------------ CLASSIC
    {
      id: 'classic',
      name: 'THE STICKMAN',
      title: 'Fighter 00',
      role: 'All-rounder',
      tagline: 'No gimmicks. No excuses. Every stat dead average, every option open.',
      quote: 'Floor one, day one.',
      philosophy: 'The baseline. If a floor is beatable, it is beatable with him.',
      recognisable: 'Plain white strokes and a blue trim. Nothing to read, nothing to telegraph.',

      colors: {
        body: '#F2F4F8', back: '#9AA3B5', backBright: '#9AA3B5',
        accent: '#6EA8FF', trim: '#C9D6EA', aura: '#6EA8FF',
      },
      build: {
        scale: 1.0,
        limbs: {
          thigh: 28, shin: 26, upperArm: 24, foreArm: 22,
          shoulderW: 9, hipW: 7, headR: 11, torso: 34,
          limbW: 7, torsoW: 8.05,
        },
      },
      stats: { hp: 1, atk: 1, spd: 1, aspd: 1, crit: 0, rage: 1, reach: 0 },
      stance: {
        lean: -2,
        idle: { amp: 1.6, hz: 1.6, hold: 0 },
        walk: { stride: 12, backRatio: 0.85 },
        pose: null,                      // uses the engine's default idle
      },
      attachments: [],
      gearLooks: { low: [], mid: [], high: [] },
      signature: null,

      portrait: {
        w: 240, h: 260,
        shapes: [
          { t: 'rect', x: 0, y: 0, w: 240, h: 260, fill: '#2A3350' },
          { t: 'poly', pts: [[0, 186], [240, 160], [240, 260], [0, 260]], fill: '#1B2138' },
          { t: 'poly', pts: [[54, 260], [88, 180], [152, 180], [186, 260]], fill: '#F2F4F8' },
          { t: 'circle', x: 120, y: 116, r: 56, fill: '#F2F4F8' },
          { t: 'circle', x: 142, y: 108, r: 9, fill: '#2A3350' },
          { t: 'rect', x: 0, y: 234, w: 240, h: 26, fill: '#6EA8FF' },
        ],
        nameColor: '#06121F',
      },

      blurb: 'No stat bias and no signature — every shared combo, thrown at face value. '
        + 'The cleanest read on what the tower actually asks of you.',
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

  /* low / mid / high band from the player's average equipped tier. */
  function tierBand(avgTier) {
    if (avgTier >= 6) return 'high';
    if (avgTier >= 3) return 'mid';
    return 'low';
  }
  const BAND_INDEX = { low: 0, mid: 1, high: 2 };

  /* The full part list to draw for a character at a given gear band. */
  function partsFor(character, band) {
    const idx = BAND_INDEX[band];
    const base = character.attachments.filter((a) => !a.minTier || idx >= BAND_INDEX.mid);
    const extra = (character.gearLooks && character.gearLooks[band]) || [];
    return base.concat(extra);
  }

  root.ST = root.ST || {};
  root.ST.Characters = { CHARACTERS, BY_ID, get, specialsFor, tierBand, partsFor, BAND_INDEX };
})(window);
