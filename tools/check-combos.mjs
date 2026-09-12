/* Verifies every combo recipe can actually be performed.
 *
 * The matcher takes the longest recipe that matches the tail of your recent
 * inputs. That means a short recipe is only a problem if it matches STRICTLY
 * EARLIER than a longer one completes — a tie on the final button is fine,
 * because the longer recipe wins. This script proves no recipe is stolen.
 *
 *   node tools/check-combos.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sandbox = { ST: {} };
new Function('window', readFileSync(join(root, 'src/moves.js'), 'utf8'))(sandbox);
const { SPECIALS, SPECIALS_BY_LENGTH } = sandbox.ST.Moves;

const BUTTONS = new Set(['P1', 'P2', 'K']);

/* Mirrors matchSpecial() in src/game.js. */
function match(tokens, level) {
  const buttonsOnly = tokens.filter((t) => BUTTONS.has(t));
  for (const sp of SPECIALS_BY_LENGTH) {
    if (sp.unlock > level) continue;
    const src = sp.motion ? tokens : buttonsOnly;
    if (src.length < sp.seq.length) continue;
    const tail = src.slice(src.length - sp.seq.length);
    if (tail.every((t, i) => t === sp.seq[i])) return sp;
  }
  return null;
}

let failures = 0;
const MAX_LEVEL = 99;

for (const sp of SPECIALS) {
  // Every prefix shorter than the full recipe must NOT fire anything.
  for (let n = 1; n < sp.seq.length; n++) {
    const hit = match(sp.seq.slice(0, n), MAX_LEVEL);
    if (hit) {
      console.error(`FAIL  ${sp.name} [${sp.seq.join(' ')}] is stolen at input ${n} by ${hit.name} [${hit.seq.join(' ')}]`);
      failures++;
    }
  }
  const full = match(sp.seq, MAX_LEVEL);
  if (!full || full.id !== sp.id) {
    console.error(`FAIL  ${sp.name} [${sp.seq.join(' ')}] resolves to ${full ? full.name : 'nothing'}`);
    failures++;
  } else {
    console.log(`ok    ${sp.name.padEnd(16)} ${sp.seq.join(' → ').padEnd(26)} lv${sp.unlock} ${sp.cost} rage`);
  }
}

// Sanity: recipes should not fire below their unlock level.
for (const sp of SPECIALS) {
  if (sp.unlock <= 1) continue;
  const hit = match(sp.seq, sp.unlock - 1);
  if (hit && hit.id === sp.id) {
    console.error(`FAIL  ${sp.name} fires at level ${sp.unlock - 1}, before it unlocks`);
    failures++;
  }
}

console.log(failures ? `\n${failures} problem(s)` : `\nall ${SPECIALS.length} combos reachable`);
process.exit(failures ? 1 : 0);
