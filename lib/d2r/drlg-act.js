'use strict';

const { snapshotRegistry } = require('memory');
const { DrlgActModel } = require('d2r/models');

class DrlgAct {
  constructor() {
    DrlgActModel.initSnapshot(this);
  }
}

snapshotRegistry.add(DrlgAct, 'DrlgActModel');

module.exports = { DrlgAct };
