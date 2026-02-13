'use strict';

const { snapshotRegistry } = require('memory');
const { SeedModel } = require('d2r/models');

class Seed {
  constructor() {
    SeedModel.initSnapshot(this);
  }
}

snapshotRegistry.add(Seed, 'SeedModel');

module.exports = { Seed };
