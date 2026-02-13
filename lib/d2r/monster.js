'use strict';

const { Unit } = require('d2r/unit');
const { MonsterModes } = require('d2r/types');

class Monster extends Unit {
  get isAlive() {
    return this.mode !== MonsterModes.Death && this.mode !== MonsterModes.Dead;
  }

  get isAttacking() {
    return this.mode === MonsterModes.Attack1 || this.mode === MonsterModes.Attack2;
  }

  get isNeutral() {
    return this.mode === MonsterModes.Neutral;
  }
}

module.exports = { Monster };
