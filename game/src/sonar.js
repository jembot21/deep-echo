// sonar.js — the ping system. The deep is dark: a ping is an expanding ring
// that washes over the water, and everything it crosses is revealed for a few
// seconds, glowing on the renderer's echo layer. Between pings the submarine
// sees only its own floodlight. Pings are also noise: the creatures module
// hears them and comes to look.

import { distance } from './rng.js';

export const PING_RADIUS = 360;
export const PING_SECONDS = 0.9;
export const REVEAL_SECONDS = 4.5;
export const PING_COOLDOWN = 1.6;
export const PING_OXYGEN_COST = 1.2;

export function createSonar() {
  return { rings: [], cooldownLeft: 0, lastPingAt: -10 };
}

export function firePing(sonar, x, y, now) {
  if (sonar.cooldownLeft > 0) return false;
  sonar.rings.push({ x, y, bornAt: now });
  sonar.cooldownLeft = PING_COOLDOWN;
  sonar.lastPingAt = now;
  return true;
}

export function ringRadius(ring, now) {
  const t = (now - ring.bornAt) / PING_SECONDS;
  return t >= 1 ? -1 : t * PING_RADIUS;
}

// Advances every ring and stamps `revealedUntil` on each entity a ring's edge
// has just crossed. Entities are anything with x, y and a revealedUntil field.
export function updateSonar(sonar, entities, dt, now) {
  sonar.cooldownLeft = Math.max(0, sonar.cooldownLeft - dt);
  sonar.rings = sonar.rings.filter((ring) => now - ring.bornAt < PING_SECONDS);
  for (const ring of sonar.rings) {
    const radius = ringRadius(ring, now);
    const previous = radius - (PING_RADIUS / PING_SECONDS) * dt;
    for (const e of entities) {
      const d = distance(ring.x, ring.y, e.x, e.y);
      if (d <= radius && d >= previous - 24) e.revealedUntil = now + REVEAL_SECONDS;
    }
  }
}

export function isRevealed(entity, now) {
  return entity.revealedUntil > now;
}
