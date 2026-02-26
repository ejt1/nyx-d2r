'use strict';

/**
 * poi-builder.js — assembles the final POI list from all detected sources.
 *
 * Inputs:
 *   - tileUnits / roomTileExits / roomExits  (from tile-exit-reader + border-detector)
 *   - preset arrays                          (from room2-walker)
 *   - objMgr                                 (for live Source 3 game-object scan)
 *
 * The Source 3 object scan acquires its own short game lock internally.
 * The boss-monster fallback also acquires a short game lock.
 *
 * IMPORTANT: tileUnits bounds-filtering and all POI assembly run outside any
 * lock.  Callers must NOT hold a game lock when calling buildPois().
 *
 * @returns {{ pois, needsBossRescan, realTombLevel, diag }}
 */

import { tryWithGameLock } from 'nyx:memory';
import { readMemoryFast } from '../lib/memory-helpers.js';
import {
  POI_EXIT, POI_GOOD_EXIT, POI_WAYPOINT, POI_QUEST, POI_NPC,
  WAYPOINT_CLASS_IDS, QUEST_OBJECT_IDS, CAIRN_STONE_CLASS_IDS,
  BOSS_MONSTERS, NIHLATHAK_FLIP,
} from '../data/poi-constants.js';
import { LEVEL_NAMES } from '../data/level-names.js';
import { LEVEL_ADJACENCY, MAP_EDGE_ADJACENCY } from '../data/level-adjacency.js';
import { NEXT_EXITS } from '../data/next-exits.js';

function subtileToClient(subX, subY) {
  return { x: (subX - subY) * 16, y: (subX + subY) * 8 };
}

/**
 * Build the final POI list from all sources.
 *
 * @param {object} opts
 * @param {number}  opts.currentLevelId
 * @param {object}  opts.objMgr
 * @param {Array}   opts.tileUnits          All Type-5 units with positions
 * @param {Array}   opts.roomTileExits      Exits from Room2.ptRoomTiles walk
 * @param {Array}   opts.roomExits          Outdoor exits from border detection
 * @param {Array}   opts.presetBosses
 * @param {Array}   opts.presetWaypoints
 * @param {Array}   opts.presetNPCs
 * @param {Array}   opts.presetCairnStones
 * @param {Map}     opts.adjLevelCoords     levelId → {centerSubX,centerSubY,…}
 * @param {object|null} opts.curLevelBounds {minX,minY,maxX,maxY} in subtiles
 * @param {number}  opts.realTombLevel      Real Tal Rasha tomb level (0 = unknown)
 * @returns {{ pois: Array, needsBossRescan: boolean, realTombLevel: number, diag: string }}
 */
