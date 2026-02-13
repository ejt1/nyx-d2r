'use strict';

const UnitTypes = {
  Player: 0,
  Monster: 1,
  Object: 2,
  Missile: 3,
  Item: 4,
  Tile: 5,
};

const PlayerModes = {
  Death: 0,
  Neutral: 1,
  Walk: 2,
  Run: 3,
  GetHit: 4,
  TownNeutral: 5,
  TownWalk: 6,
  Attack1: 7,
  Attack2: 8,
  Block: 9,
  Cast: 10,
  Throw: 11,
  Kick: 12,
  Skill1: 13,
  Skill2: 14,
  Skill3: 15,
  Skill4: 16,
  Dead: 17,
  Sequence: 18,
  KnockBack: 19,
};

const MonsterModes = {
  Death: 0,
  Neutral: 1,
  Walk: 2,
  GetHit: 3,
  Attack1: 4,
  Attack2: 5,
  Block: 6,
  Cast: 7,
  Skill1: 8,
  Skill2: 9,
  Skill3: 10,
  Skill4: 11,
  Dead: 12,
  Knockback: 13,
  Sequence: 14,
  Run: 15,
};

const ItemModes = {
  Stored: 0,
  Equipped: 1,
  InBelt: 2,
  OnGround: 3,
  OnCursor: 4,
  Dropping: 5,
  Socketed: 6,
};

module.exports = { UnitTypes, PlayerModes, MonsterModes, ItemModes };
