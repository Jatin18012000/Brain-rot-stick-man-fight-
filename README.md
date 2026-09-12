# Stickman Tower — 100 Floor Fighter

A stickman fighting game. One hundred floors, one boss per floor, and the only
way up is through them. Win fights, bank the coins, buy the gear and training
that makes the next boss a fair fight, climb again.

Built to be played with thumbs on an iPhone, with a keyboard on a laptop, or
with a controller on either. No app store, no accounts, no network — it
installs to the home screen and runs offline.

---

## Play it

**Phone / tablet (iOS, iPadOS, Android)**

1. Open the game's URL in Safari (iOS) or Chrome (Android).
2. iOS: **Share → Add to Home Screen**. Android: **⋮ → Install app**.
3. Launch it from the icon. It runs full screen with no browser chrome, and
   works with no signal once installed.

**Laptop / desktop**

- Chrome or Edge: open the URL and click **Install** in the address bar.
- Safari: **File → Add to Dock**.
- Or download **[`dist/stickman-tower.html`](dist/stickman-tower.html)** and
  double-click it. The entire game — code, styles, icon, every sound — is that
  one file. Nothing else to install.

**Publish it so your phone can reach it**

The repository ships a GitHub Actions workflow that deploys the game to GitHub
Pages. It needs Pages switched on once, by a repository admin:

**Settings → Pages → Build and deployment → Source: GitHub Actions.**

That is the only manual step, and only the repository owner can do it — a
workflow token is not permitted to create the Pages site. After that, every
push to `main` builds, verifies and publishes to:

```
https://jatin18012000.github.io/Brain-rot-stick-man-fight-/
```

**Run it locally**

```bash
git clone https://github.com/Jatin18012000/Brain-rot-stick-man-fight-.git
cd Brain-rot-stick-man-fight-
python3 -m http.server 8080      # any static server works
# open http://localhost:8080
```

A server is only needed for the offline/installable behaviour (service workers
require `http://` or `https://`). Opening `index.html` straight off disk works
fine for playing.

---

## Controls

Touch, keyboard and gamepad are all live at once — pick up a keyboard mid-fight
on an iPad and it just works. Every key is remappable in **Settings**.

| Action | Touch | Keyboard (default) | Gamepad |
| --- | --- | --- | --- |
| Move | ◀ ▶ on the pad | `←` `→` / `A` `D` | Stick or d-pad |
| Jump | ▲ | `↑` / `W` / `Space` | Up |
| Crouch | ▼ | `↓` / `S` | Down |
| Punch 1 (jab) | **P1** | `J` / `Z` | A / Cross |
| Punch 2 (cross) | **P2** | `K` / `X` | X / Square |
| Kick | **K** | `L` / `C` | B / Y |
| Block | **⛨**, or hold away from the boss | `Shift` / `B`, or hold away | L1 / R1 |
| Health tonic | **+** | `Q` / `E` | L2 |
| Pause | **❚❚** | `Esc` / `P` | Start |
| Dash | double-tap ◀ or ▶ | double-tap `←` or `→` | double-tap |

---

## How the fighting works

Standard fighting-game rules, kept honest: every attack has **startup**,
**active** and **recovery** frames, and the boss is bound by exactly the same
frame data, blocking and rage meter that you are.

- **Blocking.** Hold away from the boss. Low attacks (sweeps) must be blocked
  crouching; jumping attacks are overheads and must be blocked standing. Your
  guard bar drains as you block — empty it and you're stunned wide open.
- **Combos are button sequences.** Press `P1 → P1 → K` quickly and you perform
  *Twin Jab Sweep* rather than three separate attacks. A combo fires on its last
  button and cancels straight out of whatever you were already swinging.
- **Rage** builds as you deal and take damage. Most combos cost rage; the
  ultimate costs a lot of it.
- **Damage scales down** through a long combo, so nothing is an infinite.

### The combo list

