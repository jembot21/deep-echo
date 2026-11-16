// main.js — Deep Echo's conductor. It owns the run's state machine (title,
// diving, dive complete, game over, paused), the rules that connect the
// modules — pinging costs air and wakes the fish, salvage pays by depth,
// mines and teeth cost hull, a filled quota only counts once the Nixie is
// back in the surface light — and the staged scenes the screenshots are
// taken from (?shot=title|action|deep|end, the kit's own convention).

import { buildDive, salvageScore, SURFACE_DEPTH } from './world.js';
import { createSonar, firePing, updateSonar, PING_OXYGEN_COST } from './sonar.js';
import { spawnCreatures, updateCreatures, hearPing } from './creatures.js';
import { createSubmarine, updateSubmarine, damageSubmarine, SUB_RADIUS } from './submarine.js';
import { computeCamera, renderDive } from './render.js';
import { drawHUD, drawTitleScreen, drawDiveCompleteScreen, drawGameOverScreen, drawPausedScreen } from './hud.js';
import {
  unlockAudio, playPing, playPickup, playExplosion, playSting, playAlarm, playDiveComplete, playGameOver,
} from './audio.js';
import { distance } from './rng.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const shot = params.get('shot');

const state = {
  mode: 'title',
  time: 0,
  world: null,
  sub: null,
  creatures: [],
  sonar: createSonar(),
  particles: [],
  toasts: [],
  score: 0,
  best: loadBest(),
  runSeed: 1,
  divesCompleted: 0,
  totalHauled: 0,
  lastDiveSalvage: 0,
  lastBonus: 0,
  gameOverCause: '',
  cam: { x: 0, y: 0 },
  staged: false,
  attract: null,
  alarmAt: 0,
};

const input = { left: false, right: false, up: false, down: false, boost: false, aimX: 0, aimY: 0, mouseX: 640, mouseY: 300 };

function loadBest() {
  try {
    return Number(localStorage.getItem('deep-echo-best') ?? 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest() {
  try {
    localStorage.setItem('deep-echo-best', String(state.best));
  } catch {
    /* a private window keeps no best; the run still counts */
  }
}

function toast(text, color = 'rgba(174,233,255,ALPHA)') {
  state.toasts.push({ text, color, left: 2.2 });
  if (state.toasts.length > 3) state.toasts.shift();
}

function spawnParticles(x, y, count, color, speed = 90, life = 0.7, size = 4) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (0.3 + Math.random() * 0.7) * speed;
    state.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 20,
      life: life * (0.6 + Math.random() * 0.7),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color,
    });
  }
}

function startDive(diveNumber) {
  const seed = state.runSeed + diveNumber * 977;
  state.world = buildDive(diveNumber, seed);
  state.creatures = spawnCreatures(state.world, diveNumber, seed);
  state.sub = createSubmarine(state.world.width / 2, 110);
  state.sonar = createSonar();
  state.particles = [];
  state.toasts = [];
  state.mode = 'diving';
}

function startRun() {
  state.runSeed = (Date.now() % 90000) + 7;
  state.score = 0;
  state.divesCompleted = 0;
  state.totalHauled = 0;
  startDive(1);
  toast('DIVE 1 — FILL THE QUOTA, THEN SURFACE');
}

function endDive() {
  const sub = state.sub;
  state.lastBonus = Math.round(sub.oxygen) * 2 + Math.round(sub.hull);
  state.score += state.lastBonus;
  state.divesCompleted += 1;
  state.totalHauled += sub.collected;
  state.mode = 'diveComplete';
  playDiveComplete();
}

function gameOver(cause) {
  state.gameOverCause = cause;
  state.totalHauled += state.sub.collected;
  if (state.score > state.best) {
    state.best = state.score;
    saveBest();
  }
  state.mode = 'gameOver';
  playGameOver();
}

function allEntities() {
  const w = state.world;
  return [...w.salvage, ...w.mines, ...w.vents, ...state.creatures];
}

