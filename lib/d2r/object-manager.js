'use strict';

const { EventEmitter } = require('events');
const { readMemoryInto, tryWithGameLock, highResolutionTime, invalidateCache } = require('memory');
const { UnitModel } = require('d2r/models');
const { UnitTypes } = require('d2r/types');
const { Player, LocalPlayer } = require('d2r/player');
const { Monster } = require('d2r/monster');
const { Item } = require('d2r/item');
const { GameObject } = require('d2r/game-object');
const { Missile } = require('d2r/missile');
const { RoomTile } = require('d2r/room-tile');

const binding = internalBinding('d2r');

// TODO: move to nyx:utils
function getTimeNs() {
  return Number(highResolutionTime());
}

// TODO: move to nyx:utils
function formatTime(ns) {
  if (ns < 1000) return `${ns.toFixed(1)}ns`;
  if (ns < 1000000) return `${(ns / 1000).toFixed(2)}us`;
  if (ns < 1000000000) return `${(ns / 1000000).toFixed(2)}ms`;
  return `${(ns / 1000000000).toFixed(2)}s `;
}

const BUCKET_COUNT = 128;
const TYPE_COUNT = 6;
const POINTER_COUNT = TYPE_COUNT * BUCKET_COUNT;
const MAX_CHAIN_NODES = 8192;
const pointerBuffer = new Uint8Array(POINTER_COUNT * 8);
const pointerView = new DataView(
  pointerBuffer.buffer,
  pointerBuffer.byteOffset,
  pointerBuffer.byteLength,
);

class ObjectManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this._units = new Array(TYPE_COUNT);
    this._cursor = UnitModel.createCursor(1);
    this._localPlayerId = -1;
    this.me = null;
    this._lastTickTime = '';
    this._lastGameLockTime = '';
    this._lastTickTimeNs = 0;
    this._lastGameLockTimeNs = 0;
    this._lastChainWarnMs = 0;
    this._chainIssueWindowStartMs = 0;
    this._chainIssueCount = 0;
    this._riskCircuitTripped = false;
    this._logChainIssues = !!options.logChainIssues;
    this._logRiskCircuit = !!options.logRiskCircuit;
    this._logInfo = typeof options.logInfo === 'function' ? options.logInfo : (...args) => console.log(...args);
    this._logError = typeof options.logError === 'function' ? options.logError : (...args) => console.error(...args);
    this.reset();
  }

  reset() {
    for (let i = 0; i < TYPE_COUNT; i++) {
      this._units[i] = new Map();
    }
    this.me = null;
  }

  getUnits(type) {
    return this._units[type];
  }

  tick() {
    const tick_start = getTimeNs();

    invalidateCache();

    const seen = new Array(TYPE_COUNT);
    for (let i = 0; i < TYPE_COUNT; i++) seen[i] = new Set();

    const game_lock_elapsed = tryWithGameLock(() => {
      const game_lock_start = getTimeNs();
      this._localPlayerId = binding.getPlayerIdByIndex(binding.getLocalPlayerIndex());
      this._scanTable(binding.getClientSideUnitHashTableAddress(), seen);
      this._scanTable(binding.getServerSideUnitHashTableAddress(), seen);
      return getTimeNs() - game_lock_start;
    });
    // failed to grab game lock due to timeout (game frozen)
    if (game_lock_elapsed === undefined) {
      return false;
    }

    for (let type = 0; type < TYPE_COUNT; type++) {
      const existing = this._units[type];
      for (const [id, unit] of existing) {
        if (!seen[type].has(id)) {
          this.emit('unitRemoved', unit, type);
          unit._invalidate();
          existing.delete(id);
        }
      }
    }

    if (this.me && !this.me.isValid) {
      this.me = null;
    }
    if (this.me === null && this._units[0].has(this._localPlayerId)) {
      this.me = this._units[0].get(this._localPlayerId);
    }

    this._lastTickTimeNs = getTimeNs() - tick_start;
    this._lastGameLockTimeNs = game_lock_elapsed;
    this._lastTickTime = formatTime(this._lastTickTimeNs);
    this._lastGameLockTime = formatTime(this._lastGameLockTimeNs);
    return true;
  }

  get tickTime() {
    return this._lastTickTime;
  }

  get tickTimeNs() {
    return this._lastTickTimeNs;
  }

  get gameLockTime() {
    return this._lastGameLockTime;
  }

  get gameLockTimeNs() {
    return this._lastGameLockTimeNs;
  }

  isRiskCircuitTripped() {
    return this._riskCircuitTripped;
  }

  _scanTable(tableAddress, seen) {
    readMemoryInto(tableAddress, pointerBuffer);

    for (let i = 0; i < POINTER_COUNT; i++) {
      const ptr = pointerView.getBigUint64(i * 8, true);
      if (ptr === 0n) continue;

      const type = (i / BUCKET_COUNT) | 0;
      let currentPtr = ptr;
      let traversed = 0;
      const visitedPtrs = new Set();

      while (currentPtr !== 0n) {
        if (visitedPtrs.has(currentPtr)) {
          this._warnChainIssue(type, i, currentPtr, 'cycle detected');
          break;
        }
        visitedPtrs.add(currentPtr);

        if (++traversed > MAX_CHAIN_NODES) {
          this._warnChainIssue(type, i, currentPtr, `traversal cap ${MAX_CHAIN_NODES} reached`);
          break;
        }

        let changed;
        try {
          changed = this._cursor.$load(currentPtr, 1);
        } catch (e) {
          this._warnChainIssue(type, i, currentPtr, `cursor load failed: ${e?.message ?? e}`);
          break;
        }

        const id = this._cursor.id;

        let unit = this._units[type].get(id);
        let isNew = false;
        if (!unit) {
          unit = this._createUnit(type);
          if (unit) {
            this._units[type].set(id, unit);
            isNew = true;
          }
        }

        if (unit) {
          if (changed || isNew) this._cursor.$toObject(unit);
          unit._valid = true;
          if (isNew) this.emit('unitAdded', unit, type);
          unit.emit('update', this._cursor);
        }

        seen[type].add(id);
        const nextPtr = this._cursor.unitNext;
        if (nextPtr === currentPtr) {
          this._warnChainIssue(type, i, currentPtr, 'self-referential unitNext');
          break;
        }
        currentPtr = nextPtr;
      }
    }
  }

  _warnChainIssue(type, bucket, ptr, reason) {
    const now = Date.now();
    if (this._chainIssueWindowStartMs === 0 || now - this._chainIssueWindowStartMs > 10000) {
      this._chainIssueWindowStartMs = now;
      this._chainIssueCount = 0;
    }
    this._chainIssueCount++;
    if (!this._riskCircuitTripped && this._chainIssueCount >= 8) {
      this._riskCircuitTripped = true;
      if (this._logRiskCircuit) {
        this._logError('[ObjectManager] risk circuit tripped, disabling risky features for this session');
      }
    }

    if (!this._logChainIssues) return;
    if (now - this._lastChainWarnMs < 5000) return;
    this._lastChainWarnMs = now;
    this._logInfo(
      `[ObjectManager] guarded unit-chain break: type=${type} bucket=${bucket} ptr=0x${ptr.toString(16)} reason=${reason}`,
    );
  }

  _createUnit(type) {
    let unit;
    switch (type) {
      case UnitTypes.Player:
        unit = new Player(); break;
      case UnitTypes.Monster:
        unit = new Monster(); break;
      case UnitTypes.Object:
        unit = new GameObject(); break;
      case UnitTypes.Missile:
        unit = new Missile(); break;
      case UnitTypes.Item:
        unit = new Item(); break;
      case UnitTypes.Tile:
        unit = new RoomTile(); break;
      default:
        return null;
    }
    UnitModel.initSnapshot(unit);
    return unit;
  }
}

module.exports = { ObjectManager };
