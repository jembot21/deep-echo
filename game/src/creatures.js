// creatures.js — the things that live in the dark. Jellyfish drift on slow
// sine paths and sting. Anglerfish patrol the deep and hunt noise: a sonar
// ping inside their hearing turns them toward the submarine, which is the
// game's central bargain — you cannot see without being heard.

import { mulberry32, randRange, clamp } from './rng.js';

export function spawnCreatures(world, diveNumber, seed) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const creatures = [];
  const jellies = 4 + diveNumber;
  for (let i = 0; i < jellies; i++) {
    creatures.push({
      kind: 'jelly',
      x: randRange(rng, 120, 2280),
      y: randRange(rng, 420, world.depth - 80),
      baseY: 0,
      phase: randRange(rng, 0, Math.PI * 2),
      speed: randRange(rng, 6, 14),
      revealedUntil: 0,
    });
  }
  const anglers = diveNumber >= 1 ? 1 + Math.floor(diveNumber / 2) : 0;
  for (let i = 0; i < anglers; i++) {
    creatures.push({
      kind: 'angler',
      x: randRange(rng, 200, 2200),
      y: randRange(rng, world.depth * 0.55, world.depth - 100),
      vx: randRange(rng, -22, 22) || 18,
      heading: 1,
      alertUntil: 0,
      targetX: 0,
      targetY: 0,
      revealedUntil: 0,
    });
  }
  for (const c of creatures) c.baseY = c.y;
  return creatures;
}

export function hearPing(creatures, x, y, now) {
  for (const c of creatures) {
    if (c.kind !== 'angler') continue;
    const dx = c.x - x;
    const dy = c.y - y;
    if (dx * dx + dy * dy < 620 * 620) {
      c.alertUntil = now + 6;
      c.targetX = x;
      c.targetY = y;
    }
  }
}

export function updateCreatures(creatures, sub, dt, now) {
  for (const c of creatures) {
    if (c.kind === 'jelly') {
      c.x += Math.sin(now * 0.24 + c.phase) * c.speed * dt;
      c.y = c.baseY + Math.sin(now * 0.4 + c.phase * 1.7) * 26;
      continue;
    }
    // Anglerfish: cruise a patrol line, or close on the last ping / the sub
    // itself when it wanders near in the dark.
    let tx = c.x + c.heading * 100;
    let ty = c.baseY;
    let speed = 26;
    if (c.alertUntil > now) {
      tx = c.targetX;
      ty = c.targetY;
      speed = 74;
    } else if (Math.abs(sub.x - c.x) < 190 && Math.abs(sub.y - c.y) < 150) {
      tx = sub.x;
      ty = sub.y;
      speed = 66;
    }
    const dx = tx - c.x;
    const dy = ty - c.y;
    const len = Math.hypot(dx, dy) || 1;
    c.x += (dx / len) * speed * dt;
    c.y += (dy / len) * speed * dt * 0.7;
    if (dx !== 0) c.heading = dx > 0 ? 1 : -1;
    c.x = clamp(c.x, 40, 2360);
  }
}
