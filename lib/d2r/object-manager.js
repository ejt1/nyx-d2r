'use strict';

const { EventEmitter } = require('events');
const { readMemoryInto, withGameLock, highResolutionTime } = require('memory');
const { UnitModel } = require('d2r/models');
const { UnitTypes } = require('d2r/types');
const { Player, LocalPlayer } = require('d2r/player');
const { Monster } = require('d2r/monster');
const { Item } = require('d2r/item');
const { GameObject } = require('d2r/game-object');
const { Missile } = require('d2r/missile');
const { RoomTile } = require('d2r/room-tile');

const binding = internalBinding('d2r');

const BUCKET_COUNT = 128;
const TYPE_COUNT = 6;
const POINTER_COUNT = TYPE_COUNT * BUCKET_COUNT;
const pointerBuffer = new Uint8Array(POINTER_COUNT * 8);
const pointerView = new DataView(
  pointerBuffer.buffer,
  pointerBuffer.byteOffset,
  pointerBuffer.byteLength,
);

class ObjectManager extends EventEmitter {
  constructor() {
    super();
    this._units = new Array(TYPE_COUNT);
    this._cursor = UnitModel.createFastCursor(1);
    this._localPlayerId = -1;
    this.me = null;
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
    const seen = new Array(TYPE_COUNT);
    for (let i = 0; i < TYPE_COUNT; i++) seen[i] = new Set();

    const game_time_elapsed = withGameLock(() => {
      this._localPlayerId = binding.getPlayerIdByIndex(binding.getLocalPlayerIndex());
      this._scanTable(binding.getClientSideUnitHashTableAddress(), seen);
      this._scanTable(binding.getServerSideUnitHashTableAddress(), seen);
    });

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
  }

  _scanTable(tableAddress, seen) {
    readMemoryInto(tableAddress, pointerBuffer);

    for (let i = 0; i < POINTER_COUNT; i++) {
      const ptr = pointerView.getBigUint64(i * 8, true);
      if (ptr === 0n) continue;

      const type = (i / BUCKET_COUNT) | 0;
      let currentPtr = ptr;

      while (currentPtr !== 0n) {
        this._cursor.$load(currentPtr, 1);
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
          this._cursor.$toObject(unit);
          unit._valid = true;
          if (isNew) this.emit('unitAdded', unit, type);
        }

        seen[type].add(id);
        currentPtr = this._cursor.unitNext;
      }
    }
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
