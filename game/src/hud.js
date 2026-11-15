// All drawing for LUMEN KEEP: the arena, the beacon, the swarm, the
// Keeper, the HUD, the banners and every screen.
//
// One job: turn the state into one readable 1280x480 frame. The HUD is
// drawn on the canvas itself so it is always in the screenshots: score
// and combo, wave and foes left, beacon HP, hearts, energy, dash pip,
// kill feed, boss bar, banners, and the title / pause / end screens.

import { ARENA, BEACON_R } from './world.js';

const FONT = "'Trebuchet MS', system-ui, sans-serif";

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.2, y + s * 0.1, x - s * 0.7, y - s * 0.9, x, y - s * 0.25);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 0.9, x + s * 1.2, y + s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

function bar(ctx, x, y, w, h, frac, fill, back) {
  ctx.fillStyle = back || 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * Math.max(0, Math.min(1, frac))), h - 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function render(ctx, state) {
  ctx.clearRect(0, 0, ARENA.w, ARENA.h);

  ctx.save();
  if (state.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawArena(ctx, state);
  drawShards(ctx, state);
  drawTelegraphs(ctx, state);
  drawBeacon(ctx, state);
  drawEnemies(ctx, state);
  drawBolts(ctx, state);
  drawPlayer(ctx, state);
  drawParticles(ctx, state);
  drawFloats(ctx, state);
  ctx.restore();

  drawHud(ctx, state);
  drawBanner(ctx, state);

  if (state.mode === 'title') drawTitle(ctx, state);
  else if (state.mode === 'paused') drawPaused(ctx, state);
  else if (state.mode === 'over') drawEnd(ctx, state, false);
  else if (state.mode === 'win') drawEnd(ctx, state, true);
}

function drawArena(ctx, state) {
  const g = ctx.createLinearGradient(0, 0, 0, ARENA.h);
  g.addColorStop(0, '#0e2f38');
  g.addColorStop(1, '#0a2229');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);

  ctx.strokeStyle = 'rgba(120,220,210,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 40; x < ARENA.w; x += 40) {
    ctx.moveTo(x, 46);
    ctx.lineTo(x, ARENA.h);
  }
  for (let y = 80; y < ARENA.h; y += 40) {
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA.w, y);
  }
  ctx.stroke();

  // Glowing runes scattered on the field, pulsing gently.
  for (const r of state.runes) {
    const a = 0.35 + 0.3 * Math.sin(state.time * 1.6 + r.phase);
    ctx.globalAlpha = a;
    ctx.fillStyle = r.hue;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Arena edge: a soft glowing border so the field reads as a place.
  ctx.strokeStyle = 'rgba(47,214,200,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 50, ARENA.w - 8, ARENA.h - 54);
}

function drawShards(ctx, state) {
  for (const s of state.shards) {
    const bob = Math.sin(state.time * 4 + s.t) * 3;
    ctx.save();
    ctx.translate(s.x, s.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 12;
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
  }
  ctx.shadowBlur = 0;
}

function drawTelegraphs(ctx, state) {
  for (const tg of state.telegraphs) {
    const p = tg.t / tg.dur;
    ctx.globalAlpha = 0.35 + 0.4 * Math.sin(state.time * 14);
    ctx.strokeStyle = '#ff5da2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tg.x, tg.y, 10 + p * 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ff5da2';
    ctx.font = 'bold 16px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', tg.x, tg.y - 1);
  }
  ctx.globalAlpha = 1;
}

