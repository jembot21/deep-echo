// submarine.js — the Nixie: the little submersible the player pilots. It owns
// its motion (thrust, drag, a boost that drinks oxygen), its two lifelines
// (oxygen and hull), and the floodlight it aims with the mouse. The rules in
// main.js spend and damage it; this module only moves it and keeps the sums.

import { clamp } from './rng.js';

export const SUB_RADIUS = 16;
const THRUST = 300;
const BOOST_THRUST = 560;
const DRAG = 1.6;
const MAX_OXYGEN = 100;
const OXYGEN_DRAIN = 100 / 85; // a full tank is about 85 seconds of diving
const BOOST_DRAIN = 7;

export function createSubmarine(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    oxygen: MAX_OXYGEN,
    hull: 100,
    aimAngle: 0,
    boosting: false,
    invulnerableUntil: 0,
    collected: 0,
    venting: false,
  };
}

export function updateSubmarine(sub, input, world, dt) {
  const thrust = input.boost ? BOOST_THRUST : THRUST;
  if (input.left) sub.vx -= thrust * dt;
  if (input.right) sub.vx += thrust * dt;
  if (input.up) sub.vy -= thrust * dt;
  if (input.down) sub.vy += thrust * dt;
  sub.vx -= sub.vx * DRAG * dt;
  sub.vy -= sub.vy * DRAG * dt;
  // A gentle buoyancy pulls the Nixie up when the player lets go.
  if (!input.up && !input.down) sub.vy -= 12 * dt;
  sub.x += sub.vx * dt;
  sub.y += sub.vy * dt;
  sub.x = clamp(sub.x, SUB_RADIUS + 4, world.width - SUB_RADIUS - 4);
  sub.y = clamp(sub.y, 60, world.depth - 20);
  sub.aimAngle = Math.atan2(input.aimY - sub.y, input.aimX - sub.x);
  sub.boosting = Boolean(input.boost && (input.left || input.right || input.up || input.down));

  sub.oxygen -= OXYGEN_DRAIN * dt;
  if (sub.boosting) sub.oxygen -= BOOST_DRAIN * dt;
  sub.venting = false;
  for (const vent of world.vents) {
    const dx = sub.x - vent.x;
    const dy = sub.y - vent.y;
    if (dx * dx + dy * dy < 90 * 90) {
      sub.oxygen = Math.min(MAX_OXYGEN, sub.oxygen + 26 * dt);
      sub.venting = true;
    }
  }
  sub.oxygen = clamp(sub.oxygen, 0, MAX_OXYGEN);
}

export function damageSubmarine(sub, amount, now) {
  if (now < sub.invulnerableUntil) return false;
  sub.hull = clamp(sub.hull - amount, 0, 100);
  sub.invulnerableUntil = now + 1.1;
  return true;
}
