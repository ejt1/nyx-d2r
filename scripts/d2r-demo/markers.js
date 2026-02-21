'use strict';

import { background } from 'gui';
import { UnitTypes } from 'nyx:d2r';

// color format: 0xAABBGGRR
const COLOR_PLAYER   = 0xFF00FF00; // green
const COLOR_ME       = 0xFF00FFFF; // yellow  (local player)
const COLOR_MONSTER  = 0xFF0000FF; // red
const COLOR_MISSILE  = 0xFFFFFFFF; // white

const RADIUS_PLAYER  = 4;
const RADIUS_MONSTER = 3;
const RADIUS_MISSILE = 2;

const MARKER_TYPES = new Set([UnitTypes.Player, UnitTypes.Monster, UnitTypes.Missile]);

class Markers {
  constructor(objMgr) {
    this._objMgr = objMgr;
    this._keys = new Set();

    this._onUnitAdded   = (unit, type) => this._handleUnitAdded(unit, type);
    this._onUnitRemoved = (unit, type) => this._handleUnitRemoved(unit, type);

    objMgr.on('unitAdded',   this._onUnitAdded);
    objMgr.on('unitRemoved', this._onUnitRemoved);
  }

  _key(type, id) {
    return `marker-${type}-${id}`;
  }

  _handleUnitAdded(unit, type) {
    if (!MARKER_TYPES.has(type)) return;

    const key = this._key(type, unit.id);
    this._keys.add(key);

    unit.on('update', () => {
      if (unit.automapX < 0) {
        background.remove(key);
        return;
      }

      if (type === UnitTypes.Player) {
        const color = (unit === this._objMgr.me) ? COLOR_ME : COLOR_PLAYER;
        background.addCircleFilled(key, [unit.automapX, unit.automapY], RADIUS_PLAYER, color);
      } else if (type === UnitTypes.Monster) {
        if (!unit.isAlive) {
          background.remove(key);
          return;
        }
        background.addCircleFilled(key, [unit.automapX, unit.automapY], RADIUS_MONSTER, COLOR_MONSTER);
      } else {
        background.addCircleFilled(key, [unit.automapX, unit.automapY], RADIUS_MISSILE, COLOR_MISSILE);
      }
    });
  }

  _handleUnitRemoved(unit, type) {
    if (!MARKER_TYPES.has(type)) return;
    const key = this._key(type, unit.id);
    this._keys.delete(key);
    background.remove(key);
  }

  destroy() {
    this._objMgr.off('unitAdded',   this._onUnitAdded);
    this._objMgr.off('unitRemoved', this._onUnitRemoved);
    for (const key of this._keys) background.remove(key);
    this._keys.clear();
  }
}

export { Markers };
