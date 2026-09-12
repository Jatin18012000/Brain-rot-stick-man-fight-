/* Stickman Tower — the 100 floors and the boss that owns each one.
 *
 * Everything is derived deterministically from the floor number, so floor 47
 * is the same fighter on your phone, your iPad and your laptop.
 */
(function (root) {
  'use strict';

  const U = root.ST.U;

  const TIERS = [
    { name: 'The Dojo',        sky: ['#2a3550', '#141a2b'], ground: '#1d2436', accent: '#6ea8ff', deco: 'dojo' },
    { name: 'Wet Market',      sky: ['#243a33', '#101a17'], ground: '#18251f', accent: '#5fe2a0', deco: 'market' },
    { name: 'Neon Alley',      sky: ['#2a1738', '#12091c'], ground: '#1d1229', accent: '#ff5cf0', deco: 'neon' },
    { name: 'Rooftops',        sky: ['#1b2b46', '#0d1526'], ground: '#16203a', accent: '#8fd4ff', deco: 'roof' },
    { name: 'Frozen Vault',    sky: ['#1d3a4a', '#0b1a24'], ground: '#16303d', accent: '#a8ecff', deco: 'ice' },
    { name: 'The Furnace',     sky: ['#3d1a12', '#1a0a07'], ground: '#2a1009', accent: '#ff9a3c', deco: 'fire' },
    { name: 'Sky Garden',      sky: ['#213d2c', '#0e1b14'], ground: '#1a2e21', accent: '#a8ff9a', deco: 'garden' },
    { name: 'Void Lab',        sky: ['#1a1a2e', '#08080f'], ground: '#141425', accent: '#b48cff', deco: 'lab' },
    { name: 'Blood Arena',     sky: ['#3a1420', '#170810'], ground: '#28101a', accent: '#ff4d6d', deco: 'arena' },
    { name: 'Celestial Spire', sky: ['#2b2350', '#0f0c20'], ground: '#1e1a3c', accent: '#ffd76e', deco: 'spire' },
  ];
  TIERS[0].fog = '#3a4560';

  const FIRST = ['Tin-Can', 'Wobbly', 'Broom', 'Chunky', 'Sticky', 'Rusty', 'Grim', 'Iron', 'Mad', 'Silent',
    'Crimson', 'Jagged', 'Hollow', 'Neon', 'Frost', 'Ember', 'Thorn', 'Static', 'Obsidian', 'Pale',
    'Vulture', 'Granite', 'Razor', 'Cinder', 'Vapor', 'Onyx', 'Solar', 'Gloom', 'Vex', 'Zero'];
  const SECOND = ['Tony', 'Pete', 'Barry', 'Doug', 'Maz', 'Ruko', 'Vance', 'Kade', 'Silva', 'Orin',
    'Rhea', 'Dax', 'Nyx', 'Juno', 'Kobi', 'Wren', 'Sable', 'Quill', 'Ash', 'Rook',
    'Viper', 'Talon', 'Crane', 'Mantis', 'Bishop', 'Halo', 'Echo', 'Nova', 'Riven', 'Sol'];
  const TITLES = ['the Doorman', 'the Bruiser', 'the Quick', 'the Wall', 'the Hungry', 'the Unblinking',
    'the Twice-Broken', 'the Loud', 'the Patient', 'the Sharpened', 'the Untouched', 'the Relentless',
    'of the Low Guard', 'of Nine Ribs', 'the Iron Jaw', 'the Whisper', 'the Landslide', 'the Firestarter',
    'the Long Reach', 'the Closer'];
  const WARDEN_NAMES = ['Warden Krell', 'Warden Sova', 'Warden Bask', 'Warden Idris', 'Warden Morrow',
    'Warden Vale', 'Warden Cinder', 'Warden Nihil', 'Warden Sanguine'];

  const ARCHETYPES = {
    brawler:   { label: 'Brawler',   hp: 1.00, atk: 1.00, def: 1.00, spd: 1.00, aggr: 0.62, block: 1.0, spacing: 70,  jump: 0.10, combo: 3 },
    speedster: { label: 'Speedster', hp: 0.78, atk: 0.85, def: 0.80, spd: 1.45, aggr: 0.85, block: 0.8, spacing: 55,  jump: 0.28, combo: 4 },
    tank:      { label: 'Tank',      hp: 1.55, atk: 1.12, def: 1.50, spd: 0.72, aggr: 0.42, block: 1.5, spacing: 60,  jump: 0.02, combo: 2 },
    zoner:     { label: 'Zoner',     hp: 0.92, atk: 1.05, def: 0.95, spd: 1.05, aggr: 0.38, block: 1.2, spacing: 150, jump: 0.12, combo: 2, projectile: true },
    grappler:  { label: 'Grappler',  hp: 1.25, atk: 1.22, def: 1.10, spd: 0.92, aggr: 0.78, block: 0.9, spacing: 48,  jump: 0.06, combo: 3 },
    trickster: { label: 'Trickster', hp: 0.88, atk: 0.98, def: 0.88, spd: 1.20, aggr: 0.68, block: 1.1, spacing: 80,  jump: 0.40, combo: 4, mixup: true },
    warden:    { label: 'Warden',    hp: 1.85, atk: 1.25, def: 1.35, spd: 1.05, aggr: 0.72, block: 1.3, spacing: 65,  jump: 0.16, combo: 4, phases: 2 },
  };

  const ORDER = ['brawler', 'speedster', 'tank', 'grappler', 'trickster', 'zoner'];

  const PALETTES = [
    { body: '#ff6b6b', accent: '#ffd166' }, { body: '#4ecdc4', accent: '#ffe66d' },
    { body: '#c77dff', accent: '#80ffdb' }, { body: '#ffa45c', accent: '#ff7b9c' },
    { body: '#7ee787', accent: '#58a6ff' }, { body: '#f2c14e', accent: '#f24e4e' },
    { body: '#6ee7ff', accent: '#ff8fab' }, { body: '#ff8fab', accent: '#b8c0ff' },
    { body: '#d0d0d0', accent: '#ff4d6d' }, { body: '#ffd60a', accent: '#003566' },
  ];

  const TAUNTS = [
    'You made it up one flight. Impressive. Genuinely.',
    'Nobody climbs past me on a weekday.',
    'I have been standing here for eleven years.',
    'Your form is bad and you should feel bad.',
    'The stairs behind me are closed for maintenance.',
    'I eat stick figures like you for breakfast. Literally. Two-dimensionally.',
    'Go home. The lift is broken anyway.',
    'This floor has a strict no-climbing policy.',
    'I was told there would be a challenge.',
    'Last guy who tried this is still on the ceiling.',
    'You brought fists to a fist fight. Bold.',
    'My guard has never been broken. My ribs, often.',
    'Floor rules: you fall, you stay.',
    'I am contractually obliged to stop you.',
    'Do you even frame data, bro?',
  ];

  const cache = {};

  function get(floor) {
    floor = U.clamp(Math.round(floor), 1, 100);
    if (cache[floor]) return cache[floor];

    const rng = U.rng(floor * 9176 + 1337);
    const tierIndex = Math.min(9, Math.floor((floor - 1) / 10));
    const tier = TIERS[tierIndex];
    const isWarden = floor % 10 === 0 && floor !== 100;
    const isFinal = floor === 100;

    let archId;
    if (isWarden || isFinal) archId = 'warden';
    else archId = ORDER[(floor + Math.floor(floor / 7)) % ORDER.length];
    const arch = ARCHETYPES[archId];

    let name;
    if (isFinal) name = 'THE ASCENDANT';
    else if (isWarden) name = WARDEN_NAMES[Math.floor(floor / 10) - 1] || 'Warden';
    else name = rng.pick(FIRST) + ' ' + rng.pick(SECOND);

    const title = isFinal ? 'Keeper of the Hundredth Floor'
      : isWarden ? 'Gatekeeper of ' + tier.name
        : rng.pick(TITLES);

    // Core stat curve: gentle early, steep late, with a bump every 10 floors.
    // Tuned against tools/balance.mjs so a boss dies inside the 99s clock and
    // the player survives longer than the boss does.
    const curve = 1 + 0.07 * floor + 0.0009 * floor * floor;
    const hp = Math.round(120 * curve * arch.hp * (isFinal ? 1.35 : 1));
    const atkMul = (1 + 0.045 * floor) * arch.atk * (isFinal ? 1.15 : 1);
    const def = Math.round(floor * 1.1 * arch.def);
    const speed = 150 * arch.spd * (1 + 0.004 * floor);

    // AI sharpens as you climb: faster reactions, tighter blocks, real combos.
    const p = U.clamp((floor - 1) / 80, 0, 1);
    const ai = {
      aggression: U.clamp(arch.aggr * (0.75 + 0.45 * p), 0.2, 0.95),
      blockChance: U.clamp((0.12 + 0.52 * p) * arch.block, 0, 0.82),
      reaction: Math.round(U.lerp(24, 5, p)),          // frames before reacting
      spacing: arch.spacing + rng.range(-12, 12),
      jumpiness: arch.jump * (0.6 + 0.8 * p),
      comboLen: Math.min(5, arch.combo + (p > 0.6 ? 1 : 0)),
      specialChance: U.clamp(p * 0.42 + (isWarden || isFinal ? 0.15 : 0), 0, 0.55),
      punishWindow: Math.round(U.lerp(3, 12, p)),
      antiAir: U.clamp(0.15 + 0.6 * p, 0, 0.8),
      whiffPunish: p > 0.35,
      projectile: !!arch.projectile && floor > 12,
      mixup: !!arch.mixup,
    };

    const pal = PALETTES[(floor * 3) % PALETTES.length];
    const colors = {
      body: isFinal ? '#ffd76e' : isWarden ? '#ff4d6d' : pal.body,
      accent: isFinal ? '#fff3c4' : pal.accent,
      aura: isFinal ? '#ffd76e' : isWarden ? '#ff4d6d' : null,
    };

    const boss = {
      floor,
      name,
      title,
      archId,
      arch: arch.label,
      warden: isWarden,
      final: isFinal,
      phases: isWarden || isFinal ? 2 : 1,
      hp,
      atkMul,
      def,
      dr: def / (def + 200),      // caps late-game boss armour near 45%
      speed,
      scale: isFinal ? 1.22 : isWarden ? 1.14 : U.clamp(0.94 + rng.range(0, 0.16) + (archId === 'tank' ? 0.1 : 0), 0.9, 1.2),
      ai,
      colors,
      tier,
      tierIndex,
      taunt: isFinal ? 'One hundred floors. Let us see what you became.' : rng.pick(TAUNTS),
      power: 0,
    };

    // A player-facing threat rating on the same scale as Progress.power(), so
    // "you 900 / boss 950" genuinely means a close fight. Boss health pools are
    // much deeper than a player's by design, hence the lighter HP weight.
    boss.power = Math.round(hp * 0.17 + atkMul * 150 + def * 1.6 + speed * 0.5 + floor * 3);
    cache[floor] = boss;
    return boss;
  }

  function tierOf(floor) { return TIERS[Math.min(9, Math.floor((U.clamp(floor, 1, 100) - 1) / 10))]; }

  root.ST = root.ST || {};
  root.ST.Floors = { get, tierOf, TIERS, ARCHETYPES };
})(window);