| Sequence | Move | Unlocks | Rage |
| --- | --- | --- | --- |
| `P1 → P1 → K` | Twin Jab Sweep | Lv 1 | free |
| `P1 → P2 → K` | Rising Fang (invincible startup) | Lv 2 | 12 |
| `K → K → P2` | Cyclone Heel | Lv 3 | 16 |
| `P2 → P2 → K` | Hammer Fall (crushes guard) | Lv 4 | 18 |
| `▼ → ▶ → P1` | Shock Palm (projectile) | Lv 5 | 20 |
| `P1 → K → P1 → K` | Shadow Dance | Lv 6 | 26 |
| `▼ → ◀ → K` | Tornado Kick | Lv 7 | 24 |
| `P2 → K → P2 → K` | Iron Waltz (pierces armour) | Lv 8 | 30 |
| `▶ → ▶ → P2` | Dash Smash | Lv 9 | 22 |
| `P1 → P1 → P2 → P2 → K` | Thunder Cross | Lv 10 | 40 |
| `K → P1 → P2 → K` | Dragon Ladder (juggle) | Lv 12 | 34 |
| `P1 → P1 → P1 → P2 → P2 → K` | **Hundred Fists** (ultimate) | Lv 15 | 60 |

`tools/check-combos.mjs` proves every one of these is actually reachable — that
no short sequence steals a longer one's inputs.

---

## The climb

- **100 floors, 10 themed tiers** — the Dojo, Wet Market, Neon Alley, Rooftops,
  Frozen Vault, the Furnace, Sky Garden, Void Lab, Blood Arena, Celestial Spire.
- **Every 10th floor is a Warden**: tougher, two-phase, and it gets a 120-second
  clock instead of 99. Floor 100 is The Ascendant.
- **Six boss archetypes** — brawler, speedster, tank, zoner, grappler, trickster
  — each with its own spacing, aggression and reaction time. The AI sharpens as
  you climb: floor 1 reacts in 24 frames, floor 90 reacts in 5.
- Bosses are generated deterministically from the floor number, so floor 47 is
  the same fighter on every device.

## Spending your winnings

Clearing a floor pays enough to buy what the next floor demands. Perfect (no
damage taken), fast, and first-time clears all pay extra. Losing still pays a
consolation purse, and any cleared floor can be replayed in **TRAIN** mode for
more coins.

- **Gear** — six slots (fists, body, head, hands, feet, charm), eight tiers
  each, gated by how high you've climbed. Charms add coin-find, lifesteal and
  crit damage.
- **Training** — permanent stat levels: Vitality, Power, Toughness, Agility,
  Precision, Focus, Alchemy.
- **Tonics** — restore 35% health mid-fight.

The tower screen rates the next boss against you: *favoured*, *fair fight*,
*risky*, or *underpowered*. `tools/balance.mjs` simulates a full 100-floor climb
to keep that promise honest.

---

## Project layout

```
index.html              shell, meta tags, boot
styles.css              layout and UI skin (safe-area aware)
manifest.webmanifest    PWA manifest
sw.js                   offline cache
src/util.js             maths, seeded RNG, storage
src/audio.js            every sound, synthesised with WebAudio
src/input.js            touch + keyboard + gamepad -> one action set
src/moves.js            frame data and combo recipes
src/floors.js           the 100 bosses
src/progress.js         save data, shop catalogue, economy
src/fighter.js          physics, state machine, hit/hurt boxes
src/ai.js               boss brain
src/render.js           skeletal stickman animation, arenas, FX
src/hud.js              in-fight HUD
src/ui.js               menus, tower map, shop, settings
src/game.js             match engine and game loop
tools/                  build + verification scripts
```

No build step, no dependencies, no frameworks. Plain scripts so the game also
runs straight off the filesystem.

## Tools

```bash
node tools/check-combos.mjs        # prove every combo is performable
node tools/balance.mjs --all       # simulate the 100-floor economy
node tools/build-standalone.mjs    # -> dist/stickman-tower.html
python3 tools/make-icons.py        # regenerate the app icons
```

## Saving

Progress, settings and key bindings live in `localStorage` on the device you
play on. There's an **Erase all progress** button in Settings.