function tryPing() {
  const sub = state.sub;
  if (!firePing(state.sonar, sub.x, sub.y, state.time)) return;
  sub.oxygen = Math.max(0, sub.oxygen - PING_OXYGEN_COST);
  hearPing(state.creatures, sub.x, sub.y, state.time);
  playPing();
}

function updateRules(dt) {
  const { sub, world } = state;
  // Salvage pickup.
  for (const piece of world.salvage) {
    if (piece.taken) continue;
    if (distance(sub.x, sub.y, piece.x, piece.y) < SUB_RADIUS + 15) {
      piece.taken = true;
      sub.collected += 1;
      const gained = salvageScore(world, piece);
      state.lastDiveSalvage += gained;
      state.score += gained;
      spawnParticles(piece.x, piece.y, 10, 'rgba(255,217,77,ALPHA)', 70, 0.6, 3.5);
      toast(`SALVAGE +${gained}  (${sub.collected}/${world.quota})`, 'rgba(255,217,77,ALPHA)');
      playPickup();
    }
  }
  // Mines.
  for (const mine of world.mines) {
    if (mine.detonated) continue;
    if (distance(sub.x, sub.y, mine.x, mine.y) < SUB_RADIUS + 14) {
      mine.detonated = true;
      spawnParticles(mine.x, mine.y, 30, 'rgba(255,120,80,ALPHA)', 190, 0.9, 5);
      spawnParticles(mine.x, mine.y, 16, 'rgba(255,220,150,ALPHA)', 120, 0.6, 4);
      if (damageSubmarine(sub, 34, state.time)) {
        sub.vx += (sub.x < mine.x ? -1 : 1) * 190;
        sub.vy -= 120;
        toast('MINE! HULL BREACH', 'rgba(255,110,90,ALPHA)');
        playExplosion();
      }
    }
  }
  // Creatures.
  for (const c of state.creatures) {
    const reach = c.kind === 'angler' ? SUB_RADIUS + 22 : SUB_RADIUS + 13;
    if (distance(sub.x, sub.y, c.x, c.y) < reach) {
      const hurt = c.kind === 'angler' ? 16 : 8;
      if (damageSubmarine(sub, hurt, state.time)) {
        spawnParticles(sub.x, sub.y, 12, 'rgba(140,225,255,ALPHA)', 110, 0.5, 3.5);
        toast(c.kind === 'angler' ? 'ANGLERFISH BITE!' : 'JELLYFISH STING', 'rgba(255,150,120,ALPHA)');
        playSting();
      }
    }
  }
  // The dive's ends.
  if (sub.collected >= world.quota && sub.y <= SURFACE_DEPTH) {
    endDive();
  } else if (sub.oxygen <= 0) {
    gameOver(`Out of air at ${Math.max(0, Math.round(sub.y - SURFACE_DEPTH))} m down.`);
  } else if (sub.hull <= 0) {
    gameOver('The hull gave way under the deep\'s teeth and steel.');
  }
  if (sub.oxygen < 25 && sub.oxygen > 0 && state.time > state.alarmAt) {
    state.alarmAt = state.time + 1.4;
    playAlarm();
  }
}

// The title screen's ghost pilot: an autopilot Nixie that wanders the first
// dive and pings into the dark, so the title shows the game playing itself.
function startAttract() {
  const world = buildDive(1, 4242);
  state.world = world;
  state.creatures = spawnCreatures(world, 1, 4242);
  state.sub = createSubmarine(world.width / 2, 430);
  state.sonar = createSonar();
  state.attract = { targetX: 700, targetY: 700, retargetAt: 0, pingAt: 0.8 };
  state.mode = 'title';
}

function updateAttract(dt) {
  const { sub, attract } = state;
  if (state.time > attract.retargetAt) {
    attract.retargetAt = state.time + 5;
    attract.targetX = 200 + Math.random() * (state.world.width - 400);
    attract.targetY = 260 + Math.random() * (state.world.depth * 0.55);
  }
  const steer = {
    left: sub.x > attract.targetX + 24,
    right: sub.x < attract.targetX - 24,
    up: sub.y > attract.targetY + 24,
    down: sub.y < attract.targetY - 24,
    boost: false,
    aimX: sub.x + Math.cos(state.time * 0.6) * 200,
    aimY: sub.y + Math.sin(state.time * 0.6) * 200,
  };
  updateSubmarine(sub, steer, state.world, dt);
  sub.oxygen = 100; // the ghost never drowns
  if (state.time > attract.pingAt) {
    attract.pingAt = state.time + 2.9;
    if (firePing(state.sonar, sub.x, sub.y, state.time)) {
      hearPing(state.creatures, sub.x, sub.y, state.time);
    }
  }
}

