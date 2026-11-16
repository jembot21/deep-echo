// render.js — draws the dive. The water is a depth gradient with light rays at
// the surface and plankton in two parallax layers; over it sits a darkness
// layer that only the floodlight, the lamp cone, a sonar ring and a revealed
// echo can push back. What a ping has touched is drawn a second time, glowing,
// on the echo pass — that glow is the game's whole visual idea.

import { clamp, lerp } from './rng.js';
import { SURFACE_DEPTH } from './world.js';
import { isRevealed, ringRadius } from './sonar.js';

export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 800;

const lightCanvas = document.createElement('canvas');
lightCanvas.width = VIEW_WIDTH;
lightCanvas.height = VIEW_HEIGHT;

export function computeCamera(world, focus) {
  return {
    x: clamp(focus.x - VIEW_WIDTH / 2, 0, Math.max(0, world.width - VIEW_WIDTH)),
    y: clamp(focus.y - VIEW_HEIGHT / 2, 0, Math.max(0, world.depth - VIEW_HEIGHT)),
  };
}

function depthTint(world, y) {
  // 0 at the surface, 1 at the floor of the column.
  return clamp(y / world.depth, 0, 1);
}

function mixColor(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function drawWater(ctx, world, cam) {
  const top = depthTint(world, cam.y);
  const bottom = depthTint(world, cam.y + VIEW_HEIGHT);
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  const cTop = mixColor([13, 66, 88], [1, 3, 10], top);
  const cBottom = mixColor([8, 44, 66], [1, 2, 7], bottom);
  grad.addColorStop(0, `rgb(${cTop[0]},${cTop[1]},${cTop[2]})`);
  grad.addColorStop(1, `rgb(${cBottom[0]},${cBottom[1]},${cBottom[2]})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  // The lit surface band and its rays, when the camera is near the top.
  if (cam.y < SURFACE_DEPTH + 60) {
    const surfaceY = SURFACE_DEPTH - cam.y;
    const rayGrad = ctx.createLinearGradient(0, surfaceY - 150, 0, surfaceY + 190);
    rayGrad.addColorStop(0, 'rgba(140,225,255,0.20)');
    rayGrad.addColorStop(1, 'rgba(140,225,255,0)');
    ctx.fillStyle = rayGrad;
    ctx.fillRect(0, surfaceY - 150, VIEW_WIDTH, 340);
    ctx.fillStyle = 'rgba(190,240,255,0.85)';
    ctx.fillRect(0, surfaceY - 2, VIEW_WIDTH, 3);
  }

  // Plankton: nearer layer drifts faster against the camera.
  for (const mote of world.plankton) {
    const sx = mote.x - cam.x * mote.layer;
    const sy = mote.y - cam.y * mote.layer;
    if (sx < -4 || sx > VIEW_WIDTH + 4 || sy < -4 || sy > VIEW_HEIGHT + 4) continue;
    const alpha = 0.10 + 0.16 * (1 - depthTint(world, mote.y));
    ctx.fillStyle = `rgba(170,225,245,${alpha.toFixed(3)})`;
    ctx.fillRect(sx, sy, mote.size, mote.size);
  }

  // The seabed silhouette along the column's floor.
  if (cam.y + VIEW_HEIGHT > world.depth - 130) {
    ctx.fillStyle = '#02070d';
    ctx.beginPath();
    ctx.moveTo(0, VIEW_HEIGHT);
    for (let sx = 0; sx <= VIEW_WIDTH; sx += 32) {
      const wx = sx + cam.x;
      const ridge = Math.sin(wx * 0.011) * 16 + Math.sin(wx * 0.0037 + 2) * 22;
      ctx.lineTo(sx, world.depth - 46 + ridge - cam.y);
    }
    ctx.lineTo(VIEW_WIDTH, VIEW_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }
}

function drawWreck(ctx, wreck, cam) {
  const sx = wreck.x - cam.x;
  const sy = wreck.y - cam.y;
  if (sx < -320 || sx > VIEW_WIDTH + 320) return;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(wreck.tilt);
  ctx.fillStyle = '#0a141d';
  ctx.strokeStyle = 'rgba(120,180,200,0.35)';
  ctx.lineWidth = 2;
  const w = wreck.width;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w / 2 + 24, -30);
  ctx.lineTo(w / 2 - 40, -30);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(-w / 6, -52, 34, 24); // the conning tower
  if (wreck.broken) {
    ctx.clearRect(w / 8, -34, 12, 36);
  }
  ctx.restore();
}

function drawSalvageShape(ctx, piece, sx, sy, glow) {
  ctx.save();
  ctx.translate(sx, sy);
  if (glow) {
    ctx.shadowColor = piece.color;
    ctx.shadowBlur = 16;
  }
  ctx.fillStyle = piece.color;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  if (piece.kind === 'crate') {
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.beginPath();
    ctx.moveTo(-9, -9);
    ctx.lineTo(9, 9);
    ctx.moveTo(9, -9);
    ctx.lineTo(-9, 9);
    ctx.stroke();
  } else if (piece.kind === 'barrel') {
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, -3);
    ctx.lineTo(8, -3);
    ctx.moveTo(-8, 4);
    ctx.lineTo(8, 4);
    ctx.stroke();
  } else if (piece.kind === 'relic') {
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(9, 6);
    ctx.lineTo(0, 12);
    ctx.lineTo(-9, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(-10, -7, 20, 14);
    ctx.strokeRect(-10, -7, 20, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-2.5, -7, 5, 14);
  }
  ctx.restore();
}

function drawMine(ctx, mine, sx, sy, glow) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.strokeStyle = 'rgba(150,170,180,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(0, -mine.chainTop);
  ctx.stroke();
  if (glow) {
    ctx.shadowColor = '#ff5545';
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = '#232a30';
  ctx.strokeStyle = glow ? '#ff7a6a' : 'rgba(160,180,190,0.5)';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 11);
    ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff5545';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVent(ctx, vent, sx, sy, now) {
  ctx.fillStyle = '#0b1218';
  ctx.beginPath();
  ctx.moveTo(sx - 22, sy + 10);
  ctx.lineTo(sx - 6, sy - 12);
  ctx.lineTo(sx + 8, sy - 16);
  ctx.lineTo(sx + 22, sy + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(160,230,255,0.5)';
  for (let i = 0; i < 4; i++) {
    const rise = ((now * 34 + i * 26) % 90);
    ctx.beginPath();
    ctx.arc(sx + Math.sin(now * 2 + i * 1.9) * 5, sy - 12 - rise, 2.6 - rise * 0.014, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCreature(ctx, creature, cam, now, glow) {
  const sx = creature.x - cam.x;
  const sy = creature.y - cam.y;
  if (sx < -90 || sx > VIEW_WIDTH + 90 || sy < -90 || sy > VIEW_HEIGHT + 90) return;
  ctx.save();
  ctx.translate(sx, sy);
  if (creature.kind === 'jelly') {
    const pulse = 1 + Math.sin(now * 2.4 + creature.phase) * 0.08;
    ctx.scale(pulse, pulse);
    if (glow) {
      ctx.shadowColor = '#6ae2ff';
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = 'rgba(140,225,255,0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, 15, Math.PI, 0);
    ctx.quadraticCurveTo(15, 8, 8, 10);
    ctx.quadraticCurveTo(0, 4, -8, 10);
    ctx.quadraticCurveTo(-15, 8, -15, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,225,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 5, 8);
      ctx.quadraticCurveTo(i * 5 + Math.sin(now * 3 + i) * 4, 20, i * 5 + Math.sin(now * 2.2 + i * 2) * 6, 30);
      ctx.stroke();
    }
  } else {
    ctx.scale(creature.heading, 1);
    if (glow) {
      ctx.shadowColor = '#ffb347';
      ctx.shadowBlur = 16;
    }
    ctx.fillStyle = '#0d141b';
    ctx.strokeStyle = 'rgba(150,180,190,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath(); // tail
    ctx.moveTo(-28, 0);
    ctx.lineTo(-44, -10);
    ctx.lineTo(-44, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd98a'; // the lure, always faintly lit
    ctx.beginPath();
    ctx.arc(38, -8, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,180,190,0.4)';
    ctx.beginPath();
    ctx.moveTo(24, -10);
    ctx.quadraticCurveTo(34, -20, 38, -11);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSubmarine(ctx, sub, cam, now) {
  const sx = sub.x - cam.x;
  const sy = sub.y - cam.y;
  ctx.save();
  ctx.translate(sx, sy);
  const facing = sub.vx < -12 ? -1 : 1;
  ctx.scale(facing, 1);
  if (now < sub.invulnerableUntil && Math.floor(now * 14) % 2 === 0) ctx.globalAlpha = 0.45;
  // hull
  ctx.fillStyle = '#e0a83c';
  ctx.strokeStyle = '#7a5510';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // conning tower + periscope
  ctx.fillStyle = '#c78f27';
  ctx.fillRect(-6, -20, 14, 9);
  ctx.fillRect(4, -26, 3, 7);
  // viewport
  ctx.fillStyle = '#bfeaff';
  ctx.strokeStyle = '#7a5510';
  ctx.beginPath();
  ctx.arc(11, -2, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // tail fin + propeller
  ctx.fillStyle = '#c78f27';
  ctx.beginPath();
  ctx.moveTo(-24, 0);
  ctx.lineTo(-34, -8);
  ctx.lineTo(-34, 8);
  ctx.closePath();
  ctx.fill();
  const spin = Math.sin(now * 40) * (Math.abs(sub.vx) + Math.abs(sub.vy) > 12 ? 1 : 0.25);
  ctx.strokeStyle = '#d8d8d8';
  ctx.beginPath();
  ctx.moveTo(-36, -6 * spin - 2);
  ctx.lineTo(-36, 6 * spin + 2);
  ctx.stroke();
  ctx.restore();
  // boost bubbles
  if (sub.boosting) {
    ctx.fillStyle = 'rgba(190,235,255,0.5)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(sx - facing * (34 + i * 9), sy + Math.sin(now * 9 + i * 2.4) * 5, 2.4 - i * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function punchLight(ctx, x, y, radius, strength) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, `rgba(0,0,0,${strength})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawDarkness(ctx, view) {
  const { world, sub, creatures, sonar, now, cam } = view;
  const lctx = lightCanvas.getContext('2d');
  const darkness = lerp(0.62, 0.94, depthTint(world, sub.y));
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  lctx.fillStyle = `rgba(1,4,12,${darkness})`;
  lctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  lctx.globalCompositeOperation = 'destination-out';

  // The surface band is lit from above.
  if (cam.y < SURFACE_DEPTH + 120) {
    const grad = lctx.createLinearGradient(0, 0, 0, SURFACE_DEPTH + 120 - cam.y);
    grad.addColorStop(0, 'rgba(0,0,0,0.95)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = grad;
    lctx.fillRect(0, 0, VIEW_WIDTH, SURFACE_DEPTH + 120 - cam.y);
  }

  const sx = sub.x - cam.x;
  const sy = sub.y - cam.y;
  punchLight(lctx, sx, sy, 150, 0.95); // the sub's own glow
  // The floodlight cone toward the mouse aim.
  const coneLength = 320;
  const ax = sx + Math.cos(sub.aimAngle) * coneLength;
  const ay = sy + Math.sin(sub.aimAngle) * coneLength;
  const coneGrad = lctx.createRadialGradient(sx, sy, 10, ax, ay, coneLength * 0.55);
  coneGrad.addColorStop(0, 'rgba(0,0,0,0.55)');
  coneGrad.addColorStop(1, 'rgba(0,0,0,0)');
  lctx.fillStyle = coneGrad;
  lctx.beginPath();
  lctx.moveTo(sx, sy);
  lctx.arc(sx, sy, coneLength, sub.aimAngle - 0.36, sub.aimAngle + 0.36);
  lctx.closePath();
  lctx.fill();

  // Echoes: whatever a ping revealed pushes the dark back around itself.
  const echo = (e, radius, strength) => {
    if (isRevealed(e, now)) punchLight(lctx, e.x - cam.x, e.y - cam.y, radius, strength);
  };
  for (const piece of world.salvage) if (!piece.taken) echo(piece, 74, 0.9);
  for (const mine of world.mines) if (!mine.detonated) echo(mine, 66, 0.85);
  for (const vent of world.vents) echo(vent, 80, 0.8);
  for (const c of creatures) echo(c, 88, 0.85);
  for (const wreck of world.wrecks) {
    punchLight(lctx, wreck.x - cam.x, wreck.y - cam.y, wreck.width * 0.42, 0.22);
  }
  ctx.drawImage(lightCanvas, 0, 0);

  // Sonar rings themselves, drawn over the dark.
  for (const ring of sonar.rings) {
    const radius = ringRadius(ring, now);
    if (radius < 0) continue;
    const fade = 1 - radius / 360;
    ctx.strokeStyle = `rgba(110,235,255,${(0.75 * fade).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ring.x - cam.x, ring.y - cam.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(110,235,255,${(0.25 * fade).toFixed(3)})`;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(ring.x - cam.x, ring.y - cam.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEchoPass(ctx, view) {
  const { world, creatures, now, cam } = view;
  for (const piece of world.salvage) {
    if (piece.taken || !isRevealed(piece, now)) continue;
    const bob = Math.sin(now * 2 + piece.bobPhase) * 2.5;
    drawSalvageShape(ctx, piece, piece.x - cam.x, piece.y - cam.y + bob, true);
  }
  for (const mine of world.mines) {
    if (!mine.detonated && isRevealed(mine, now)) drawMine(ctx, mine, mine.x - cam.x, mine.y - cam.y, true);
  }
  for (const c of creatures) {
    if (isRevealed(c, now)) drawCreature(ctx, c, cam, now, true);
  }
}

// Particles the rules spawn (explosions, pickup sparks, vent bubbles the sub
// is drinking): main.js owns the list, this draws it.
export function drawParticles(ctx, particles, cam) {
  for (const p of particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color.replace('ALPHA', (alpha * 0.85).toFixed(3));
    ctx.beginPath();
    ctx.arc(p.x - cam.x, p.y - cam.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

export function renderDive(ctx, view) {
  const { world, sub, creatures, now, cam } = view;
  drawWater(ctx, world, cam);
  for (const wreck of world.wrecks) drawWreck(ctx, wreck, cam);
  for (const vent of world.vents) drawVent(ctx, vent, vent.x - cam.x, vent.y - cam.y, now);
  for (const piece of world.salvage) {
    if (!piece.taken) drawSalvageShape(ctx, piece, piece.x - cam.x, piece.y - cam.y, false);
  }
  for (const mine of world.mines) {
    if (!mine.detonated) drawMine(ctx, mine, mine.x - cam.x, mine.y - cam.y, false);
  }
  for (const c of creatures) drawCreature(ctx, c, cam, now, false);
  drawParticles(ctx, view.particles, cam);
  drawDarkness(ctx, view);
  drawEchoPass(ctx, view);
  drawSubmarine(ctx, sub, cam, now);
}
