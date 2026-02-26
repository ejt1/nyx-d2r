'use strict';

/**
 * poi-renderer.js — draws diamond markers + text labels for POIs on the automap.
 *
 * Provides three public functions:
 *   clearExits(exitKeys)              — remove all tracked background elements
 *   redrawPois(pois, me, exitKeys, levelId, rebuildDiag)
 *                                     — convert coords + draw all POIs
 *   drawPoi(idx, cx, cy, …, exitKeys) — draw one POI (diamond + line + labels)
 */

import { background } from 'gui';
import { tryWithGameLock } from 'nyx:memory';
import { POI_EXIT, POI_GOOD_EXIT, POI_WAYPOINT, POI_QUEST, POI_NPC }
  from '../data/poi-constants.js';

const _d2r = internalBinding('d2r');
const worldToAutomap = _d2r.worldToAutomap.bind(_d2r);

// Colors — 0xAABBGGRR
const COLOR_EXIT        = 0xFFFF00FF; // magenta (diamond outline)
const COLOR_LINE        = 0x80FF00FF; // magenta 50% alpha (line to exit)
const COLOR_WP          = 0xFF00FFFF; // yellow (waypoint diamond)
const COLOR_WP_LINE     = 0x8000FFFF; // yellow 50% alpha (waypoint line)
const COLOR_GOOD_EXIT   = 0xFF00FF00; // green (real tomb / Tristram)
const COLOR_GOOD_LINE   = 0x8000FF00; // green 50% alpha
const COLOR_QUEST       = 0xFF00FF00; // green (quest item)
const COLOR_QUEST_LINE  = 0x8000FF00; // green 50% alpha
const COLOR_NPC         = 0xFF0000FF; // red (NPC/boss spawn)
const COLOR_NPC_LINE    = 0x800000FF; // red 50% alpha
const COLOR_LINE_LABEL  = 0xFF800080; // dark purple (mid-line label text)
const COLOR_TEXT        = 0xFFFFFFFF; // white
const COLOR_TEXT_SHADOW = 0xFF000000; // black (text shadow)

// Geometry and rendering constants
const DIAMOND_W        = 10;   // diamond half-width in pixels
const DIAMOND_H        = 7;    // diamond half-height in pixels
const TEXT_OFFSET_X    = 14;   // label x offset from diamond centre
const TEXT_OFFSET_Y    = -10;  // label y offset from diamond centre
const LINE_THICK       = 2.0;
const EXIT_LINE_THICK  = 1.5;  // line from player to exit
const FONT_SIZE_MARKER = 18;   // diamond label text
const FONT_SIZE_LINE   = 22;   // mid-line label text
const SCREEN_COORD_MAX = 100000;

// -------------------------------------------------------------------------
// clearExits
// -------------------------------------------------------------------------

/**
 * Remove all POI background elements tracked by exitKeys.
 * @param {Set<string>} exitKeys
 */
export function clearExits(exitKeys) {
  try { background.remove('exit-diag'); } catch (_) {}
  try { background.remove('exit-err');  } catch (_) {}
  for (const key of exitKeys) background.remove(key);
  exitKeys.clear();
}

// -------------------------------------------------------------------------
// drawPoi
// -------------------------------------------------------------------------

/**
 * Draw one POI: line from player, mid-line label, diamond, text label.
 *
 * @param {number}  idx       POI index (used to build unique element keys)
 * @param {number}  cx        Screen X of the POI
 * @param {number}  cy        Screen Y of the POI
 * @param {string}  poiType   POI_* constant
 * @param {string}  label     Display label
 * @param {number}  playerSX  Player screen X
 * @param {number}  playerSY  Player screen Y
 * @param {boolean} showLine  Whether to draw the line from player
 * @param {Set<string>} nextKeys  Accumulates all added element keys
 */
