'use strict';

const { Unit } = require('d2r/unit');
const { PlayerModes } = require('d2r/types');

class Player extends Unit {
  get isLocalPlayer() { return false; }

  get isAlive() {
    return this.mode !== PlayerModes.Death && this.mode !== PlayerModes.Dead;
  }

  get isInTown() {
    return this.mode === PlayerModes.TownNeutral || this.mode === PlayerModes.TownWalk;
  }

  get isRunning() {
    return this.mode === PlayerModes.Run;
  }
}

class LocalPlayer extends Player {
  get isLocalPlayer() { return true; }
}

module.exports = { Player, LocalPlayer };
