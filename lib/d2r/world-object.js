'use strict';

const { Unit } = require('d2r/unit');

const binding = internalBinding('d2r');

class WorldObject extends Unit {
  constructor() {
    super();
    this.automapX = -1;
    this.automapY = -1;

    this.on('update', () => {
      if (this.path) {
        const pos = binding.worldToAutomap(
          this.path.clientCoordX,
          this.path.clientCoordY,
        );
        this.automapX = pos.x;
        this.automapY = pos.y;
      }
    });
  }
}

module.exports = { WorldObject };