// Staged scenes for the screenshots: real states of the game, composed.
function stageShot(kind) {
  state.staged = true;
  if (kind === 'action') {
    state.runSeed = 1234;
    startDive(2);
    const wreck = state.world.wrecks[0];
    const sub = state.sub;
    sub.x = wreck.x - 150;
    sub.y = wreck.y - 90;
    sub.oxygen = 68;
    sub.collected = 3;
    sub.aimAngle = 0.5;
    state.score = 1240;
    state.lastDiveSalvage = 640;
    let marked = 0;
    for (const piece of state.world.salvage) {
      if (distance(sub.x, sub.y, piece.x, piece.y) < 430) piece.revealedUntil = state.time + 60;
      else if (marked < 3) { piece.taken = true; marked += 1; }
    }
    for (const mine of state.world.mines) {
      if (distance(sub.x, sub.y, mine.x, mine.y) < 430) mine.revealedUntil = state.time + 60;
    }
    // The cast, arranged around the sub: jellies drifting in a loose school,
    // two anglers closing from the right, each close enough to read at a glance.
    const cast = [
      { dx: 205, dy: 118 }, { dx: 262, dy: 52 }, { dx: 318, dy: 128 },
      { dx: 356, dy: 8 }, { dx: 415, dy: 84 }, { dx: 452, dy: -38 },
      { dx: 505, dy: 30 }, { dx: 548, dy: -84 },
    ];
    state.creatures.forEach((c, i) => {
      const spot = cast[i % cast.length];
      c.x = sub.x + spot.dx;
      c.y = sub.y + spot.dy;
      c.baseY = c.y;
      c.revealedUntil = state.time + 60;
    });
    state.sonar.rings.push({ x: sub.x, y: sub.y, bornAt: state.time - 0.52 });
    state.ringLoop = true;
    toast(`SALVAGE +185  (3/${state.world.quota})`, 'rgba(255,217,77,ALPHA)');
    state.mode = 'diving';
  } else if (kind === 'deep') {
    state.runSeed = 777;
    startDive(3);
    const sub = state.sub;
    sub.x = state.world.width * 0.42;
    sub.y = state.world.depth * 0.8;
    sub.oxygen = 17;
    sub.hull = 64;
    sub.collected = 5;
    sub.aimAngle = 2.6;
    state.score = 2870;
    for (const mine of state.world.mines) {
      if (distance(sub.x, sub.y, mine.x, mine.y) < 380) mine.revealedUntil = state.time + 60;
    }
    for (const piece of state.world.salvage) {
      if (distance(sub.x, sub.y, piece.x, piece.y) < 380) piece.revealedUntil = state.time + 60;
    }
    const angler = state.creatures.find((c) => c.kind === 'angler');
    if (angler) {
      angler.x = sub.x + 170;
      angler.y = sub.y + 30;
      angler.baseY = angler.y;
      angler.alertUntil = state.time + 60;
      angler.targetX = sub.x;
      angler.targetY = sub.y;
      angler.revealedUntil = state.time + 60;
    }
    state.sonar.rings.push({ x: sub.x, y: sub.y, bornAt: state.time - 0.3 });
    state.ringLoop = true;
    state.mode = 'diving';
  } else if (kind === 'end') {
    state.runSeed = 99;
    startDive(2);
    state.sub.oxygen = 0;
    state.score = 4310;
    state.best = 4310;
    state.divesCompleted = 3;
    state.totalHauled = 21;
    state.gameOverCause = 'Out of air at 412 m — the surface light was in sight.';
    state.mode = 'gameOver';
  } else {
    startAttract();
  }
  state.staged = kind !== 'title';
  if (kind === 'title') state.staged = false;
}

