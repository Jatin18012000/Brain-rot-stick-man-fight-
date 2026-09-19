/* Stickman Tower — difficulty, chosen per floor.
 *
 * A level scales what the boss is made of and how sharply it thinks, and pays
 * out accordingly. It never touches your own stats, your gear or the frame
 * data: a harder floor is a harder opponent, not a nerfed player.
 */
(function (root) {
  'use strict';

  const LEVELS = [
    {
      id: 'casual', name: 'Casual', short: 'CAS',
      color: '#7ee787',
      blurb: 'A softer, slower opponent. For learning a floor, or just getting through it.',
      hp: 0.70, atk: 0.70, reaction: 1.55, aggression: 0.78, special: -0.12, reward: 0.70,
    },
    {
      id: 'standard', name: 'Standard', short: 'STD',
      color: '#6ea8ff',
      blurb: 'The tower as designed. Every number balanced against this one.',
      hp: 1.00, atk: 1.00, reaction: 1.00, aggression: 1.00, special: 0, reward: 1.00,
    },
    {
      id: 'hard', name: 'Hard', short: 'HARD',
      color: '#ffd166',
      blurb: 'Deeper health, heavier hits, and a boss that reacts before you finish the string.',
      hp: 1.35, atk: 1.25, reaction: 0.72, aggression: 1.16, special: 0.10, reward: 1.55,
    },
    {
      id: 'brutal', name: 'Brutal', short: 'BRU',
      color: '#ff5c7c',
      blurb: 'It punishes everything. Worth more than double, and you will earn it.',
      hp: 1.80, atk: 1.55, reaction: 0.52, aggression: 1.32, special: 0.18, reward: 2.30,
    },
  ];

  const BY_ID = {};
  LEVELS.forEach((d, i) => { d.index = i; BY_ID[d.id] = d; });

  const DEFAULT = 'standard';

  function get(id) { return BY_ID[id] || BY_ID[DEFAULT]; }

  /* Apply a level to a floor's generated boss numbers. */
  function scaleBoss(stats, level) {
    const d = get(level);
    return Object.assign({}, stats, {
      maxHp: Math.max(1, Math.round(stats.maxHp * d.hp)),
      atkMul: stats.atkMul * d.atk,
    });
  }

  /* Apply a level to an AI profile. Reaction is in frames, so a smaller
   * multiplier means it answers you sooner. */
  function scaleAI(profile, level) {
    const d = get(level);
    const U = root.ST.U;
    return Object.assign({}, profile, {
      reaction: Math.max(2, Math.round(profile.reaction * d.reaction)),
      aggression: U.clamp(profile.aggression * d.aggression, 0.15, 0.97),
      specialChance: U.clamp(profile.specialChance + d.special, 0, 0.75),
      blockChance: U.clamp(profile.blockChance * (0.9 + 0.12 * d.aggression), 0, 0.88),
      punishWindow: Math.max(2, Math.round(profile.punishWindow * d.reaction)),
    });
  }

  function rewardMul(level) { return get(level).reward; }

  /* The boss threat rating the tower screen compares against your power. */
  function powerMul(level) {
    const d = get(level);
    return 0.45 + 0.30 * d.hp + 0.25 * d.atk;
  }

  root.ST = root.ST || {};
  root.ST.Difficulty = { LEVELS, BY_ID, DEFAULT, get, scaleBoss, scaleAI, rewardMul, powerMul };
})(window);
