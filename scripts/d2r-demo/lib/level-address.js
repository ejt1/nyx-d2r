'use strict';

/**
 * level-address.js — resolves the player unit's DrlgLevel pointer.
 *
 * Chain: unit+0x38 → pPath → +0x20 → pRoom → +0x18 → pDrlgRoom → +0x90 → pLevel
 *
 * This 4-hop walk was duplicated twice in the monolithic _rebuild():
 *   - once to read center warps (original lines 820-838)
 *   - once to walk Room2 for subtile bounds (original lines 989-1006)
 * Both sites now call getPlayerLevelAddress() instead.
 */

import { readPtr } from './memory-helpers.js';

/**
 * Resolve the DrlgLevel address from a player unit address.
 * Returns the level pointer (BigInt), or 0n if any link in the chain is null.
 *
 * @param {BigInt} meAddr  player unit address (unit._address)
 * @returns {BigInt}
 */
export function getPlayerLevelAddress(meAddr) {
  if (!meAddr || meAddr === 0n) return 0n;
  const pathPtr = readPtr(meAddr + 0x38n);   // D2UnitStrc → pPath
  if (!pathPtr) return 0n;
  const roomPtr = readPtr(pathPtr + 0x20n);  // D2DynamicPathStrc → pRoom (ActiveRoom)
  if (!roomPtr) return 0n;
  const drlgPtr = readPtr(roomPtr + 0x18n);  // ActiveRoom → pDrlgRoom (Room2)
  if (!drlgPtr) return 0n;
  return readPtr(drlgPtr + 0x90n);           // Room2 → pLevel (DrlgLevel)
}