function update(dt) {
  state.time += dt;
  for (const toastItem of state.toasts) toastItem.left -= dt;
  state.toasts = state.toasts.filter((t) => t.left > 0);
  for (const p of state.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= 30 * dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  if (state.mode === 'title') {
    updateAttract(dt);
    updateSonar(state.sonar, allEntities(), dt, state.time);
    updateCreatures(state.creatures, state.sub, dt, state.time);
    return;
  }
  if (state.mode !== 'diving' || state.paused) return;

  if (state.staged) {
    // A staged scene keeps its sonar ring mid-expansion for the camera:
    // whenever a ring dies, a fresh one is already half-grown.
    if (state.ringLoop && state.sonar.rings.length === 0) {
      state.sonar.rings.push({ x: state.sub.x, y: state.sub.y, bornAt: state.time - 0.45 });
    }
    updateSonar(state.sonar, allEntities(), dt, state.time);
    updateCreatures(state.creatures, state.sub, dt, state.time);
    return;
  }

  input.aimX = state.cam.x + input.mouseX;
  input.aimY = state.cam.y + input.mouseY;
  updateSubmarine(state.sub, input, state.world, dt);
  updateSonar(state.sonar, allEntities(), dt, state.time);
  updateCreatures(state.creatures, state.sub, dt, state.time);
  updateRules(dt);
}

function render() {
  state.cam = computeCamera(state.world, state.sub);
  const view = {
    world: state.world,
    sub: state.sub,
    creatures: state.creatures,
    sonar: state.sonar,
    particles: state.particles,
    now: state.time,
    cam: state.cam,
  };
  renderDive(ctx, view);
  if (state.mode === 'diving' || state.paused) {
    drawHUD(ctx, state);
    if (state.paused) drawPausedScreen(ctx);
  } else if (state.mode === 'title') {
    drawTitleScreen(ctx, state);
  } else if (state.mode === 'diveComplete') {
    drawHUD(ctx, state);
    drawDiveCompleteScreen(ctx, state);
  } else if (state.mode === 'gameOver') {
    drawGameOverScreen(ctx, state);
  }
}

let lastTimestamp = 0;
function frame(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000 || 0.016);
  lastTimestamp = timestamp;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

// Input.
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ShiftLeft: 'boost', ShiftRight: 'boost',
};

window.addEventListener('keydown', (event) => {
  unlockAudio();
  if (event.code === 'Space') {
    event.preventDefault();
    if (state.mode === 'diving' && !state.paused && !state.staged) tryPing();
    return;
  }
  if (event.code === 'Enter') {
    if (state.mode === 'title') startRun();
    else if (state.mode === 'diveComplete') startDive(state.world.diveNumber + 1);
    return;
  }
  if (event.code === 'KeyR' && state.mode === 'gameOver') {
    startRun();
    return;
  }
  if (event.code === 'KeyP' && state.mode === 'diving') {
    state.paused = !state.paused;
    return;
  }
  const mapped = KEYMAP[event.code];
  if (mapped) {
    input[mapped] = true;
    if (event.code.startsWith('Arrow')) event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  const mapped = KEYMAP[event.code];
  if (mapped) input[mapped] = false;
});

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  input.mouseX = ((event.clientX - rect.left) / rect.width) * canvas.width;
  input.mouseY = ((event.clientY - rect.top) / rect.height) * canvas.height;
});

canvas.addEventListener('mousedown', () => {
  unlockAudio();
  if (state.mode === 'title') startRun();
  else if (state.mode === 'gameOver') startRun();
  else if (state.mode === 'diveComplete') startDive(state.world.diveNumber + 1);
  else if (state.mode === 'diving' && !state.paused && !state.staged) tryPing();
});

// Boot: a staged scene when a screenshot asks for one, the attract title else.
if (shot) {
  document.body.classList.add('shot-mode');
  stageShot(shot);
} else {
  startAttract();
}
requestAnimationFrame(frame);
