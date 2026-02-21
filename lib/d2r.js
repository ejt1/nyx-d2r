'use strict';

const { UnitTypes, PlayerModes, MonsterModes, ItemModes } = require('d2r/types');
const { UnitModel, SeedModel, DrlgActModel } = require('d2r/models');
const { Seed } = require('d2r/seed');
const { DrlgAct } = require('d2r/drlg-act');
const { Unit } = require('d2r/unit');
const { WorldObject } = require('d2r/world-object');
const { Player, LocalPlayer } = require('d2r/player');
const { Monster } = require('d2r/monster');
const { Item } = require('d2r/item');
const { GameObject } = require('d2r/game-object');
const { Missile } = require('d2r/missile');
const { RoomTile } = require('d2r/room-tile');
const { ObjectManager } = require('d2r/object-manager');
const { DebugPanel } = require('d2r/debug-panel');

const binding = internalBinding('d2r');

module.exports = {
  UnitTypes,
  PlayerModes,
  MonsterModes,
  ItemModes,

  UnitModel,
  SeedModel,
  DrlgActModel,

  Seed,
  DrlgAct,

  Unit,
  WorldObject,
  Player,
  LocalPlayer,
  Monster,
  Item,
  GameObject,
  Missile,
  RoomTile,

  ObjectManager,

  DebugPanel,

  automapGetMode: binding.automapGetMode,
  worldToAutomap: binding.worldToAutomap,
  revealLevel: binding.revealLevel,
};
