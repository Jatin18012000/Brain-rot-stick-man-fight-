/* Stickman Tower — in-fight HUD drawn on the canvas (health, rage, guard,
 * combo counter, announcements). Menus live in the DOM; this is the overlay
 * that has to sit inside the letterboxed game view. */
(function (root) {
  'use strict';

  const U = root.ST.U;
  const R = root.ST.Render;
  const W = R.W;

  const HUD = {};

  function bar(ctx, x, y, w, h, pct, color, bgColor, flip, ghost) {
    ctx.fillStyle = bgColor || 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, w, h);
    const fw = Math.max(0, Math.min(1, pct)) * (w - 4);
    if (ghost !== undefined && ghost > pct) {
      const gw = Math.max(0, Math.min(1, ghost)) * (w - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      if (flip) ctx.fillRect(x + w - 2 - gw, y + 2, gw, h - 4);
      else ctx.fillRect(x + 2, y + 2, gw, h - 4);
    }
    ctx.fillStyle = color;
    if (flip) ctx.fillRect(x + w - 2 - fw, y + 2, fw, h - 4);
    else ctx.fillRect(x + 2, y + 2, fw, h - 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function segBar(ctx, x, y, w, h, pct, color, flip, segments) {
    const segs = segments || 10;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, w, h);
    const sw = (w - 4) / segs;
    for (let i = 0; i < segs; i++) {
      const on = pct >= (i + 1) / segs;
      const partial = !on && pct > i / segs;
      if (!on && !partial) continue;
      const frac = on ? 1 : (pct - i / segs) * segs;
      const sx = flip ? x + w - 2 - (i + 1) * sw : x + 2 + i * sw;
      ctx.fillStyle = color;
      ctx.globalAlpha = on ? 1 : 0.55;
      ctx.fillRect(flip ? sx + sw * (1 - frac) : sx, y + 2, sw * frac - 1, h - 4);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  HUD.draw = function (ctx, g) {
    const p = g.player, b = g.boss;
    const barW = 360, barH = 20;

    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // ---- player side
    ctx.font = '700 15px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillText(p.name.toUpperCase() + '  Lv.' + g.save.level, 24, 34);
    bar(ctx, 24, 42, barW, barH, p.hp / p.maxHp, '#4ade80', null, false, g.ghostP);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, 28, 57);

    segBar(ctx, 24, 68, 240, 10, p.meter / 100, p.meter >= 100 ? '#ffd166' : '#ff9f1c', false, 4);
    ctx.fillStyle = p.meter >= 100 ? '#ffd166' : 'rgba(255,255,255,0.6)';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText('RAGE', 270, 77);

    segBar(ctx, 24, 82, 200, 7, p.guard / 100, p.guard < 30 ? '#ff5c7c' : '#7bdff2', false, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('GUARD', 230, 89);

    // tonics
    for (let i = 0; i < g.tonics; i++) {
      ctx.fillStyle = '#7ee787';
      ctx.beginPath(); ctx.arc(32 + i * 18, 104, 6, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.4; ctx.stroke();
    }
    if (g.tonics > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.fillText('TONIC', 32 + g.tonics * 18 + 4, 108);
    }

    // ---- boss side
    ctx.textAlign = 'right';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(b.name.toUpperCase(), W - 24, 34);
    const bossBarColor = g.bossInfo.isRival ? g.bossInfo.colors.body
      : (g.bossInfo.warden || g.bossInfo.final) ? '#ff4d6d' : '#ff7b54';
    bar(ctx, W - 24 - barW, 42, barW, barH, b.hp / b.maxHp, bossBarColor, null, true, g.ghostB);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(g.bossInfo.title + '  •  ' + g.bossInfo.arch, W - 28, 76);
    segBar(ctx, W - 24 - 240, 82, 240, 8, b.meter / 100, '#ff9f1c', true, 4);

    // ---- centre: floor + timer
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, W / 2 - 62, 16, 124, 56, 10);
    ctx.fill();
    ctx.fillStyle = g.bossInfo.final ? '#ffd76e' : '#fff';
    ctx.font = '900 30px system-ui, sans-serif';
    ctx.fillText(U.time(g.timer), W / 2, 46);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText('FLOOR ' + g.bossInfo.floor + ' / 100', W / 2, 64);

    // ---- combo counter
    if (g.comboCount >= 2 && g.comboTimer > 0) {
      const a = U.clamp(g.comboTimer / 0.4, 0, 1);
      ctx.globalAlpha = a;
      ctx.textAlign = 'left';
      const cy = 210;
      ctx.fillStyle = '#ffd166';
      ctx.font = '900 46px system-ui, sans-serif';
      ctx.fillText(g.comboCount, 40, cy);
      ctx.fillStyle = '#fff';
      ctx.font = '800 18px system-ui, sans-serif';
      ctx.fillText('HITS', 40 + ctx.measureText(String(g.comboCount)).width + 26, cy - 4);
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(Math.round(g.comboDamage) + ' DMG', 40, cy + 18);
      ctx.globalAlpha = 1;
    }

    // ---- special name banner
    if (g.specialBanner && g.specialBannerT > 0) {
      const a = U.clamp(g.specialBannerT / 0.5, 0, 1);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.font = '900 30px system-ui, sans-serif';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(g.specialBanner, W / 2, 150);
      ctx.fillText(g.specialBanner, W / 2, 150);
      ctx.globalAlpha = 1;
    }

    // ---- combo hint strip (what you can do right now)
    if (g.hintT > 0 && g.hint && g.announceT <= 0 && g.specialBannerT <= 0) {
      const a = U.clamp(g.hintT, 0, 1);
      ctx.globalAlpha = a * 0.92;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const text = g.hint;
      ctx.font = '700 15px system-ui, sans-serif';
      const tw = ctx.measureText(text).width;
      roundRect(ctx, W / 2 - tw / 2 - 14, 178, tw + 28, 28, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(text, W / 2, 197);
      ctx.globalAlpha = 1;
    }

    // ---- big announcements
    if (g.announce && g.announceT > 0) {
      const t = 1 - U.clamp(g.announceT / g.announceMax, 0, 1);
      const scale = 1 + (1 - U.easeOut(U.clamp(t * 3, 0, 1))) * 0.8;
      ctx.save();
      ctx.translate(W / 2, 240);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.font = '900 64px system-ui, sans-serif';
      ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(g.announce, 0, 0);
      const grad = ctx.createLinearGradient(0, -40, 0, 20);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(1, g.announceColor || '#ffd166');
      ctx.fillStyle = grad;
      ctx.fillText(g.announce, 0, 0);
      if (g.announceSub) {
        ctx.font = '700 20px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(g.announceSub, 0, 34);
      }
      ctx.restore();
    }

    ctx.restore();
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  HUD.roundRect = roundRect;

  root.ST = root.ST || {};
  root.ST.HUD = HUD;
})(window);
