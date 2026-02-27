'use strict';

/**
 * room2-walker.js — reads DrlgLevel + Room2 data for the current level.
 *
 * Handles two complementary reads that both start from the same DrlgLevel
 * pointer (lvlAddr):
 *
 *   Source 2a — Center warps + adjacent level coord collection:
 *     Read center warp positions from DrlgLevel nRoom_Center_Warp_X/Y arrays.
 *     Walk the DrlgLevel linked list to collect bounding boxes of all adjacent
 *     levels (needed by border-detector to find shared edges).
 *     Also reads staffLevelOffset to detect Tal Rasha's real tomb.
 *
 *   Source 2b — Room2 linked-list walk (current level):
 *     Walk DrlgLevel.ptRoomFirst linked list.
 *     Per room: accumulate bounding box, check ptRoomTiles for exit
 *     connections, scan ptPresetUnits for bosses / waypoints / cairn stones.
 *
 * IMPORTANT: Must be called from within a game lock (tryWithGameLock) held
 * by the caller.  No lock is acquired inside this function.
 *
 * @param {BigInt} lvlAddr        DrlgLevel pointer (from getPlayerLevelAddress)
 * @param {number} currentLevelId Current level ID
 * @param {Set}    allAdjSet      Set of adjacent level IDs (from LEVEL_ADJACENCY)
 * @returns {{
 *   centerWarps:       Array<{subX, subY}>,
 *   adjLevelCoords:    Map<number, {centerSubX, centerSubY, backX, backY, sizeX, sizeY, rooms}>,
 *   curLevelBounds:    {minX, minY, maxX, maxY} | null,   // in subtile coords
 *   roomTileExits:     Array<{subX, subY, destLevelId}>,
 *   presetBosses:      Array<{subX, subY, classId, label}>,
 *   presetWaypoints:   Array<{subX, subY}>,
 *   presetNPCs:        Array<{classId, absSubX, absSubY}>,
 *   presetCairnStones: Array<{subX, subY}>,
 *   realTombLevel:     number,  // 66-72, or 0 if not determined
 *   diag:              string,
 * }}
 */

import { readMemoryFast } from '../lib/memory-helpers.js';
import {
  BOSS_MONSTERS, WAYPOINT_CLASS_IDS, CAIRN_STONE_CLASS_IDS,
} from '../data/poi-constants.js';

// DrlgLevelStrc offsets
const LVL_OFF_LEVEL_ID  = 0x01F8;
const LVL_OFF_WARP_X    = 0x0208;  // nRoom_Center_Warp_X[9]
const LVL_OFF_WARP_Y    = 0x022C;  // nRoom_Center_Warp_Y[9]
const LVL_OFF_NUM_WARPS = 0x0250;  // dwNumCenterWarps

const MAX_LEVELS = 50;  // safety cap for DrlgLevel linked-list walk
const MAX_ROOMS  = 200; // safety cap for Room2 linked-list walk