export function buildPois({
  currentLevelId, objMgr,
  tileUnits, roomTileExits, roomExits,
  presetBosses, presetWaypoints, presetNPCs, presetCairnStones,
  adjLevelCoords, curLevelBounds, realTombLevel: inRealTombLevel,
}) {
  let diag = '';
  const pois = [];
  let realTombLevel = inRealTombLevel || 0;

  // ---- Filter tileUnits to current level bounds ----------------------------
  // Removes tiles from adjacent dungeon levels that share the same memory
  // region but whose coordinates lie outside the current level grid.
  const filtTiles = tileUnits.slice();
  if (curLevelBounds) {
    const margin = 10;
    const lb = curLevelBounds;
    for (let i = filtTiles.length - 1; i >= 0; i--) {
      const t = filtTiles[i];
      if (t.posX < lb.minX - margin || t.posX > lb.maxX + margin ||
          t.posY < lb.minY - margin || t.posY > lb.maxY + margin) {
        diag += ` tOOB:c${t.classId}@${t.posX},${t.posY}`;
        filtTiles.splice(i, 1);
      }
    }
  }

  // ---- Source 3: Type 2 (GameObject) units — waypoints + quest items -------
  const objCandidates = []; // { cid, px, py }
  const objects = objMgr.getUnits(2);
  if (objects) {
    tryWithGameLock(() => {
      for (const [, obj] of objects) {
        const cid = obj.classId;
        const isCairnStone = currentLevelId === 4 && CAIRN_STONE_CLASS_IDS.has(cid);
        if (!isCairnStone && !WAYPOINT_CLASS_IDS.has(cid) &&
            !(QUEST_OBJECT_IDS.has(cid) && currentLevelId !== 75)) continue;

        let px = obj.posX;
        let py = obj.posY;

        // Objects use static paths; posX/posY may be zero.
        if (px === 0 && py === 0) {
          try {
            const addr = obj._address;
            if (addr && addr !== 0n) {
              const pathBuf = readMemoryFast(addr + 0x38n, 8);
              const pathPtr = new DataView(pathBuf.buffer, pathBuf.byteOffset)
                .getBigUint64(0, true);
              if (pathPtr && pathPtr !== 0n) {
                const posBuf = readMemoryFast(pathPtr + 0x10n, 8);
                const pdv = new DataView(posBuf.buffer, posBuf.byteOffset);
                px = pdv.getUint32(0, true);
                py = pdv.getUint32(4, true);
              }
            }
          } catch (_) {}
        }
        if (px === 0 && py === 0) continue;
        objCandidates.push({ cid, px, py });
      }
      return true;
    }, 200);
  }

  // ---- Waypoint + quest POIs -----------------------------------------------
  let wpCount = 0;
  let questCount = 0;
  for (const { cid, px, py } of objCandidates) {
    if (WAYPOINT_CLASS_IDS.has(cid)) {
      const c = subtileToClient(px, py);
      pois.push({
        subX: px, subY: py,
        clientX: c.x, clientY: c.y,
        destLevelId: 0, poiType: POI_WAYPOINT, label: 'Waypoint',
        showLine: true,
      });
      wpCount++;
    } else if (currentLevelId === 4 && CAIRN_STONE_CLASS_IDS.has(cid)) {
      continue; // collected below for Tristram centroid
    } else if (QUEST_OBJECT_IDS.has(cid) && currentLevelId !== 75) {
      if (currentLevelId === 4 && cid === 8) continue; // skip Tome in Stony Field
      const c = subtileToClient(px, py);
      pois.push({
        subX: px, subY: py,
        clientX: c.x, clientY: c.y,
        destLevelId: 0, poiType: POI_QUEST,
        label: QUEST_OBJECT_IDS.get(cid) || 'Quest',
        showLine: true,
      });
      questCount++;
    }
  }

  // ---- Tristram portal from ObjectManager Cairn Stones (nearby fallback) ---
  if (currentLevelId === 4 && presetCairnStones.length === 0) {
    const cairnObjs = objCandidates.filter(o => CAIRN_STONE_CLASS_IDS.has(o.cid));
    if (cairnObjs.length > 0) {
      let sumX = 0, sumY = 0;
      for (const co of cairnObjs) { sumX += co.px; sumY += co.py; }
      const cx = Math.round(sumX / cairnObjs.length);
      const cy = Math.round(sumY / cairnObjs.length);
      const sc = subtileToClient(cx, cy);
      pois.push({
        subX: cx, subY: cy,
        clientX: sc.x, clientY: sc.y,
        destLevelId: 38, poiType: POI_GOOD_EXIT,
        label: '\u2605 Tristram',
        showLine: true,
      });
      diag += ` tristramObj=${cx},${cy}(${cairnObjs.length}stones)`;
    }
  }

  // ---- Preset waypoints: fill in waypoints not yet found via ObjectManager --
  // Room2.ptPresetUnits data is distance-independent; ObjectManager only has
  // nearby objects.
  if (presetWaypoints.length > 0) {
    const existingWPs = pois.filter(p => p.poiType === POI_WAYPOINT);
    for (const pw of presetWaypoints) {
      const alreadyCovered = existingWPs.some(wp =>
        Math.abs(wp.subX - pw.subX) < 50 && Math.abs(wp.subY - pw.subY) < 50);
      if (!alreadyCovered) {
        const c = subtileToClient(pw.subX, pw.subY);
        pois.push({
          subX: pw.subX, subY: pw.subY,
          clientX: c.x, clientY: c.y,
          destLevelId: 0, poiType: POI_WAYPOINT, label: 'Waypoint',
          showLine: true,
        });
        wpCount++;
        diag += ` presetWP@${pw.subX},${pw.subY}`;
      }
    }
  }
  diag += ` wp=${wpCount} q=${questCount}`;

  // ---- Boss monster POIs ---------------------------------------------------
  const bossMap = BOSS_MONSTERS[currentLevelId];
  let bossCount = 0;
  let needsBossRescan = false;
  if (bossMap) {
    // Special handling for Nihlathak (level 124): preset NPC spawns opposite.
    if (currentLevelId === 124 && presetBosses.length === 0 &&
        presetNPCs.length > 0 && curLevelBounds) {
      const lvlOrigX = curLevelBounds.minX;
      const lvlOrigY = curLevelBounds.minY;
      for (const npc of presetNPCs) {
        const levelRelX = npc.absSubX - lvlOrigX;
        const levelRelY = npc.absSubY - lvlOrigY;
        const key = `${levelRelX},${levelRelY}`;
        const flip = NIHLATHAK_FLIP[key];
        if (flip) {
          presetBosses.push({
            subX: lvlOrigX + flip[0],
            subY: lvlOrigY + flip[1],
            classId: 526, label: 'Nihlathak',
          });
          diag += ` nihlFlip:${key}->${flip[0]},${flip[1]}`;
          break;
        }
      }
    }

    if (presetBosses.length > 0) {
      for (const pb of presetBosses) {
        const c = subtileToClient(pb.subX, pb.subY);
        pois.push({
          subX: pb.subX, subY: pb.subY,
          clientX: c.x, clientY: c.y,
          destLevelId: 0, poiType: POI_NPC,
          label: pb.label, showLine: true,
        });
        bossCount++;
        diag += ` presetBoss:${pb.classId}(${pb.label})@${pb.subX},${pb.subY}`;
      }
    } else {
      // Fallback: scan live monsters (only works when nearby)
      const monsters = objMgr.getUnits(1);
      if (monsters) {
        tryWithGameLock(() => {
          for (const [, mon] of monsters) {
            const label = bossMap.get(mon.classId);
            if (!label) continue;
            const px = mon.posX;
            const py = mon.posY;
            if (px === 0 && py === 0) continue;
            const c = subtileToClient(px, py);
            pois.push({
              subX: px, subY: py,
              clientX: c.x, clientY: c.y,
              destLevelId: 0, poiType: POI_NPC,
              label, showLine: true,
            });
            bossCount++;
            diag += ` liveBoss:${mon.classId}(${label})@${px},${py}`;
          }
          return true;
        }, 200);
      }
      needsBossRescan = (bossCount === 0);
    }
  }
  diag += ` boss=${bossCount}`;

  // ---- Build exit POIs (three phases) --------------------------------------
  const mapAdj    = MAP_EDGE_ADJACENCY[currentLevelId] || [];
  const allAdj    = LEVEL_ADJACENCY[currentLevelId] || [];
  const mapAdjSet = new Set(mapAdj);
  const usedAdj   = new Set();

  // Diagnostic: show adjacent level centers
  const adjDiag = [];
  for (const adjId of allAdj) {
    const coords = adjLevelCoords.get(adjId);
    if (coords) {
      const kind = mapAdjSet.has(adjId) ? 'O' : 'D';
      adjDiag.push(`${kind}:L${adjId}(${LEVEL_NAMES[adjId] || '?'})@${coords.centerSubX},${coords.centerSubY}`);
    } else {
      adjDiag.push(`L${adjId}(${LEVEL_NAMES[adjId] || '?'})=NOCOORDS`);
    }
  }
  diag += ` adj=[${adjDiag.join(' ')}]`;

  // Phase 1: tileUnits with known destinations (from ptRoomTiles reads)
  const matchDiag = [];
  for (const t of filtTiles) {
    if (!t.destLevelId || t.destLevelId === 0) continue;
    if (usedAdj.has(t.destLevelId)) continue;
    if (!allAdj.includes(t.destLevelId)) continue;
    const c = subtileToClient(t.posX, t.posY);
    pois.push({
      subX: t.posX, subY: t.posY,
      clientX: c.x, clientY: c.y,
      destLevelId: t.destLevelId, poiType: POI_EXIT,
      label: LEVEL_NAMES[t.destLevelId] || `Level ${t.destLevelId}`,
      showLine: true,
    });
    usedAdj.add(t.destLevelId);
    matchDiag.push(`c${t.classId}\u2192KNOWN:L${t.destLevelId}`);
  }
  diag += ` known=[${matchDiag.join(' ')}]`;

  // Phase 1.5: Room2.ptRoomTiles exits — all room exits including distant tombs
  const rtDiag = [];
  for (const rte of roomTileExits) {
    if (usedAdj.has(rte.destLevelId)) continue;
    if (!allAdj.includes(rte.destLevelId)) continue;
    const c = subtileToClient(rte.subX, rte.subY);
    pois.push({
      subX: rte.subX, subY: rte.subY,
      clientX: c.x, clientY: c.y,
      destLevelId: rte.destLevelId, poiType: POI_EXIT,
      label: LEVEL_NAMES[rte.destLevelId] || `Level ${rte.destLevelId}`,
      showLine: true,
    });
    usedAdj.add(rte.destLevelId);
    rtDiag.push(`rt\u2192L${rte.destLevelId}@${rte.subX},${rte.subY}`);
  }
  if (rtDiag.length > 0) diag += ` rtMatch=[${rtDiag.join(' ')}]`;

  // Phase 2: outdoor exits from shared tile border detection
  for (const re of roomExits) {
    if (usedAdj.has(re.destLevelId)) continue;
    const c = subtileToClient(re.subX, re.subY);
    pois.push({
      subX: re.subX, subY: re.subY,
      clientX: c.x, clientY: c.y,
      destLevelId: re.destLevelId, poiType: POI_EXIT,
      label: LEVEL_NAMES[re.destLevelId] || `Level ${re.destLevelId}`,
      showLine: true,
    });
    usedAdj.add(re.destLevelId);
  }

  // ---- Tal Rasha tomb detection (Canyon of the Magi, level 46) -------------
  for (const p of pois) {
    if (currentLevelId === 46 && p.destLevelId >= 66 && p.destLevelId <= 72) {
      if (realTombLevel > 0 && p.destLevelId === realTombLevel) {
        p.poiType = POI_GOOD_EXIT;
        p.label = '\u2605 ' + (LEVEL_NAMES[p.destLevelId] || `Level ${p.destLevelId}`) + ' (Real)';
        p.showLine = true;
      } else {
        p.showLine = false; // fake tomb: marker only, no line
      }
    }
  }

  // ---- Tristram portal from preset Cairn Stones (Stony Field, level 4) -----
  if (currentLevelId === 4 && presetCairnStones.length > 0) {
    let sumX = 0, sumY = 0;
    for (const cs of presetCairnStones) { sumX += cs.subX; sumY += cs.subY; }
    const cx = Math.round(sumX / presetCairnStones.length);
    const cy = Math.round(sumY / presetCairnStones.length);
    const sc = subtileToClient(cx, cy);
    pois.push({
      subX: cx, subY: cy,
      clientX: sc.x, clientY: sc.y,
      destLevelId: 38, poiType: POI_GOOD_EXIT,
      label: '\u2605 Tristram',
      showLine: true,
    });
  }

  // ---- NEXT_EXITS showLine filtering ---------------------------------------
  // Lines drawn only for progression exits; markers always visible.
  const nextExitSet = new Set(NEXT_EXITS[currentLevelId] || []);
  for (const p of pois) {
    if (p.poiType === POI_EXIT) {
      if (p.showLine !== false) {
        p.showLine = nextExitSet.has(p.destLevelId);
      }
    } else if (p.showLine === undefined) {
      p.showLine = true;
    }
  }

  return { pois, needsBossRescan, realTombLevel, diag };
}
