'use strict';

/**
 * tile-exit-reader.js — scans Type 5 (RoomTile) game units and resolves each
 * tile's destination level ID via two strategies:
 *
 *   Strategy B — ptRoomTiles at Room2+0x78: linked list of warp tiles with
 *     destination Room2 pointers → ptLevel(+0x90) → eLevelId(+0x1F8).
 *     Primary source; works for all dungeon entrances and warp tiles.
 *
 *   Strategy C — pUnitData probe at unit+0x10: pure diagnostic (reads the
 *     data pointer but does not extract a level ID from it).
 *
 * Strategy A (ptRoomsNear at Room2+0x10, MSVC vector) has been removed:
 * the near-rooms vector is always empty in D2R (rooms are not linked that way).
 *
 * IMPORTANT: Must be called from within a game lock (tryWithGameLock) held
 * by the caller.  No lock is acquired inside this function.
 *
 * @param {Map} tiles         Type-5 unit map from objMgr.getUnits(5)
 * @param {number} currentLevelId  Current level ID (to exclude self-references)
 * @returns {{ tileExits: Array, tileUnits: Array, diag: string }}
 *   tileExits  — [{ posX, posY, destLevelId, classId }] tiles with known dest
 *   tileUnits  — [{ posX, posY, classId, destLevelId }] ALL tiles with positions
 *   diag       — diagnostic string fragment (prepend to rd in caller)
 */

import { readMemoryFast } from '../lib/memory-helpers.js';

export function scanTileExits(tiles, currentLevelId) {
  const tileExits  = [];
  const tileUnits  = [];
  const allTileDiag = [];
  let diag = `t5=${tiles ? tiles.size : 0}`;

  if (!tiles || tiles.size === 0) return { tileExits, tileUnits, diag };

  for (const [, tile] of tiles) {
    // Tile units (type 5) use a static path — posX/posY on the unit struct
    // (0xD4/0xD6) are typically zero.  Read position from
    // pStaticPath (+0x38) → +0x10 (posX dword) / +0x14 (posY dword).
    let px = 0, py = 0;
    let roomPtr = 0n; // Room2 pointer for this tile

    try {
      const unitAddr = tile._address;
      if (unitAddr && unitAddr !== 0n) {
        const pathBuf = readMemoryFast(unitAddr + 0x38n, 8);
        const pathPtr = new DataView(pathBuf.buffer, pathBuf.byteOffset)
          .getBigUint64(0, true);
        if (pathPtr && pathPtr !== 0n) {
          const posBuf = readMemoryFast(pathPtr + 0x10n, 8);
          const pdv = new DataView(posBuf.buffer, posBuf.byteOffset);
          px = pdv.getUint32(0, true);  // subtile X
          py = pdv.getUint32(4, true);  // subtile Y

          // Read Room1 → Room2 from static path.
          // Tile units use D2StaticPathStrc where Room1 (ActiveRoom) is at
          // offset +0x00 (not +0x20 like DynamicPath).
          // Then ActiveRoom+0x18 → ptDrlgRoom (Room2).
          try {
            const r1Buf = readMemoryFast(pathPtr + 0x00n, 8);
            const r1Ptr = new DataView(r1Buf.buffer, r1Buf.byteOffset)
              .getBigUint64(0, true);
            if (r1Ptr && r1Ptr !== 0n && r1Ptr > 0x10000n) {
              const r2Buf = readMemoryFast(r1Ptr + 0x18n, 8);
              roomPtr = new DataView(r2Buf.buffer, r2Buf.byteOffset)
                .getBigUint64(0, true);
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    // Fall back to unit-level position if static path failed
    if (px === 0 && py === 0) {
      px = tile.posX;
      py = tile.posY;
    }
    if (px === 0 && py === 0) continue;

    let destLevelId = 0;
    let chainInfo = '';

    // --- Strategy B: Read ptRoomTiles at Room2+0x78 ---
    // Linked list of warp tiles; each entry points to a destination Room2.
    // Classic layout: [pDestRoom*, pNext*, nNum]
    if (roomPtr && roomPtr !== 0n) {
      try {
        const rtBuf = readMemoryFast(roomPtr + 0x78n, 8);
        const rtPtr = new DataView(rtBuf.buffer, rtBuf.byteOffset)
          .getBigUint64(0, true);
        if (rtPtr && rtPtr !== 0n && rtPtr > 0x10000n) {
          chainInfo += ` rt=${rtPtr.toString(16).slice(-6)}`;
          let walkPtr = rtPtr;
          for (let wi = 0; wi < 8 && walkPtr && walkPtr !== 0n; wi++) {
            try {
              const wBuf = readMemoryFast(walkPtr, 24);
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
                    if (dlId > 0 && dlId <= 150) {
                      chainInfo += ` rt${wi}->L${dlId}`;
                      if (destLevelId === 0 && dlId !== currentLevelId) {
                        destLevelId = dlId;
                      }
                    }
                  }
                } catch (_) {}
              }
              walkPtr = nextTile;
            } catch (_) { break; }
          }
        } else {
          chainInfo += ' rt=0';
        }
      } catch (_) {}
    }

    // --- Strategy C: unit data pointer probe (pUnitData at unit+0x10) ---
    // Diagnostic only — reads the pointer but does not resolve a level ID.
    if (destLevelId === 0) {
      try {
        const unitAddr = tile._address;
        if (unitAddr && unitAddr !== 0n) {
          const dataBuf = readMemoryFast(unitAddr + 0x10n, 8);
          const dataPtr = new DataView(dataBuf.buffer, dataBuf.byteOffset)
            .getBigUint64(0, true);
          chainInfo += dataPtr && dataPtr !== 0n
            ? ` dp=${dataPtr.toString(16).slice(-6)}`
            : ' dp=0';
        }
      } catch (_) {}
    }

    allTileDiag.push(`c${tile.classId}:d${destLevelId}@${px},${py}[${chainInfo}]`);

    // Record all tiles with valid positions (used for bounds filtering later)
    tileUnits.push({ posX: px, posY: py, classId: tile.classId, destLevelId });

    if (destLevelId > 0 && destLevelId !== currentLevelId) {
      tileExits.push({ posX: px, posY: py, destLevelId, classId: tile.classId });
    }
  }

  if (allTileDiag.length > 0) {
    diag += ` tRaw=[${allTileDiag.join(' ')}]`;
  }
  if (tileExits.length > 0) {
    diag += ` te=[${tileExits.map(t => `c${t.classId}->${t.destLevelId}`).join(' ')}]`;
  }

  return { tileExits, tileUnits, diag };
}
