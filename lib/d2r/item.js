'use strict';

const { Unit } = require('d2r/unit');
const { ItemModes } = require('d2r/types');

class Item extends Unit {
  constructor() {
    super();
    this.on('update', (cursor) => {
      this.itemData = cursor.itemData?.$toObject(this.itemData) ?? null;
    });
  }

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
