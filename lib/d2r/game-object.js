'use strict';

const { Unit } = require('d2r/unit');

class GameObject extends Unit {
  constructor() {
    super();
    this.on('update', (cursor) => {
      this.gameObjectData = cursor.gameObjectData?.$toObject(this.gameObjectData) ?? null;
    });
  }
}

module.exports = { GameObject };
