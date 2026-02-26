'use strict';

/**
 * memory-helpers.js — thin wrappers around readMemoryFast that eliminate the
 * repetitive  readMemoryFast + new DataView(buf.buffer, buf.byteOffset) pattern
 * used 20+ times throughout the detection code.
 */

const _mem = internalBinding('memory');

/** Raw binding — also exported so callers that need it directly can import it. */
export const readMemoryFast = _mem.readMemoryFast.bind(_mem);

/**
 * Read an 8-byte little-endian pointer at `addr`.
 * Returns a BigInt, or 0n if addr is falsy/zero.
 */
export function readPtr(addr) {
  if (!addr || addr === 0n) return 0n;
  const buf = readMemoryFast(addr, 8);
  return new DataView(buf.buffer, buf.byteOffset).getBigUint64(0, true);
}

/**
 * Read a 4-byte little-endian unsigned integer at `addr`.
 * Returns a Number, or 0 if addr is falsy/zero.
 */
export function readU32(addr) {
  if (!addr || addr === 0n) return 0;
  const buf = readMemoryFast(addr, 4);
  return new DataView(buf.buffer, buf.byteOffset).getUint32(0, true);
}

/**
 * Read a 4-byte little-endian signed integer at `addr`.
 * Returns a Number, or 0 if addr is falsy/zero.
 */
export function readI32(addr) {
  if (!addr || addr === 0n) return 0;
  const buf = readMemoryFast(addr, 4);
  return new DataView(buf.buffer, buf.byteOffset).getInt32(0, true);
}

/**
 * Read `size` raw bytes at `addr`.
 * Returns a Buffer, or null if addr is falsy/zero.
 */
export function readBuf(addr, size) {
  if (!addr || addr === 0n) return null;
  return readMemoryFast(addr, size);
}
