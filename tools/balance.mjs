/* Simulates a full 100-floor climb to check the economy.
 *
 * The promise of the design is: winning a floor pays for the upgrades you need
 * to make the next floor a fair fight. This walks that, buying greedily by
 * power-per-coin, and prints your power against each boss's.
 *
 *   node tools/balance.mjs          # summary
 *   node tools/balance.mjs --all    # every floor
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const store = new Map();
const win = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
};
for (const f of ['util.js', 'moves.js', 'floors.js', 'progress.js']) {
  new Function('window', readFileSync(join(root, 'src', f), 'utf8'))(win);
}
const { Progress, Shop, Floors } = win.ST;

Progress.data.coins = 0;

function bestPurchase() {
  let best = null;
  const basePower = Progress.power();
  for (const item of Shop.ITEMS) {
    if (Progress.canBuyItem(item) !== 'ok') continue;
    const prevEquipped = Progress.data.equipped[item.slot];
    Progress.data.equipped[item.slot] = item.id;
    const gain = Progress.power() - basePower;
    Progress.data.equipped[item.slot] = prevEquipped;
    if (gain <= 0) continue;
    const value = gain / item.cost;
    if (!best || value > best.value) best = { kind: 'item', item, value, cost: item.cost };
  }
  for (const t of Shop.TRAINING) {
    if (t.id === 'pot') continue;
    if (Progress.canTrain(t.id) !== 'ok') continue;
    const lvl = Progress.data.train[t.id];
    const cost = Shop.trainingCost(t.id, lvl);
    Progress.data.train[t.id] = lvl + 1;
    const gain = Progress.power() - basePower;
    Progress.data.train[t.id] = lvl;
    if (gain <= 0) continue;
    const value = gain / cost;
    if (!best || value > best.value) best = { kind: 'train', id: t.id, value, cost };
  }
  return best;
}

function spend() {
  let guard = 0;
  while (guard++ < 500) {
    const buy = bestPurchase();
    if (!buy) break;
    if (buy.kind === 'item') Progress.buyItem(buy.item);
    else Progress.train(buy.id);
  }
}

const all = process.argv.includes('--all');
const rows = [];
let worst = { ratio: Infinity, floor: 0 };

for (let floor = 1; floor <= 100; floor++) {
  spend();                                   // shop before the fight
  const boss = Floors.get(floor);
  const mine = Progress.power();
  const ratio = mine / boss.power;
  if (ratio < worst.ratio) worst = { ratio, floor };

  // Rough time-to-kill both ways. A competent player lands about 1.1 normals a
  // second (avg 12 base damage) plus a ~80 base damage combo every 6 seconds;
  // the boss lands about 0.75 hits a second and roughly a third are blocked.
  const c = Progress.combat();
  const playerBasePerSec = 1.1 * 12 + 80 / 6;
  const playerDps = playerBasePerSec * c.atkMul * (1 - boss.dr);
  const bossBasePerSec = 0.75 * 11 * (1 - 0.33);
  const bossDps = bossBasePerSec * boss.atkMul * (1 - c.dr);
  const ttkBoss = boss.hp / playerDps;
  const ttkMe = c.maxHp / bossDps;

  rows.push({ floor, mine, boss: boss.power, ratio, coins: Progress.data.coins, lvl: Progress.data.level, ttkBoss, ttkMe });

  // Assume an ordinary clear: first time, not perfect, not especially fast.
  const reward = Progress.rewardFor(floor, { perfect: false, fast: false, first: true });
  Progress.recordWin(floor, reward, { perfect: false, bestCombo: 4 });
}

const fmt = (r) => `floor ${String(r.floor).padStart(3)}  you ${String(r.mine).padStart(6)}  boss ${String(r.boss).padStart(6)}`
  + `  ratio ${r.ratio.toFixed(2)}  lv${String(r.lvl).padStart(2)}`
  + `  kill ${r.ttkBoss.toFixed(0)}s  survive ${r.ttkMe.toFixed(0)}s  bank ${r.coins}`;
if (all) rows.forEach((r) => console.log(fmt(r)));
else [1, 2, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99, 100].forEach((f) => console.log(fmt(rows[f - 1])));

const ratios = rows.map((r) => r.ratio);
const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
console.log('\naverage power ratio %s, worst %s at floor %d, final level %d',
  avg.toFixed(2), worst.ratio.toFixed(2), worst.floor, Progress.data.level);
const spikes = rows.filter((r) => r.ratio < 0.72);
console.log(spikes.length ? 'difficulty spikes at floors: ' + spikes.map((r) => r.floor).join(', ') : 'no difficulty spikes below 0.72');

const tooLong = rows.filter((r) => r.ttkBoss > 90);
const tooFragile = rows.filter((r) => r.ttkMe < r.ttkBoss * 1.1);
console.log(tooLong.length ? 'may time out (>90s to kill): floors ' + tooLong.map((r) => r.floor).join(', ') : 'every boss is killable inside the 99s clock');
console.log(tooFragile.length ? 'player dies first at floors: ' + tooFragile.map((r) => r.floor).join(', ') : 'player out-survives every boss');
const fastest = rows.reduce((a, b) => (a.ttkBoss < b.ttkBoss ? a : b));
const slowest = rows.reduce((a, b) => (a.ttkBoss > b.ttkBoss ? a : b));
console.log(`quickest kill ${fastest.ttkBoss.toFixed(0)}s (floor ${fastest.floor}), `
  + `slowest ${slowest.ttkBoss.toFixed(0)}s (floor ${slowest.floor})`);
console.log('note: these are damage-model estimates; real fights run longer once '
  + 'whiffs, blocking and knockdowns are counted, which is why wardens get a 120s clock.');
