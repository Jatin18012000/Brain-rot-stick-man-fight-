/* Stickman Tower — shared helpers
 * Loaded as a classic script so the game also runs from file:// (no module CORS).
 */
(function (root) {
  'use strict';

  const U = {};

  U.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
  U.rad = (deg) => (deg * Math.PI) / 180;

  // Move `v` toward `target` by at most `step`.
  U.approach = (v, target, step) => {
    if (v < target) return Math.min(v + step, target);
    if (v > target) return Math.max(v - step, target);
    return target;
  };

  // Smoothstep-ish easing used by pose interpolation.
  U.ease = (t) => t * t * (3 - 2 * t);
  U.easeOut = (t) => 1 - (1 - t) * (1 - t);
  U.easeIn = (t) => t * t;

  // Deterministic PRNG so every floor generates the same boss on every device.
  U.rng = function (seed) {
    let a = seed >>> 0;
    const fn = function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    fn.range = (lo, hi) => lo + fn() * (hi - lo);
    fn.int = (lo, hi) => Math.floor(lo + fn() * (hi - lo + 1));
    fn.pick = (arr) => arr[Math.floor(fn() * arr.length) % arr.length];
    fn.chance = (p) => fn() < p;
    return fn;
  };

  U.aabb = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  U.rectCenter = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

  // 12345 -> "12,345"
  U.comma = (n) => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  U.pad2 = (n) => (n < 10 ? '0' + n : '' + n);

  U.time = (seconds) => {
    const s = Math.max(0, Math.ceil(seconds));
    return U.pad2(Math.floor(s / 60)) + ':' + U.pad2(s % 60);
  };

  // Roman numerals for equipment tiers (I..X).
  U.roman = (n) => ['0','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][n] || String(n);

  U.storage = {
    read(key, fallback) {
      try {
        const raw = root.localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    write(key, value) {
      try {
        root.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      try { root.localStorage.removeItem(key); } catch (e) { /* private mode */ }
    },
  };

  root.ST = root.ST || {};
  root.ST.U = U;
})(window);
