'use strict';

const { Unit } = require('d2r/unit');
const { ItemModes } = require('d2r/types');

class Item extends Unit {
  get isOnGround() {
    return this.mode === ItemModes.OnGround;
  }

  get isEquipped() {
    return this.mode === ItemModes.Equipped;
  }

  get isInBelt() {
    return this.mode === ItemModes.InBelt;
  }
}

module.exports = { Item };
