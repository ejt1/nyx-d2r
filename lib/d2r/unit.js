'use strict';

// Ensure snapshot classes are registered before any unit is read.
require('d2r/seed');
require('d2r/drlg-act');

class Unit {
  constructor() {
    this._valid = true;
  }

  get isValid() { return this._valid; }

  _invalidate() {
    this._valid = false;
  }
}

module.exports = { Unit };
