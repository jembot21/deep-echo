// world.js — builds one dive: the water column, the wrecks on its floor, the
// salvage worth hauling, the mines and vents between them, and where the
// creatures start. A dive is pure data built from a seed; the renderer and the
// rules read it, and nothing here knows about the canvas.

import { mulberry32, randRange, randInt, pick } from './rng.js';

export const WORLD_WIDTH = 2400;
export const SURFACE_DEPTH = 150; // y above this is the lit surface zone

const SALVAGE_KINDS = [
  { kind: 'crate', base: 40, color: '#d8a24a' },
  { kind: 'barrel', base: 65, color: '#c96f35' },
  { kind: 'relic', base: 110, color: '#7fe7d2' },
  { kind: 'strongbox', base: 160, color: '#ffd94d' },
];

export function buildDive(diveNumber, seed) {
  const rng = mulberry32(seed);
  const depth = 1500 + (diveNumber - 1) * 300; // the water column's height
  const quota = 4 + diveNumber * 2; // salvage pieces needed to clear the dive

  const wrecks = [];
  const wreckCount = 3 + Math.min(3, diveNumber);
  for (let i = 0; i < wreckCount; i++) {
    wrecks.push({
      x: randRange(rng, 200, WORLD_WIDTH - 200),
      y: randRange(rng, depth * 0.45, depth - 120),
      width: randRange(rng, 150, 260),
      tilt: randRange(rng, -0.16, 0.16),
      broken: rng() < 0.5,
    });
  }

  // Salvage clusters around wrecks, with richer pieces deeper down: the value
  // of a piece grows with the fraction of the column beneath it.
  const salvage = [];
  const addSalvage = (x, y) => {
    const spec = pick(rng, SALVAGE_KINDS);
    const depthBonus = 1 + (y / depth) * 1.2;
    salvage.push({
      x,
      y,
      kind: spec.kind,
      color: spec.color,
      value: Math.round(spec.base * depthBonus / 5) * 5,
      taken: false,
      bobPhase: randRange(rng, 0, Math.PI * 2),
      revealedUntil: 0,
    });
  };
  for (const wreck of wrecks) {
    const pieces = randInt(rng, 3, 5);
    for (let i = 0; i < pieces; i++) {
      addSalvage(wreck.x + randRange(rng, -wreck.width / 2, wreck.width / 2), wreck.y + randRange(rng, -46, 30));
    }
  }
  const loose = 6 + diveNumber * 2;
  for (let i = 0; i < loose; i++) {
    addSalvage(randRange(rng, 90, WORLD_WIDTH - 90), randRange(rng, 320, depth - 60));
  }

  const mines = [];
  const mineCount = 5 + diveNumber * 3;
  for (let i = 0; i < mineCount; i++) {
    mines.push({
      x: randRange(rng, 70, WORLD_WIDTH - 70),
      y: randRange(rng, 380, depth - 50),
      chainTop: randRange(rng, 60, 200),
      detonated: false,
      revealedUntil: 0,
    });
  }

  const vents = [];
  const ventCount = 3 + Math.floor(diveNumber / 2);
  for (let i = 0; i < ventCount; i++) {
    vents.push({
      x: randRange(rng, 120, WORLD_WIDTH - 120),
      y: randRange(rng, depth * 0.35, depth - 40),
      revealedUntil: 0,
    });
  }

  // Plankton motes for the renderer: two parallax layers of drifting specks.
  const plankton = [];
  for (let i = 0; i < 130; i++) {
    plankton.push({
      x: rng() * WORLD_WIDTH,
      y: rng() * depth,
      layer: rng() < 0.5 ? 0.4 : 0.75,
      size: randRange(rng, 0.8, 2.2),
      drift: randRange(rng, 2, 9),
    });
  }

  return { diveNumber, width: WORLD_WIDTH, depth, quota, wrecks, salvage, mines, vents, plankton };
}

// The score a piece pays: its face value, plus a daring bonus the deeper in
// the column it was lifted from.
export function salvageScore(world, piece) {
  return piece.value + Math.round((piece.y / world.depth) * 40);
}