export function drawPoi(idx, cx, cy, poiType, label, playerSX, playerSY, showLine, nextKeys) {
  const k = `poi-${idx}`;

  // Pick colors based on POI type
  let diamondColor, lineColor;
  switch (poiType) {
    case POI_WAYPOINT:
      diamondColor = COLOR_WP;
      lineColor    = COLOR_WP_LINE;
      break;
    case POI_GOOD_EXIT:
      diamondColor = COLOR_GOOD_EXIT;
      lineColor    = COLOR_GOOD_LINE;
      break;
    case POI_QUEST:
      diamondColor = COLOR_QUEST;
      lineColor    = COLOR_QUEST_LINE;
      break;
    case POI_NPC:
      diamondColor = COLOR_NPC;
      lineColor    = COLOR_NPC_LINE;
      break;
    default: // POI_EXIT
      diamondColor = COLOR_EXIT;
      lineColor    = COLOR_LINE;
      break;
  }

  // --- Line from player to POI ---
  if (showLine &&
      Number.isFinite(playerSX) && Number.isFinite(playerSY) &&
      Number.isFinite(cx)       && Number.isFinite(cy) &&
      playerSX >= 0             && playerSY >= 0 &&
      Math.abs(playerSX) <= SCREEN_COORD_MAX &&
      Math.abs(playerSY) <= SCREEN_COORD_MAX &&
      Math.abs(cx)       <= SCREEN_COORD_MAX &&
      Math.abs(cy)       <= SCREEN_COORD_MAX) {
    background.addLine(`${k}-line`, [playerSX, playerSY], [cx, cy],
      lineColor, EXIT_LINE_THICK);
    nextKeys.add(`${k}-line`);

    // Mid-line label: placed 70px along the line from the player
    const dx = cx - playerSX;
    const dy = cy - playerSY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 80 && dist < SCREEN_COORD_MAX) {
      const t = Math.min(70 / dist, 0.45);
      const mlx = Math.round(playerSX + dx * t);
      const mly = Math.round(playerSY + dy * t);
      const displayMid = label || 'Exit';
      // Perpendicular offset for readability
      const perpX = Math.round((-dy / dist) * 8);
      const perpY = Math.round(( dx / dist) * 8);
      background.addText(`${k}-ml-s`, [mlx + perpX + 1, mly + perpY + 1],
        COLOR_TEXT_SHADOW, displayMid, FONT_SIZE_LINE);
      background.addText(`${k}-ml`,   [mlx + perpX,     mly + perpY],
        COLOR_LINE_LABEL, displayMid, FONT_SIZE_LINE);
      nextKeys.add(`${k}-ml-s`);
      nextKeys.add(`${k}-ml`);
    }
  }

  // --- Diamond marker ---
  const dw = poiType === POI_GOOD_EXIT ? DIAMOND_W + 2 : DIAMOND_W;
  const dh = poiType === POI_GOOD_EXIT ? DIAMOND_H + 2 : DIAMOND_H;
  const top    = [cx,      cy - dh];
  const right  = [cx + dw, cy     ];
  const bottom = [cx,      cy + dh];
  const left   = [cx - dw, cy     ];

  background.addLine(`${k}-tl`, top,    right,  diamondColor, LINE_THICK);
  background.addLine(`${k}-tr`, right,  bottom, diamondColor, LINE_THICK);
  background.addLine(`${k}-br`, bottom, left,   diamondColor, LINE_THICK);
  background.addLine(`${k}-bl`, left,   top,    diamondColor, LINE_THICK);

  // --- Text label (shadow + foreground) ---
  const displayName = label || 'Exit';
  background.addText(`${k}-shadow`, [cx + TEXT_OFFSET_X + 1, cy + TEXT_OFFSET_Y + 1],
    COLOR_TEXT_SHADOW, displayName, FONT_SIZE_MARKER);
  background.addText(`${k}-text`,   [cx + TEXT_OFFSET_X,     cy + TEXT_OFFSET_Y],
    COLOR_TEXT, displayName, FONT_SIZE_MARKER);
  nextKeys.add(`${k}-tl`);
  nextKeys.add(`${k}-tr`);
  nextKeys.add(`${k}-br`);
  nextKeys.add(`${k}-bl`);
  nextKeys.add(`${k}-shadow`);
  nextKeys.add(`${k}-text`);
}

// -------------------------------------------------------------------------
// redrawPois
// -------------------------------------------------------------------------

/**
 * Convert POI positions to screen coords then draw all markers.
 *
 * @param {Array}       pois         POI list from buildPois()
 * @param {object}      me           Player unit
 * @param {Set<string>} exitKeys     Accumulates all added element keys
 * @param {number}      levelId      Current level ID (for diagnostic label)
 * @param {string}      rebuildDiag  Last rebuild diagnostic string
 */
export function redrawPois(pois, me, exitKeys, levelId, rebuildDiag) {
  const stats = {
    attempted: true,
    projected: false,
    reconciled: false,
    cleared: false,
    removed: 0,
    drawn: 0,
    keyCount: 0,
  };

  if (pois.length === 0) {
    stats.projected = true;
    stats.cleared = true;
    stats.removed = exitKeys.size;
    clearExits(exitKeys);
    return stats;
  }

  // Convert client coords → screen coords under game lock.
  // worldToAutomap returns (-1,-1) when the automap is unavailable.
  // Negative screen coords are valid (off-screen; ImGui clips lines).
  const results = [];
  const playerSX = me.automapX;
  const playerSY = me.automapY;
  const projected = tryWithGameLock(() => {
    for (let i = 0; i < pois.length; i++) {
      const p = pois[i];
      const screen = worldToAutomap(p.clientX, p.clientY);
      if (screen.x === -1 && screen.y === -1) continue;
      if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) continue;
      if (Math.abs(screen.x) > SCREEN_COORD_MAX ||
          Math.abs(screen.y) > SCREEN_COORD_MAX) continue;
      results.push({
        idx: i, cx: screen.x, cy: screen.y,
        poiType: p.poiType, label: p.label,
        showLine: p.showLine !== false,
      });
    }
    return true;
  }, 100);
  if (projected !== true) return stats;
  stats.projected = true;

  // Draw outside lock and reconcile with previously drawn keys.
  const nextKeys = new Set();
  for (const r of results) {
    drawPoi(r.idx, r.cx, r.cy, r.poiType, r.label,
      playerSX, playerSY, r.showLine, nextKeys);
  }
  let removedCount = 0;
  for (const key of exitKeys) {
    if (!nextKeys.has(key)) {
      background.remove(key);
      removedCount++;
    }
  }
  exitKeys.clear();
  for (const key of nextKeys) {
    exitKeys.add(key);
  }

  stats.reconciled = true;
  stats.removed = removedCount;
  stats.drawn = results.length;
  stats.keyCount = nextKeys.size;
  return stats;
}