export function walkRoom2(lvlAddr, currentLevelId, allAdjSet) {
  const centerWarps       = [];
  const adjLevelCoords    = new Map();
  let   curLevelBounds    = null;
  const roomTileExits     = [];
  const presetBosses      = [];
  const presetWaypoints   = [];
  const presetNPCs        = [];
  const presetCairnStones = [];
  let   realTombLevel     = 0;
  let   diag              = '';

  if (!lvlAddr || lvlAddr === 0n) {
    diag = ' noLvlAddr';
    return { centerWarps, adjLevelCoords, curLevelBounds, roomTileExits,
             presetBosses, presetWaypoints, presetNPCs, presetCairnStones,
             realTombLevel, diag };
  }

  // ── Source 2a: center warps + adjacent level bounding boxes ────────────────

  try {
    // Read level ID + warp arrays in one read
    const buf = readMemoryFast(lvlAddr + BigInt(LVL_OFF_LEVEL_ID),
      LVL_OFF_NUM_WARPS - LVL_OFF_LEVEL_ID + 4);
    const dv = new DataView(buf.buffer, buf.byteOffset);
    const id = dv.getInt32(0, true);

    if (id !== currentLevelId) {
      diag += ` idMismatch(${id})`;
    } else {
      // Read center warps
      const warpXOff    = LVL_OFF_WARP_X    - LVL_OFF_LEVEL_ID;
      const warpYOff    = LVL_OFF_WARP_Y    - LVL_OFF_LEVEL_ID;
      const numWarpsOff = LVL_OFF_NUM_WARPS - LVL_OFF_LEVEL_ID;
      const numWarps = dv.getUint32(numWarpsOff, true);
      diag += ` nw=${numWarps}`;
      for (let i = 0; i < Math.min(numWarps, 9); i++) {
        const wx = dv.getInt32(warpXOff + i * 4, true);
        const wy = dv.getInt32(warpYOff + i * 4, true);
        if (wx !== 0 || wy !== 0) centerWarps.push({ subX: wx, subY: wy });
      }

      // Read DrlgStrc pointer (DrlgLevel+0x1C8)
      const drlgBuf = readMemoryFast(lvlAddr + 0x1C8n, 8);
      const drlgStructPtr = new DataView(drlgBuf.buffer, drlgBuf.byteOffset)
        .getBigUint64(0, true);

      // Detect real Tal Rasha tomb via staffLevelOffset (DrlgStrc+0x120)
      if (drlgStructPtr && drlgStructPtr !== 0n) {
        try {
          const staffBuf = readMemoryFast(drlgStructPtr + 0x120n, 4);
          const staffOff = new DataView(staffBuf.buffer, staffBuf.byteOffset)
            .getUint32(0, true);
          diag += ` staffOff=${staffOff}`;
          if (staffOff >= 66 && staffOff <= 72) {
            realTombLevel = staffOff;
            diag += ` realTomb=L${realTombLevel}`;
          } else if (staffOff <= 6) {
            realTombLevel = 66 + staffOff;
            diag += ` realTomb=L${realTombLevel}(offset)`;
          }
        } catch (ex) { diag += ` staffErr=${ex.message}`; }
      } else {
        diag += ` drlgNULL`;
      }

      // Walk DrlgLevel linked list to collect adjacent level Room2 bounds
      let startLvl = 0n;
      if (drlgStructPtr && drlgStructPtr !== 0n) {
        const headBuf = readMemoryFast(drlgStructPtr + 0x868n, 8);
        startLvl = new DataView(headBuf.buffer, headBuf.byteOffset)
          .getBigUint64(0, true);
      }
      if (!startLvl || startLvl === 0n) startLvl = lvlAddr;

      let lp = startLvl;
      let lvlCount = 0;
      const visited = new Set();
      while (lp && lp !== 0n && lvlCount < MAX_LEVELS && !visited.has(lp)) {
        visited.add(lp);
        lvlCount++;

        const metaBuf = readMemoryFast(lp + 0x1B8n, 0x44);
        const mDV = new DataView(metaBuf.buffer, metaBuf.byteOffset);
        const nextLvl   = mDV.getBigUint64(0x00, true);
        const thisLvlId = mDV.getInt32(0x40, true);

        if (thisLvlId > 0 && allAdjSet.has(thisLvlId)) {
          // Walk this adj level's Room2 list for actual absolute tile bounds.
          // DrlgLevel.tCoords uses DRLG-relative tiles (different coord system)
          // so we bypass it and use Room2.tRoomCoords directly.
          const adjRFBuf = readMemoryFast(lp + 0x10n, 8);
          const adjRoomFirst = new DataView(adjRFBuf.buffer, adjRFBuf.byteOffset)
            .getBigUint64(0, true);

          if (adjRoomFirst && adjRoomFirst !== 0n && adjRoomFirst > 0x10000n) {
            let aMinX = Infinity, aMinY = Infinity;
            let aMaxX = -Infinity, aMaxY = -Infinity;
            let aRoom = adjRoomFirst;
            let aCount = 0;
            const aVis = new Set();
            while (aRoom && aRoom !== 0n && aRoom > 0x10000n
                   && aCount < 40 && !aVis.has(aRoom)) {
              aVis.add(aRoom);
              aCount++;
              try {
                // Read ptDrlgRoomNext(+0x48) .. tRoomCoords(+0x60) in one shot
                const arBuf = readMemoryFast(aRoom + 0x48n, 0x28);
                const arDv = new DataView(arBuf.buffer, arBuf.byteOffset);
                const abx = arDv.getInt32(0x18, true); // tRoomCoords.backX
                const aby = arDv.getInt32(0x1C, true); // tRoomCoords.backY
                const asx = arDv.getInt32(0x20, true); // tRoomCoords.sizeX
                const asy = arDv.getInt32(0x24, true); // tRoomCoords.sizeY
                aMinX = Math.min(aMinX, abx);
                aMinY = Math.min(aMinY, aby);
                aMaxX = Math.max(aMaxX, abx + asx);
                aMaxY = Math.max(aMaxY, aby + asy);
                aRoom = arDv.getBigUint64(0, true); // ptDrlgRoomNext
              } catch (_) { break; }
            }
            if (aMinX < Infinity) {
              const centerSubX = Math.round(((aMinX + aMaxX) / 2) * 5);
              const centerSubY = Math.round(((aMinY + aMaxY) / 2) * 5);
              adjLevelCoords.set(thisLvlId, {
                centerSubX, centerSubY,
                backX: aMinX, backY: aMinY,
                sizeX: aMaxX - aMinX, sizeY: aMaxY - aMinY,
                rooms: aCount,
              });
            }
          }
        }

        lp = nextLvl;
      }
      diag += ` lvls=${lvlCount} adjFound=${adjLevelCoords.size}`;
    }
  } catch (e) {
    diag += ` cwErr=${e.message}`;
  }

  // ── Source 2b: current level Room2 walk (bounds, ptRoomTiles, presets) ──────

  try {
    const rfBuf = readMemoryFast(lvlAddr + 0x10n, 8);
    let room2Ptr = new DataView(rfBuf.buffer, rfBuf.byteOffset)
      .getBigUint64(0, true);

    let tMinX = Infinity, tMinY = Infinity;
    let tMaxX = -Infinity, tMaxY = -Infinity;
    let roomCount = 0;
    const roomVisited = new Set();
    const bossMap = BOSS_MONSTERS[currentLevelId];

    while (room2Ptr && room2Ptr !== 0n && room2Ptr > 0x10000n
           && roomCount < MAX_ROOMS && !roomVisited.has(room2Ptr)) {
      roomVisited.add(room2Ptr);
      roomCount++;
      try {
        // Read ptDrlgRoomNext(+0x48), tRoomCoords(+0x60), ptRoomTiles(+0x78),
        // ptPresetUnits(+0x98) in a single 0x58-byte read.
        const rBuf = readMemoryFast(room2Ptr + 0x48n, 0x58);
        const rDv = new DataView(rBuf.buffer, rBuf.byteOffset);
        const rtX = rDv.getInt32(0x18, true); // tRoomCoords.backX
        const rtY = rDv.getInt32(0x1C, true); // tRoomCoords.backY
        const rsX = rDv.getInt32(0x20, true); // tRoomCoords.sizeX
        const rsY = rDv.getInt32(0x24, true); // tRoomCoords.sizeY
        tMinX = Math.min(tMinX, rtX);
        tMinY = Math.min(tMinY, rtY);
        tMaxX = Math.max(tMaxX, rtX + rsX);
        tMaxY = Math.max(tMaxY, rtY + rsY);

        // --- ptRoomTiles (+0x78 = base+0x30): exit connections to other levels ---
        const rtilePtr = rDv.getBigUint64(0x30, true); // +0x78 - 0x48 = 0x30
        if (rtilePtr && rtilePtr !== 0n && rtilePtr > 0x10000n) {
          let wPtr = rtilePtr;
          for (let wi = 0; wi < 8 && wPtr && wPtr !== 0n; wi++) {
            try {
              const wBuf = readMemoryFast(wPtr, 24);
              const wDv = new DataView(wBuf.buffer, wBuf.byteOffset);
              const destRoom = wDv.getBigUint64(0, true);
              const nextTile = wDv.getBigUint64(8, true);
              if (destRoom && destRoom !== 0n && destRoom > 0x10000n) {
                try {
                  const dlBuf = readMemoryFast(destRoom + 0x90n, 8);
                  const dlPtr = new DataView(dlBuf.buffer, dlBuf.byteOffset)
                    .getBigUint64(0, true);
                  if (dlPtr && dlPtr !== 0n && dlPtr > 0x10000n) {
                    const dlIdBuf = readMemoryFast(dlPtr + 0x1F8n, 4);
                    const dlId = new DataView(dlIdBuf.buffer, dlIdBuf.byteOffset)
                      .getInt32(0, true);
                    if (dlId > 0 && dlId <= 150 && dlId !== currentLevelId) {
                      const cSubX = Math.round((rtX + rsX / 2) * 5);
                      const cSubY = Math.round((rtY + rsY / 2) * 5);
                      roomTileExits.push({ subX: cSubX, subY: cSubY, destLevelId: dlId });
                    }
                  }
                } catch (_) {}
              }
              wPtr = nextTile;
            } catch (_) { break; }
          }
        }

        // --- ptPresetUnits (+0x98 = base+0x50): bosses, waypoints, cairn stones ---
        const presetPtr = rDv.getBigUint64(0x50, true); // +0x98 - 0x48 = 0x50
        if (presetPtr && presetPtr !== 0n && presetPtr > 0x10000n) {
          let pPtr = presetPtr;
          for (let pi = 0; pi < 50 && pPtr && pPtr !== 0n && pPtr > 0x10000n; pi++) {
            try {
              // D2PresetUnitStrc (x64): type(+0), classId(+4),
              // posX(+0x08, room-relative subtiles), pNext(+0x10),
              // posY(+0x24, room-relative subtiles)
              const pBuf = readMemoryFast(pPtr, 0x28);
              const pDv = new DataView(pBuf.buffer, pBuf.byteOffset);
              const pType   = pDv.getUint32(0, true);
              const pClassId = pDv.getUint32(4, true);
              const pPosX   = pDv.getUint32(0x08, true);
              const pPosY   = pDv.getUint32(0x24, true);
              const pNext   = pDv.getBigUint64(0x10, true);

              // Absolute subtile = roomBackTile * 5 + room-relative subtile
              const absSubX = rtX * 5 + pPosX;
              const absSubY = rtY * 5 + pPosY;

              if (pType === 1 && bossMap) {
                const lbl = bossMap.get(pClassId);
                if (lbl) presetBosses.push({ subX: absSubX, subY: absSubY, classId: pClassId, label: lbl });
                presetNPCs.push({ classId: pClassId, absSubX, absSubY });
              }
              if (pType === 0 && WAYPOINT_CLASS_IDS.has(pClassId)) {
                presetWaypoints.push({ subX: absSubX, subY: absSubY });
              }
              if (pType === 0 && currentLevelId === 4 && CAIRN_STONE_CLASS_IDS.has(pClassId)) {
                presetCairnStones.push({ subX: absSubX, subY: absSubY });
              }

              pPtr = pNext;
            } catch (_) { break; }
          }
        }

        room2Ptr = rDv.getBigUint64(0, true); // ptDrlgRoomNext
      } catch (_) { break; }
    }

    diag += ` rWalk=${roomCount}`;
    diag += ` tBB=${tMinX},${tMinY}-${tMaxX},${tMaxY}`;

    if (roomTileExits.length > 0) {
      diag += ` rtExits=[${roomTileExits.map(r => `L${r.destLevelId}@${r.subX},${r.subY}`).join(' ')}]`;
    }
    if (presetBosses.length > 0) {
      diag += ` presets=[${presetBosses.map(p => `c${p.classId}@${p.subX},${p.subY}`).join(' ')}]`;
    }
    if (presetWaypoints.length > 0) {
      diag += ` pWP=[${presetWaypoints.map(p => `${p.subX},${p.subY}`).join(' ')}]`;
    }
    if (presetNPCs.length > 0) {
      diag += ` pNPC=[${presetNPCs.map(p => `c${p.classId}@${p.absSubX},${p.absSubY}`).join(' ')}]`;
    }
    if (presetCairnStones.length > 0) {
      diag += ` pCS=[${presetCairnStones.map(p => `${p.subX},${p.subY}`).join(' ')}]`;
    }

    if (tMinX < Infinity) {
      curLevelBounds = {
        minX: tMinX * 5, minY: tMinY * 5,
        maxX: tMaxX * 5, maxY: tMaxY * 5,
      };
      diag += ` sBB=${curLevelBounds.minX},${curLevelBounds.minY}-${curLevelBounds.maxX},${curLevelBounds.maxY}`;
    }
  } catch (e) {
    diag += ` rwErr=${e.message}`;
  }

  return {
    centerWarps, adjLevelCoords, curLevelBounds, roomTileExits,
    presetBosses, presetWaypoints, presetNPCs, presetCairnStones,
    realTombLevel, diag,
  };
}
