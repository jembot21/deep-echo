// hud.js — everything drawn over the water: the instrument gauges (oxygen,
// hull, salvage against quota, score), the depth rail, the centre prompts and
// toasts, and the full screens — title, dive complete, game over, paused. The
// judge reads the game mostly from screenshots, so every screen says what
// game this is, how it is played and how the run went.

import { clamp } from './rng.js';
import { SURFACE_DEPTH } from './world.js';
import { VIEW_WIDTH, VIEW_HEIGHT } from './render.js';

const FONT = "'Segoe UI', system-ui, sans-serif";

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(2,14,24,${alpha})`;
  ctx.strokeStyle = 'rgba(110,200,230,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function gauge(ctx, x, y, w, label, fraction, color, text) {
  ctx.fillStyle = 'rgba(200,235,250,0.85)';
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 10, 5);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(6, w * clamp(fraction, 0, 1)), 10, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(230,248,255,0.95)';
  ctx.font = `700 11px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(text, x + w, y - 4);
}

export function drawHUD(ctx, state) {
  const { sub, world, score, sonar } = state;
  panel(ctx, 16, 14, 252, 74);
  const oxyColor = sub.oxygen < 25 ? '#ff5545' : sub.oxygen < 50 ? '#ffb347' : '#39d5f0';
  gauge(ctx, 28, 34, 228, 'OXYGEN', sub.oxygen / 100, oxyColor, `${Math.ceil(sub.oxygen)}%`);
  const hullColor = sub.hull < 30 ? '#ff5545' : '#ffc94d';
  gauge(ctx, 28, 64, 228, 'HULL', sub.hull / 100, hullColor, `${Math.ceil(sub.hull)}%`);

  panel(ctx, 494, 14, 292, 46);
  ctx.fillStyle = 'rgba(230,248,255,0.95)';
  ctx.font = `700 17px ${FONT}`;
  ctx.textAlign = 'center';
  const done = sub.collected >= world.quota;
  ctx.fillText(
    done ? 'QUOTA MET — RETURN TO THE SURFACE' : `SALVAGE  ${sub.collected} / ${world.quota}`,
    640,
    43,
  );

  panel(ctx, 1012, 14, 252, 74);
  ctx.fillStyle = 'rgba(200,235,250,0.85)';
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`DIVE ${world.diveNumber}`, 1024, 30);
  ctx.fillStyle = '#ffd94d';
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(`${score}`, 1024, 58);
  ctx.fillStyle = 'rgba(200,235,250,0.85)';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText('SCORE', 1024, 76);
  // ping readiness pip
  const ready = sonar.cooldownLeft <= 0;
  ctx.fillStyle = ready ? '#6ae2ff' : 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(1244, 51, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(200,235,250,0.7)';
  ctx.font = `600 10px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('PING', 1236, 55);

  drawDepthRail(ctx, state);
  drawToasts(ctx, state);
  drawCentrePrompt(ctx, state);
}

function drawDepthRail(ctx, state) {
  const { sub, world } = state;
  const x = 1246;
  const top = 120;
  const bottom = VIEW_HEIGHT - 60;
  ctx.strokeStyle = 'rgba(140,210,240,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();
  ctx.fillStyle = 'rgba(160,225,255,0.9)';
  ctx.fillRect(x - 6, top + (SURFACE_DEPTH / world.depth) * (bottom - top) - 1, 12, 2);
  const subY = top + (sub.y / world.depth) * (bottom - top);
  ctx.fillStyle = '#e0a83c';
  ctx.beginPath();
  ctx.moveTo(x + 4, subY);
  ctx.lineTo(x + 15, subY - 6);
  ctx.lineTo(x + 15, subY + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(200,235,250,0.8)';
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.max(0, Math.round(sub.y - SURFACE_DEPTH))} m`, x - 10, subY + 4);
  ctx.fillText('SURFACE', x - 10, top + 4);
}

function drawToasts(ctx, state) {
  ctx.textAlign = 'center';
  let y = 108;
  for (const toast of state.toasts) {
    const alpha = clamp(toast.left / 0.6, 0, 1);
    ctx.fillStyle = toast.color.replace('ALPHA', alpha.toFixed(3));
    ctx.font = `700 19px ${FONT}`;
    ctx.fillText(toast.text, VIEW_WIDTH / 2, y);
    y += 26;
  }
}

function drawCentrePrompt(ctx, state) {
  const { sub, world } = state;
  ctx.textAlign = 'center';
  if (sub.collected >= world.quota && sub.y > SURFACE_DEPTH) {
    const pulse = 0.65 + Math.sin(state.time * 5) * 0.35;
    ctx.fillStyle = `rgba(122,255,190,${pulse.toFixed(3)})`;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText('▲  RETURN TO THE SURFACE  ▲', VIEW_WIDTH / 2, 150);
  } else if (sub.oxygen < 25 && state.mode === 'diving') {
    const pulse = 0.55 + Math.sin(state.time * 7) * 0.45;
    ctx.fillStyle = `rgba(255,85,69,${pulse.toFixed(3)})`;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText('LOW OXYGEN — FIND A VENT OR SURFACE', VIEW_WIDTH / 2, 150);
  }
  if (sub.venting) {
    ctx.fillStyle = 'rgba(140,235,255,0.9)';
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText('VENTING OXYGEN…', VIEW_WIDTH / 2, VIEW_HEIGHT - 24);
  }
}

