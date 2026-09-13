/* Stickman Tower — save data, stats, shop catalogue and economy.
 *
 * Economy is tuned so that clearing floor N funds roughly the upgrades you
 * need for floor N+1: gear costs grow ~1.9x per tier, training ~1.1-1.15x per
 * level, and coin income grows linearly+quadratically with floor depth.
 */
(function (root) {
  'use strict';

  const U = root.ST.U;
  const SAVE_KEY = 'st.save.v1';

  // ---------------------------------------------------------- stat training
  const TRAINING = [
    { id: 'hp',   name: 'Vitality',   max: 60, base: 68,  ratio: 1.075, per: '+12 Max HP',       icon: 'HP' },
    { id: 'atk',  name: 'Power',      max: 45, base: 90,  ratio: 1.09,  per: '+4% Attack',       icon: 'ATK' },
    { id: 'def',  name: 'Toughness',  max: 45, base: 85,  ratio: 1.09,  per: '+3 Defence',       icon: 'DEF' },
    { id: 'spd',  name: 'Agility',    max: 18, base: 275, ratio: 1.13,  per: '+4% Speed, faster recovery', icon: 'SPD' },
    { id: 'crit', name: 'Precision',  max: 20, base: 140, ratio: 1.12,  per: '+2% Critical chance', icon: 'CRT' },
    { id: 'rage', name: 'Focus',      max: 16, base: 200, ratio: 1.13,  per: '+8% Rage gain',    icon: 'RGE' },
    { id: 'pot',  name: 'Alchemy',    max: 4,  base: 320, ratio: 2.05,  per: '+1 Tonic per fight', icon: 'TNC' },
  ];
  const TRAINING_BY_ID = {};
  TRAINING.forEach((t) => { TRAINING_BY_ID[t.id] = t; });

  function trainingCost(id, level) {
    const t = TRAINING_BY_ID[id];
    if (!t) return Infinity;
    return Math.round(t.base * Math.pow(t.ratio, level));
  }

  // ------------------------------------------------------------- equipment
  const SLOTS = [
    { id: 'weapon', name: 'Fists',  costMul: 1.30, icon: '01' },
    { id: 'armor',  name: 'Body',   costMul: 1.20, icon: '02' },
    { id: 'head',   name: 'Head',   costMul: 1.00, icon: '03' },
    { id: 'gloves', name: 'Hands',  costMul: 1.00, icon: '04' },
    { id: 'boots',  name: 'Feet',   costMul: 1.00, icon: '05' },
    { id: 'charm',  name: 'Charm',  costMul: 1.10, icon: '06' },
  ];

  const TIER_FLOOR = [1, 8, 20, 32, 44, 58, 72, 86];

  const ITEM_NAMES = {
    weapon: ['Hand Wraps', 'Brass Knuckles', 'Steel Gauntlets', 'Spiked Fists', 'Tiger Claws', 'Plasma Knuckles', 'Dragon Gauntlets', 'Ascendant Fists'],
    armor:  ['Cloth Vest', 'Leather Guard', 'Chain Vest', 'Plated Cuirass', 'Titan Shell', 'Aegis Plate', 'Void Carapace', 'Celestial Mail'],
    head:   ['Bandana', 'Padded Helm', 'Iron Mask', 'Focus Visor', 'Warden Helm', 'Oracle Crown', 'Null Helm', 'Halo of Ascent'],
    gloves: ['Finger Tape', "Fighter's Mitts", 'Reflex Gloves', 'Swift Wraps', 'Precision Grips', "Assassin's Gloves", 'Chrono Gloves', 'Infinity Grips'],
    boots:  ['Worn Sandals', 'Running Shoes', 'Sprint Boots', 'Spring Heels', 'Storm Treads', 'Phantom Steps', 'Gravity Boots', 'Sky Striders'],
    charm:  ['Copper Coin', 'Lucky Fang', 'Jade Idol', 'Blood Ruby', 'Phoenix Feather', 'Void Sigil', 'Star Core', 'Ascendant Seal'],
  };

  // Per-tier stat payload for each slot. Kept explicit so balance is readable.
  function itemStats(slot, tier) {
    const t = tier; // 1..8
    const s = {};
    if (slot === 'weapon') { s.atk = [10, 22, 38, 56, 76, 96, 112, 130][t - 1]; if (t >= 5) s.crit = (t - 4) * 3; }
    if (slot === 'armor')  { s.def = [8, 18, 32, 48, 64, 80, 96, 112][t - 1]; s.hp = [10, 22, 40, 62, 88, 118, 150, 190][t - 1]; }
    if (slot === 'head')   { s.def = [4, 9, 16, 24, 33, 42, 52, 62][t - 1]; s.rage = [4, 8, 13, 18, 24, 30, 37, 45][t - 1]; }
    if (slot === 'gloves') { s.aspd = [4, 8, 13, 18, 23, 28, 34, 40][t - 1]; s.crit = [2, 4, 6, 9, 12, 15, 19, 23][t - 1]; }
    if (slot === 'boots')  { s.spd = [5, 10, 16, 22, 28, 34, 41, 48][t - 1]; s.def = [2, 4, 7, 11, 15, 19, 24, 29][t - 1]; }
    if (slot === 'charm') {
      s.coin = [8, 14, 20, 26, 32, 40, 48, 58][t - 1];
      if (t >= 4) s.lifesteal = [0, 0, 0, 4, 6, 8, 11, 14][t - 1];
      if (t >= 6) s.critdmg = [0, 0, 0, 0, 0, 15, 25, 40][t - 1];
      s.hp = [6, 12, 20, 30, 42, 56, 72, 90][t - 1];
    }
    return s;
  }

  const STAT_LABEL = {
    atk: 'Attack', def: 'Defence', hp: 'Max HP', spd: 'Speed', crit: 'Crit',
    rage: 'Rage gain', aspd: 'Attack speed', coin: 'Coin find', lifesteal: 'Lifesteal', critdmg: 'Crit damage',
  };
  const STAT_SUFFIX = { atk: '%', spd: '%', crit: '%', rage: '%', aspd: '%', coin: '%', lifesteal: '%', critdmg: '%', def: '', hp: '' };

  const ITEMS = [];
  const ITEM_BY_ID = {};
  SLOTS.forEach((slot) => {
    for (let t = 1; t <= 8; t++) {
      const id = slot.id + t;
      const item = {
        id,
        slot: slot.id,
        tier: t,
        name: ITEM_NAMES[slot.id][t - 1],
        floor: TIER_FLOOR[t - 1],
        cost: Math.round(75 * Math.pow(1.9, t - 1) * slot.costMul),
        stats: itemStats(slot.id, t),
      };
      ITEMS.push(item);
      ITEM_BY_ID[id] = item;
    }
  });

  const TONIC_COST = 120;

  // ------------------------------------------------------------ save state
  function freshSave() {
    return {
      v: 1,
      character: null,        // chosen on first play
      floor: 1,
      highest: 1,
      cleared: 0,
      coins: 0,
      xp: 0,
      level: 1,
      train: { hp: 0, atk: 0, def: 0, spd: 0, crit: 0, rage: 0, pot: 0 },
      owned: ['weapon1'],
      equipped: { weapon: 'weapon1', armor: null, head: null, gloves: null, boots: null, charm: null },
      tonics: 1,
      stats: { wins: 0, losses: 0, perfect: 0, coinsEarned: 0, bestCombo: 0, specials: 0 },
      seen: {},
      createdAt: Date.now(),
    };
  }

  const P = {
    data: freshSave(),

    load() {
      const saved = U.storage.read(SAVE_KEY, null);
      if (saved && saved.v === 1) {
        const fresh = freshSave();
        P.data = Object.assign(fresh, saved);
        P.data.train = Object.assign(fresh.train, saved.train || {});
        P.data.equipped = Object.assign(fresh.equipped, saved.equipped || {});
        P.data.stats = Object.assign(fresh.stats, saved.stats || {});
      }
      return P.data;
    },
    save() { U.storage.write(SAVE_KEY, P.data); },
    reset() { P.data = freshSave(); P.save(); },

    // -------------------------------------------------------- derived stats
    gearStats() {
      const out = { atk: 0, def: 0, hp: 0, spd: 0, crit: 0, rage: 0, aspd: 0, coin: 0, lifesteal: 0, critdmg: 0 };
      for (const slot in P.data.equipped) {
        const id = P.data.equipped[slot];
        if (!id || !ITEM_BY_ID[id]) continue;
        const st = ITEM_BY_ID[id].stats;
        for (const k in st) out[k] += st[k];
      }
      return out;
    },

    /* The single source of truth for what the player fighter is made of. */
    combat() {
      const d = P.data;
      const g = P.gearStats();
      const lvl = d.level;
      const maxHp = 160 + d.train.hp * 12 + g.hp + (lvl - 1) * 2;
      const atkMul = (1 + d.train.atk * 0.04 + (lvl - 1) * 0.005) * (1 + g.atk / 100);
      const def = d.train.def * 3 + g.def;
      const spdMul = (1 + d.train.spd * 0.04) * (1 + g.spd / 100);
      const aspdMul = 1 + d.train.spd * 0.015 + g.aspd / 100;
      const crit = Math.min(0.75, d.train.crit * 0.02 + g.crit / 100);
      const critDmg = 1.6 + g.critdmg / 100;
      const rageMul = (1 + d.train.rage * 0.08) * (1 + g.rage / 100);

      // The chosen character tilts the same numbers rather than replacing them,
      // so gear and training mean the same thing whoever you pick.
      const cs = root.ST.Characters.get(d.character).stats;
      return {
        maxHp: Math.round(maxHp * cs.hp),
        atkMul: atkMul * cs.atk,
        def,
        dr: def / (def + 110),          // damage reduction 0..1
        spdMul: spdMul * cs.spd,
        aspdMul: aspdMul * cs.aspd,
        crit: Math.min(0.8, crit + cs.crit),
        critDmg,
        rageMul: rageMul * cs.rage,
        reach: cs.reach || 0,
        lifesteal: g.lifesteal / 100,
        coinMul: 1 + g.coin / 100,
        tonics: 1 + d.train.pot,
      };
    },

    /* Rough "how strong am I" number, compared against boss power in the UI. */
    power() {
      const c = P.combat();
      return Math.round(
        c.maxHp * 0.45 + c.atkMul * 140 + c.def * 1.6 + c.crit * 120 + c.spdMul * 40
        + c.reach * 3 + P.data.level * 6
      );
    },

    // ------------------------------------------------------------- economy
    xpToNext(level) { return 60 + 30 * (level || P.data.level); },

    addXp(amount) {
      const d = P.data;
      d.xp += amount;
      const gained = [];
      while (d.xp >= P.xpToNext(d.level)) {
        d.xp -= P.xpToNext(d.level);
        d.level++;
        gained.push(d.level);
      }
      return gained;
    },

    /* Combos unlock with level so floor 1 isn't a wall of options. The chosen
     * character's signature is always in the list — it is who they are. */
    allSpecials() {
      return root.ST.Characters.specialsFor(P.data.character);
    },
    unlockedSpecials() {
      return P.allSpecials().filter((s) => s.unlock <= P.data.level);
    },
    newlyUnlockedAt(level) {
      return P.allSpecials().filter((s) => s.unlock === level);
    },

    character() { return root.ST.Characters.get(P.data.character); },
    chooseCharacter(id) {
      P.data.character = id;
      P.save();
    },

    canBuyItem(item) {
      const d = P.data;
      if (d.owned.indexOf(item.id) !== -1) return 'owned';
      if (d.highest < item.floor) return 'locked';
      if (d.coins < item.cost) return 'poor';
      return 'ok';
    },

    buyItem(item) {
      if (P.canBuyItem(item) !== 'ok') return false;
      P.data.coins -= item.cost;
      P.data.owned.push(item.id);
      P.data.equipped[item.slot] = item.id;   // auto-equip: it's always an upgrade
      P.save();
      return true;
    },

    equip(item) {
      if (P.data.owned.indexOf(item.id) === -1) return false;
      P.data.equipped[item.slot] = item.id;
      P.save();
      return true;
    },

    canTrain(id) {
      const t = TRAINING_BY_ID[id];
      const lvl = P.data.train[id] || 0;
      if (lvl >= t.max) return 'max';
      if (P.data.coins < trainingCost(id, lvl)) return 'poor';
      return 'ok';
    },

    train(id) {
      if (P.canTrain(id) !== 'ok') return false;
      const lvl = P.data.train[id] || 0;
      P.data.coins -= trainingCost(id, lvl);
      P.data.train[id] = lvl + 1;
      P.save();
      return true;
    },

    buyTonic() {
      const max = P.combat().tonics;
      if (P.data.tonics >= max) return 'max';
      if (P.data.coins < TONIC_COST) return 'poor';
      P.data.coins -= TONIC_COST;
      P.data.tonics++;
      P.save();
      return 'ok';
    },

    /* Reward for clearing a floor. Perfect + speed bonuses reward clean play. */
    rewardFor(floor, opts) {
      const o = opts || {};
      const boss = root.ST.Floors.get(floor);
      const base = Math.round((90 + 26 * floor) * (boss.warden ? 2.4 : 1) * (boss.final ? 4 : 1));
      const perfect = o.perfect ? Math.round(base * 0.5) : 0;
      const speed = o.fast ? Math.round(base * 0.25) : 0;
      const first = o.first ? Math.round(base * 0.35) : 0;
      const mult = P.combat().coinMul;
      const coins = Math.round((base + perfect + speed + first) * mult);
      const xp = Math.round((40 + 14 * floor) * (boss.warden ? 2 : 1) * (boss.final ? 3 : 1));
      return { base, perfect, speed, first, coins, xp, mult };
    },

    recordWin(floor, reward, extra) {
      const d = P.data;
      d.coins += reward.coins;
      d.stats.coinsEarned += reward.coins;
      d.stats.wins++;
      if (extra && extra.perfect) d.stats.perfect++;
      if (extra && extra.bestCombo > d.stats.bestCombo) d.stats.bestCombo = extra.bestCombo;
      const levels = P.addXp(reward.xp);
      d.cleared = Math.max(d.cleared, floor);
      if (floor >= d.highest) {
        d.highest = Math.min(100, floor + 1);
        d.floor = Math.min(100, floor + 1);
      }
      P.save();
      return levels;
    },

    recordLoss() {
      P.data.stats.losses++;
      P.save();
    },
  };

  root.ST = root.ST || {};
  root.ST.Progress = P;
  root.ST.Shop = {
    TRAINING, TRAINING_BY_ID, trainingCost, SLOTS, ITEMS, ITEM_BY_ID,
    STAT_LABEL, STAT_SUFFIX, TIER_FLOOR, TONIC_COST,
  };
})(window);
