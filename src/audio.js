/* Stickman Tower — all sound is synthesised at runtime (no asset downloads,
 * so the whole game stays installable as a handful of small files). */
(function (root) {
  'use strict';

  const Audio = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    enabled: true,
    musicOn: true,
    unlocked: false,
    _musicTimer: null,
    _step: 0,
    _scale: null,
    _tempo: 0.26,
  };

  function ensure() {
    if (Audio.ctx) return Audio.ctx;
    const Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx) return null;
    Audio.ctx = new Ctx();
    Audio.master = Audio.ctx.createGain();
    Audio.master.gain.value = 0.9;
    Audio.master.connect(Audio.ctx.destination);
    Audio.sfxGain = Audio.ctx.createGain();
    Audio.sfxGain.gain.value = 0.8;
    Audio.sfxGain.connect(Audio.master);
    Audio.musicGain = Audio.ctx.createGain();
    Audio.musicGain.gain.value = 0.22;
    Audio.musicGain.connect(Audio.master);
    return Audio.ctx;
  }

  /* iOS/Safari only allow audio after a real user gesture. */
  Audio.unlock = function () {
    const ctx = ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!Audio.unlocked) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.02);
      Audio.unlocked = true;
    }
  };

  let noiseBuffer = null;
  function noise() {
    const ctx = ensure();
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    return src;
  }

  function tone(freq, dur, type, vol, slideTo, dest) {
    const ctx = ensure();
    if (!ctx || !Audio.enabled) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || Audio.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function burst(dur, vol, freq, q, type) {
    const ctx = ensure();
    if (!ctx || !Audio.enabled) return;
    const t = ctx.currentTime;
    const src = noise();
    const filt = ctx.createBiquadFilter();
    filt.type = type || 'bandpass';
    filt.frequency.setValueAtTime(freq, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.35), t + dur);
    filt.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(Audio.sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  const SFX = {
    whiffLight() { burst(0.09, 0.10, 2600, 1.2); },
    whiffHeavy() { burst(0.16, 0.15, 1500, 0.9); },
    hitLight() { burst(0.10, 0.35, 1800, 0.8); tone(150, 0.11, 'square', 0.22, 60); },
    hitHeavy() { burst(0.18, 0.5, 900, 0.7); tone(96, 0.2, 'square', 0.34, 42); },
    hitSpecial() { burst(0.26, 0.55, 600, 0.6); tone(140, 0.3, 'sawtooth', 0.3, 48); tone(320, 0.22, 'square', 0.16, 90); },
    block() { burst(0.08, 0.3, 5200, 4); tone(680, 0.06, 'square', 0.12, 520); },
    guardBreak() { burst(0.3, 0.4, 2200, 2); tone(220, 0.4, 'sawtooth', 0.24, 70); },
    jump() { tone(300, 0.13, 'sine', 0.14, 620); },
    land() { burst(0.08, 0.16, 380, 1.4); },
    knockdown() { burst(0.3, 0.4, 320, 0.7); tone(70, 0.35, 'sine', 0.3, 35); },
    ko() {
      tone(420, 0.5, 'sawtooth', 0.3, 60);
      setTimeout(() => tone(300, 0.7, 'square', 0.26, 40), 90);
      setTimeout(() => burst(0.7, 0.35, 500, 0.5), 120);
    },
    coin() { tone(1180, 0.07, 'square', 0.16); setTimeout(() => tone(1760, 0.12, 'square', 0.14), 60); },
    levelUp() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.22), i * 80));
    },
    buy() { tone(520, 0.08, 'square', 0.16); setTimeout(() => tone(780, 0.12, 'square', 0.16), 70); },
    deny() { tone(180, 0.16, 'square', 0.2, 120); },
    ui() { tone(880, 0.05, 'triangle', 0.10); },
    fight() { tone(330, 0.18, 'square', 0.28); setTimeout(() => tone(660, 0.3, 'square', 0.3), 160); },
    meterFull() { tone(700, 0.1, 'triangle', 0.16); setTimeout(() => tone(1050, 0.16, 'triangle', 0.16), 80); },
    potion() { tone(500, 0.1, 'sine', 0.2, 900); setTimeout(() => tone(900, 0.18, 'sine', 0.16, 1300), 80); },
    floorUp() {
      [392, 523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.26, 'triangle', 0.2), i * 90));
    },
  };

  Audio.play = function (name) {
    if (!Audio.enabled) return;
    const fn = SFX[name];
    if (fn) { ensure(); fn(); }
  };

  // ------------------------------------------------------------ music bed
  const SCALES = [
    [220.00, 261.63, 293.66, 329.63, 392.00, 440.00],           // A minor pentatonic-ish
    [196.00, 233.08, 261.63, 293.66, 349.23, 392.00],           // G phrygian colour
    [246.94, 293.66, 329.63, 369.99, 440.00, 493.88],           // B dorian
    [174.61, 207.65, 233.08, 261.63, 311.13, 349.23],           // F sombre
  ];

  Audio.startMusic = function (tier) {
    Audio.stopMusic();
    if (!Audio.musicOn || !Audio.enabled) return;
    const ctx = ensure();
    if (!ctx) return;
    Audio._scale = SCALES[(tier || 0) % SCALES.length];
    Audio._tempo = 0.30 - Math.min(0.10, (tier || 0) * 0.012);
    Audio._step = 0;
    const tick = () => {
      if (!Audio.musicOn || !Audio.enabled) return;
      const s = Audio._step++;
      const sc = Audio._scale;
      const rootNote = sc[0] / 2;
      if (s % 4 === 0) tone(rootNote, Audio._tempo * 2.2, 'triangle', 0.22, null, Audio.musicGain);
      if (s % 8 === 4) tone(rootNote * 1.5, Audio._tempo * 1.6, 'triangle', 0.16, null, Audio.musicGain);
      const note = sc[(s * 3 + (s % 5)) % sc.length] * (s % 16 < 8 ? 1 : 1.5);
      tone(note, Audio._tempo * 0.85, 'square', 0.055, null, Audio.musicGain);
      if (s % 2 === 0) burstMusic(0.05, 0.035, 6000);
      if (s % 8 === 0) burstMusic(0.12, 0.09, 200, 'lowpass');
    };
    tick();
    Audio._musicTimer = setInterval(tick, Audio._tempo * 1000);
  };

  function burstMusic(dur, vol, freq, type) {
    const ctx = ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = noise();
    const filt = ctx.createBiquadFilter();
    filt.type = type || 'highpass';
    filt.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(Audio.musicGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  Audio.stopMusic = function () {
    if (Audio._musicTimer) { clearInterval(Audio._musicTimer); Audio._musicTimer = null; }
  };

  Audio.setMusic = function (on) {
    Audio.musicOn = on;
    if (!on) Audio.stopMusic();
  };

  Audio.duck = function (amount, seconds) {
    if (!Audio.musicGain || !Audio.ctx) return;
    const t = Audio.ctx.currentTime;
    Audio.musicGain.gain.cancelScheduledValues(t);
    Audio.musicGain.gain.setValueAtTime(Audio.musicGain.gain.value, t);
    Audio.musicGain.gain.linearRampToValueAtTime(0.22 * amount, t + 0.05);
    Audio.musicGain.gain.linearRampToValueAtTime(0.22, t + (seconds || 0.6));
  };

  root.ST = root.ST || {};
  root.ST.Audio = Audio;
})(window);