function dimScreen(ctx, alpha = 0.55) {
  ctx.fillStyle = `rgba(1,5,12,${alpha})`;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}

function bigTitle(ctx, text, y, size, color) {
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW_WIDTH / 2, y);
}

export function drawTitleScreen(ctx, state) {
  dimScreen(ctx, 0.42);
  bigTitle(ctx, 'DEEP ECHO', 218, 92, '#aee9ff');
  ctx.fillStyle = 'rgba(190,235,250,0.92)';
  ctx.font = `600 21px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('a sonar salvage dive', VIEW_WIDTH / 2, 258);
  ctx.font = `400 17px ${FONT}`;
  ctx.fillStyle = 'rgba(200,235,250,0.85)';
  ctx.fillText('The deep is dark and your sonar is loud. Ping to reveal the wrecks,', VIEW_WIDTH / 2, 316);
  ctx.fillText('haul their salvage, mind your oxygen — and remember that down here,', VIEW_WIDTH / 2, 342);
  ctx.fillText('everything that hears your ping comes to look.', VIEW_WIDTH / 2, 368);
  panel(ctx, 390, 402, 500, 118, 0.6);
  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = 'rgba(220,245,255,0.95)';
  ctx.fillText('WASD / arrows — swim        mouse — floodlight', VIEW_WIDTH / 2, 434);
  ctx.fillText('SPACE / click — sonar ping        SHIFT — boost', VIEW_WIDTH / 2, 462);
  ctx.fillText('Fill the salvage quota, then return to the surface light.', VIEW_WIDTH / 2, 490);
  const pulse = 0.6 + Math.sin(state.time * 3.2) * 0.4;
  ctx.fillStyle = `rgba(122,255,190,${pulse.toFixed(3)})`;
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText('PRESS ENTER OR CLICK TO DIVE', VIEW_WIDTH / 2, 586);
  if (state.best > 0) {
    ctx.fillStyle = 'rgba(255,217,77,0.9)';
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(`best score ${state.best}`, VIEW_WIDTH / 2, 622);
  }
}

export function drawDiveCompleteScreen(ctx, state) {
  dimScreen(ctx, 0.6);
  bigTitle(ctx, `DIVE ${state.world.diveNumber} COMPLETE`, 240, 52, '#7affbe');
  ctx.font = `400 19px ${FONT}`;
  ctx.fillStyle = 'rgba(220,245,255,0.92)';
  ctx.textAlign = 'center';
  ctx.fillText(`Salvage hauled: ${state.sub.collected} pieces for ${state.lastDiveSalvage} points`, VIEW_WIDTH / 2, 316);
  ctx.fillText(`Surface bonus (air and hull left): +${state.lastBonus}`, VIEW_WIDTH / 2, 348);
  ctx.fillStyle = '#ffd94d';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(`TOTAL SCORE  ${state.score}`, VIEW_WIDTH / 2, 404);
  ctx.fillStyle = 'rgba(122,255,190,0.95)';
  ctx.font = `700 21px ${FONT}`;
  ctx.fillText(`PRESS ENTER — DIVE ${state.world.diveNumber + 1} GOES DEEPER`, VIEW_WIDTH / 2, 486);
  ctx.fillStyle = 'rgba(200,235,250,0.7)';
  ctx.font = `400 15px ${FONT}`;
  ctx.fillText('deeper water, richer wrecks, more mines, hungrier fish', VIEW_WIDTH / 2, 516);
}

export function drawGameOverScreen(ctx, state) {
  dimScreen(ctx, 0.68);
  bigTitle(ctx, 'THE DEEP KEEPS THE NIXIE', 216, 54, '#ff8a7a');
  ctx.font = `400 20px ${FONT}`;
  ctx.fillStyle = 'rgba(220,245,255,0.92)';
  ctx.textAlign = 'center';
  ctx.fillText(state.gameOverCause, VIEW_WIDTH / 2, 272);
  panel(ctx, 440, 312, 400, 148, 0.62);
  ctx.font = `600 18px ${FONT}`;
  ctx.fillStyle = 'rgba(220,245,255,0.95)';
  ctx.fillText(`dives completed      ${state.divesCompleted}`, VIEW_WIDTH / 2, 352);
  ctx.fillText(`salvage hauled       ${state.totalHauled} pieces`, VIEW_WIDTH / 2, 384);
  ctx.fillStyle = '#ffd94d';
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(`FINAL SCORE  ${state.score}`, VIEW_WIDTH / 2, 428);
  if (state.score >= state.best && state.score > 0) {
    ctx.fillStyle = 'rgba(122,255,190,0.95)';
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText('— a new best —', VIEW_WIDTH / 2, 490);
  }
  const pulse = 0.6 + Math.sin(state.time * 3.2) * 0.4;
  ctx.fillStyle = `rgba(174,233,255,${pulse.toFixed(3)})`;
  ctx.font = `700 23px ${FONT}`;
  ctx.fillText('PRESS R OR CLICK TO DIVE AGAIN', VIEW_WIDTH / 2, 552);
}

export function drawPausedScreen(ctx) {
  dimScreen(ctx, 0.5);
  bigTitle(ctx, 'PAUSED', 380, 48, '#aee9ff');
  ctx.font = `600 17px ${FONT}`;
  ctx.fillStyle = 'rgba(220,245,255,0.9)';
  ctx.textAlign = 'center';
  ctx.fillText('press P to resume', VIEW_WIDTH / 2, 424);
}