function drawBeacon(ctx, state) {
  const b = state.beacon;
  const pulse = 1 + 0.08 * Math.sin(state.time * 2.4);
  const low = b.hp < 30;

  const glow = ctx.createRadialGradient(b.x, b.y, 8, b.x, b.y, 130 * pulse);
  glow.addColorStop(0, low ? 'rgba(255,93,115,0.55)' : 'rgba(255,209,102,0.55)');
  glow.addColorStop(1, 'rgba(255,209,102,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(b.x, b.y, 130 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // The crystal: a warm amber diamond with a bright core.
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = low ? '#ff5d73' : '#ffc53d';
  ctx.shadowColor = low ? '#ff5d73' : '#ffd166';
  ctx.shadowBlur = 24;
  const s = BEACON_R * pulse;
  ctx.fillRect(-s * 0.72, -s * 0.72, s * 1.44, s * 1.44);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(-s * 0.34, -s * 0.34, s * 0.68, s * 0.68);
  ctx.restore();

  // Beacon HP ring around the crystal.
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(b.x, b.y, BEACON_R + 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = low ? '#ff5d73' : '#ffd166';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(b.x, b.y, BEACON_R + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (b.hp / b.max));
  ctx.stroke();

  if (b.flash > 0) {
    ctx.globalAlpha = Math.min(1, b.flash * 3);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, BEACON_R + 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Low-HP alarm: the screen edges glow red.
  if (low && state.mode === 'playing') {
    const a = 0.16 + 0.1 * Math.sin(state.time * 5);
    ctx.strokeStyle = 'rgba(255,40,60,' + a.toFixed(3) + ')';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 51, ARENA.w - 10, ARENA.h - 56);
  }
}

function drawEnemies(ctx, state) {
  for (const e of state.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.shadowColor = e.glow;
    ctx.shadowBlur = 14;
    const flick = 1 + 0.1 * Math.sin(e.wobble * 6 + e.phase);

    if (e.type === 'wisp') {
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * flick, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffe3f1';
      ctx.beginPath();
      ctx.arc(0, -2, e.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'mite') {
      ctx.rotate(e.wobble * 2);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(0, -e.r - 3);
      ctx.lineTo(e.r + 3, 0);
      ctx.lineTo(0, e.r + 3);
      ctx.lineTo(-e.r - 3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#10210a';
      ctx.beginPath();
      ctx.arc(-3.5, -2, 2, 0, Math.PI * 2);
      ctx.arc(3.5, -2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'brute') {
      ctx.fillStyle = e.color;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + e.wobble * 0.4;
        const px = Math.cos(a) * e.r;
        const py = Math.sin(a) * e.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#431407';
      ctx.beginPath();
      ctx.arc(-6, -4, 3, 0, Math.PI * 2);
      ctx.arc(6, -4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-8, 6, 16, 3);
    } else {
      // Dusk Herald: a great spiked crown of dusk violet.
      ctx.fillStyle = e.color;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rr = i % 2 === 0 ? e.r + 12 : e.r - 4;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#2e1065';
      ctx.beginPath();
      ctx.arc(0, 0, e.r - 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5d0fe';
      ctx.beginPath();
      ctx.arc(-8, -4, 4, 0, Math.PI * 2);
      ctx.arc(8, -4, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hit flash: a white blink on damage.
    if (e.flash > 0) {
      ctx.globalAlpha = Math.min(1, e.flash * 6);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Health bar over tough enemies.
    if (e.maxHp > 2) {
      bar(ctx, e.x - 20, e.y - e.r - 14, 40, 5, e.hp / e.maxHp, e.type === 'herald' ? '#c084fc' : '#fb923c');
    }
  }
}

function drawBolts(ctx, state) {
  ctx.lineCap = 'round';
  for (const b of state.bolts) {
    ctx.strokeStyle = 'rgba(191,239,255,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(b.px, b.py);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.hearts <= 0 && state.mode !== 'title') return;

  // Dash trail: fading light afterimages.
  for (const t of p.trail) {
    ctx.globalAlpha = Math.max(0, 0.5 - t.t * 1.6);
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // A soft glow so the Keeper always pops against the dark field.
  ctx.save();
  ctx.translate(p.x, p.y);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 34);
  glow.addColorStop(0, 'rgba(125,211,252,0.30)');
  glow.addColorStop(1, 'rgba(125,211,252,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();

  // Staff first (under the body), pointing where the Keeper aims.
  ctx.strokeStyle = '#8b5e34';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4);
  ctx.lineTo(Math.cos(p.angle) * 32, Math.sin(p.angle) * 32);
  ctx.stroke();
  ctx.fillStyle = '#bfefff';
  ctx.shadowColor = '#bfefff';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 34, Math.sin(p.angle) * 34, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Robed body: a pale robe with a deep teal ring, so the Keeper
  // reads at a glance even when the frame is shrunk.
  ctx.fillStyle = '#e0f2fe';
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0e7490';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#0e7490';
  ctx.beginPath();
  ctx.arc(0, -2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e0f2fe';
  ctx.beginPath();
  ctx.arc(-3, -3, 2, 0, Math.PI * 2);
  ctx.arc(3, -3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawParticles(ctx, state) {
  for (const pt of state.parts) {
    ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloats(ctx, state) {
  ctx.font = 'bold 14px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of state.floats) {
    ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, state) {
  if (state.mode === 'title') return;
  const p = state.player;

  // Top bar.
  ctx.fillStyle = 'rgba(3,18,24,0.78)';
  ctx.fillRect(0, 0, ARENA.w, 46);

  // Score + combo, left.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px ' + FONT;
  ctx.fillText('SCORE ' + state.score.toLocaleString('en-US'), 14, 24);
  if (state.combo > 1) {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillText('COMBO x' + Math.min(state.combo, 5), 200, 24);
  }

  // Wave + foes, centre-left.
  ctx.fillStyle = '#7ee081';
  ctx.font = 'bold 20px ' + FONT;
  ctx.fillText('WAVE ' + Math.max(1, state.wave) + ' / 10', 330, 24);
  const foes = state.enemies.length + state.spawnQueue.length + state.telegraphs.length;
  ctx.fillStyle = '#ff8ac2';
  ctx.fillText('FOES ' + foes, 470, 24);

  // Beacon HP bar, centre.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px ' + FONT;
  ctx.fillText('BEACON', 600, 15);
  const bcol = state.beacon.hp < 30 ? '#ff5d73' : '#ffd166';
  bar(ctx, 600, 24, 190, 12, state.beacon.hp / state.beacon.max, bcol);

  // Hearts, energy, dash pip, right.
  let hx = 850;
  for (let i = 0; i < p.maxHearts; i++) {
    ctx.fillStyle = i < p.hearts ? '#ff5d73' : 'rgba(255,255,255,0.18)';
    heartPath(ctx, hx, 24, 9);
    ctx.fill();
    hx += 26;
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px ' + FONT;
  ctx.fillText('ENERGY', 950, 15);
  bar(ctx, 950, 24, 130, 12, p.energy / 100, '#38bdf8');
  ctx.fillText('DASH', 1105, 15);
  ctx.beginPath();
  ctx.arc(1124, 30, 8, 0, Math.PI * 2);
  ctx.fillStyle = p.dashCd <= 0 ? '#7ee081' : 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '12px ' + FONT;
  ctx.textAlign = 'right';
  ctx.fillText('P pause   M mute', 1266, 24);
  ctx.textAlign = 'left';

  // Kill feed, right side under the bar.
  ctx.font = '13px ' + FONT;
  for (let i = 0; i < state.feed.length; i++) {
    const f = state.feed[i];
    ctx.globalAlpha = Math.max(0.25, 1 - f.t / 6);
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'right';
    ctx.fillText(f.text, 1266, 64 + i * 20);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  // Boss bar when the Herald is on the field.
  const boss = state.enemies.find((e) => e.type === 'herald');
  if (boss) {
    ctx.fillStyle = 'rgba(3,18,24,0.78)';
    ctx.fillRect(440, 52, 400, 26);
    ctx.fillStyle = '#e9d5ff';
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('DUSK HERALD', 640, 61);
    bar(ctx, 470, 66, 340, 8, boss.hp / boss.maxHp, '#c084fc');
    ctx.textAlign = 'left';
  }

  // Breather countdown between waves.
  if (state.waveState === 'breather' && state.mode === 'playing') {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 18px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('Next wave in ' + Math.ceil(state.breather) + 's', 640, 92);
    ctx.textAlign = 'left';
  }
}

function drawBanner(ctx, state) {
  if (!state.banner || state.bannerT >= state.bannerDur) return;
  const t = state.bannerT / state.bannerDur;
  const a = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1;
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 46px ' + FONT;
  ctx.shadowColor = '#ffd166';
  ctx.shadowBlur = 18;
  ctx.fillText(state.banner, 640, 170);
  ctx.shadowBlur = 0;
  if (state.bannerSub) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px ' + FONT;
    ctx.fillText(state.bannerSub, 640, 206);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(3,18,24,0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,209,102,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(4,24,30,0.55)';
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 68px ' + FONT;
  ctx.shadowColor = '#ffd166';
  ctx.shadowBlur = 26;
  ctx.fillText('LUMEN KEEP', 640, 108);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#e0f2fe';
  ctx.font = 'italic 20px ' + FONT;
  ctx.fillText('Hold the last light against the Dusk Swarm', 640, 152);

  panel(ctx, 380, 178, 520, 168);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px ' + FONT;
  ctx.textAlign = 'left';
  const lines = [
    'WASD / ARROWS   move the Keeper',
    'MOUSE   aim     HOLD CLICK   fire light bolts',
    'SPACE   dash (brief invulnerability)',
    'P   pause     R   restart     M   mute',
    '',
    'Shards repair the beacon (+2 HP each).',
    'Kills in a row raise your combo up to x5.',
    'Survive all 10 waves - the dawn holds.',
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, 404, 202 + i * 18);
  });

  const pulse = 0.6 + 0.4 * Math.sin(state.time * 4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#7ee081';
  ctx.font = 'bold 24px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText('CLICK TO START', 640, 392);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px ' + FONT;
  ctx.fillText('or press Enter - keyboard-only play works too (Space fires)', 640, 420);
  ctx.textAlign = 'left';
}

function drawPaused(ctx, state) {
  ctx.fillStyle = 'rgba(4,24,30,0.55)';
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px ' + FONT;
  ctx.fillText('PAUSED', 640, 210);
  ctx.fillStyle = '#e0f2fe';
  ctx.font = '18px ' + FONT;
  ctx.fillText('Press P to resume - the arena waits.', 640, 252);
  ctx.textAlign = 'left';
}

function drawEnd(ctx, state, won) {
  ctx.fillStyle = won ? 'rgba(4,30,20,0.78)' : 'rgba(24,4,10,0.78)';
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = won ? '#7ee081' : '#ff5d73';
  ctx.font = 'bold 54px ' + FONT;
  ctx.shadowColor = won ? '#7ee081' : '#ff5d73';
  ctx.shadowBlur = 22;
  ctx.fillText(won ? 'THE DAWN HOLDS' : 'THE LIGHT FALLS', 640, 140);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#e0f2fe';
  ctx.font = 'italic 19px ' + FONT;
  ctx.fillText(
    won ? 'The beacon still burns. You held the last light.' : state.endReason === 'beacon' ? 'The beacon has fallen to the swarm.' : 'The Keeper has fallen.',
    640,
    186,
  );

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px ' + FONT;
  ctx.fillText('FINAL SCORE  ' + state.endScore.toLocaleString('en-US'), 640, 240);
  ctx.fillStyle = '#ffd166';
  ctx.font = '20px ' + FONT;
  ctx.fillText('Wave ' + Math.max(1, state.wave) + ' of 10    -    ' + state.kills + ' of the swarm shattered', 640, 278);

  const pulse = 0.6 + 0.4 * Math.sin(state.time * 4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#7ee081';
  ctx.font = 'bold 22px ' + FONT;
  ctx.fillText('Press R to play again', 640, 330);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
