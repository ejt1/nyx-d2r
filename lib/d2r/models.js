'use strict';

const { MemoryModel, DataTypes } = require('memory');

const SeedModel = MemoryModel.define('SeedModel', [
  { name: 'low', type: DataTypes.Uint32 },
  { name: 'high', type: DataTypes.Uint32 },
]);

const DrlgCoordModel = MemoryModel.define('DrlgCoordsModel', [
  { name: 'backCornerTileX', type: DataTypes.Uint32 },
  { name: 'backCornerTileY', type: DataTypes.Uint32 },
  { name: 'sizeTileX', type: DataTypes.Uint32 },
  { name: 'sizeTileY', type: DataTypes.Uint32 },
]);

const DrlgCoordsModel = MemoryModel.define('DrlgCoordsModel', [
  { name: 'subtileX', type: DataTypes.Uint32 }, // backCornerTileX
  { name: 'subtileY', type: DataTypes.Uint32 }, // backCornerTileY
  { name: 'subtileWidth', type: DataTypes.Uint32 }, // sizeGameX
  { name: 'subtileHeight', type: DataTypes.Uint32 }, // sizeGameY
  { name: 'tileX', type: DataTypes.Uint32 }, // sizeTileX
  { name: 'tileY', type: DataTypes.Uint32 }, // sizeTileY
  { name: 'tileWidth', type: DataTypes.Uint32 },
  { name: 'tileHeight', type: DataTypes.Uint32 },
]);

const DrlgModel = MemoryModel.define('DrlgModel', [
  { name: 'seed', model: SeedModel },
  { name: 'allocatedRooms', type: DataTypes.Uint32 },
  { type: DataTypes.Padding, length: 4 },
  { type: DataTypes.Padding, length: 8 * 32 }, // tile pointers
  { name: 'flags', type: DataTypes.Uint32 },
  { type: DataTypes.Padding, length: 4 },
  { name: 'warp', type: DataTypes.Pointer },
  { name: 'staffLevelOffset', type: DataTypes.Uint32 },
  { type: DataTypes.Padding, length: 4 },
  { name: 'game', type: DataTypes.Pointer },
  { type: DataTypes.Padding, length: 1792 }, // DrlgRoomModel statusRoomsList[4]
  { name: 'difficulty', type: DataTypes.Uint8 },
  { type: DataTypes.Padding, length: 7 },
  { name: 'pfnAutomap', type: DataTypes.Pointer },
  { name: 'initSeed', type: DataTypes.Uint32 },
  { name: 'jungleInterlink', type: DataTypes.Uint32 },
  { name: 'drlgRoom', type: DataTypes.Pointer }, // DrlgRoomModel*
  { type: DataTypes.Padding, length: 8 },
  { name: 'act', type: DataTypes.Pointer }, // DrlgActModel*
  { name: 'startSeed', type: DataTypes.Uint32 },
  { type: DataTypes.Padding, length: 4 },
  { name: 'level', type: DataTypes.Pointer }, // DrlgLevelModel*
  { name: 'actNo', type: DataTypes.Uint8 },
  { type: DataTypes.Padding, length: 3 },
  { name: 'bossLevelOffset', type: DataTypes.Uint32 },
  { name: 'pfnTownAutomap', type: DataTypes.Pointer },
]);

const DrlgLevelModel = MemoryModel.define('DrlgLevelModel', [
  { type: DataTypes.Padding, length: 504 }, // todo: add whatever is here
  { name: 'id', type: DataTypes.Uint32 },
]);

const DrlgRoomModel = MemoryModel.define('DrlgRoomModel', [
  { type: DataTypes.Padding, length: 8 },
  { name: 'initSeed', type: DataTypes.Uint32 },
  { type: DataTypes.Padding, length: 4 },
  { type: DataTypes.Padding, length: 28 }, // contains vector<DrlgRoom>
  { name: 'seed', model: SeedModel },
  { name: 'statusNext', type: DataTypes.Pointer },
  { name: 'maze', type: DataTypes.Pointer },
  { name: 'drlgRoomNext', type: DataTypes.Pointer },
  { name: 'flags', type: DataTypes.Uint32 },
  { type: DataTypes.Padding, length: 4 },
  { name: 'handleRoom', type: DataTypes.Pointer },
  { name: 'roomCoords', model: DrlgCoordModel },
  { name: 'roomStatus', type: DataTypes.Uint8 },
  { type: DataTypes.Padding, length: 3 },
  { name: 'type', type: DataTypes.Uint32 },
  { name: 'roomTiles', type: DataTypes.Pointer },
  { name: 'dt1Mask', type: DataTypes.Uint32 },
  { type: DataTypes.Padding, length: 4 },
  { type: DataTypes.Padding, length: 8 }, // a pointer
  { name: 'level', type: DataTypes.Pointer, model: DrlgLevelModel },
  { name: 'presetUnits', type: DataTypes.Pointer },
  { type: DataTypes.Padding, length: 16 },
  { type: DataTypes.Padding, length: 8 * 32 }, // tile pointers
  { name: 'statusPrev', type: DataTypes.Pointer },
  { name: 'uniqueID', type: DataTypes.Uint64 },
]);

const ActiveRoomModel = MemoryModel.define('ActiveRoomModel', [
  { name: 'roomList', type: DataTypes.Pointer }, // ActiveRoomModel*[8]
  { name: 'roomTiles', type: DataTypes.Pointer },
  { type: DataTypes.Padding, length: 8 },
  { name: 'drlgRoom', type: DataTypes.Pointer, model: DrlgRoomModel },
  { type: DataTypes.Padding, length: 24 },
  { name: 'collisionGrid', type: DataTypes.Pointer },
  { name: 'roomCount', type: DataTypes.Uint32 },
  { name: 'unitCount', type: DataTypes.Uint32 },
  { name: 'drlgAct', type: DataTypes.Pointer },
  { type: DataTypes.Padding, length: 4 },
  { name: 'flags', type: DataTypes.Uint32 },
  { type: DataTypes.Padding, length: 40 },
  { name: 'coords', model: DrlgCoordsModel },
  { name: 'seed', model: SeedModel },
  { name: 'unitFirst', type: DataTypes.Pointer },
  { name: 'roomNext', type: DataTypes.Pointer },
  { type: DataTypes.Padding, length: 8 },
]);

const DrlgActModel = MemoryModel.define('DrlgActModel', [
  { name: 'update', type: DataTypes.Uint32 },
  { type: DataTypes.Padding, length: 4 },
  { name: 'environment', type: DataTypes.Pointer },
  { name: 'initSeed', model: SeedModel },
  { name: 'room', type: DataTypes.Pointer, model: ActiveRoomModel },
  { name: 'actId', type: DataTypes.Uint32 },
  { type: DataTypes.Padding, length: 36 },
  { name: 'tileData', type: DataTypes.Pointer },
  { type: DataTypes.Padding, length: 32 },
  { name: 'drlg', type: DataTypes.Pointer },
  { name: 'actCallback', type: DataTypes.Pointer },
  { type: DataTypes.Padding, length: 16 },
]);

const PathPointModel = MemoryModel.define('PathPointModel', [
  { name: 'x', type: DataTypes.Uint16 },
  { name: 'y', type: DataTypes.Uint16 },
], null, { packed: true });

const DynamicPathModel = MemoryModel.define('DynamicPathModel', [
  { type: DataTypes.Padding, length: 8 }, // tGameCoords
  { name: 'clientCoordX', type: DataTypes.Uint32 },
  { name: 'clientCoordY', type: DataTypes.Uint32 },
  { name: 'targetCoord', model: PathPointModel },
  { name: 'prevTargetCoord', model: PathPointModel },
  { name: 'finalTargetCoord', model: PathPointModel },
  { type: DataTypes.Padding, length: 4 },
  { name: 'room', type: DataTypes.Pointer, model: ActiveRoomModel },
], null, { packed: true });

const UnitModel = MemoryModel.define('UnitModel', [
  { name: 'type', type: DataTypes.Uint32 },                           // 0x0000
  { name: 'classId', type: DataTypes.Uint32 },                        // 0x0004
  { name: 'id', type: DataTypes.Uint32 },                             // 0x0008
  { name: 'mode', type: DataTypes.Uint32 },                           // 0x000C
  { name: 'data', type: DataTypes.Pointer },                          // 0x0010
  { name: 'actId', type: DataTypes.Uint64 },                          // 0x0018
  { name: 'drlgAct', type: DataTypes.Pointer, model: DrlgActModel },  // 0x0020
  { name: 'seed', model: SeedModel },                                 // 0x0028
  { name: 'initSeed', model: SeedModel },                             // 0x0030
  { name: 'path', type: DataTypes.Pointer, model: DynamicPathModel }, // 0x0038
  { type: DataTypes.Padding, length: 28 },                            // 0x0040
  { name: 'animSeqFrame', type: DataTypes.Uint32 },                   // 0x005C
  { name: 'animSeqFrame2', type: DataTypes.Uint32 },                  // 0x0060
  { name: 'animSeqFrameCount', type: DataTypes.Uint32 },              // 0x0064
  { name: 'animSpeed', type: DataTypes.Uint32 },                      // 0x0068
  { type: DataTypes.Padding, length: 4 },                             // 0x006C
  { name: 'animData', type: DataTypes.Pointer },                      // 0x0070
  { name: 'gfxData', type: DataTypes.Pointer },                       // 0x0078
  { type: DataTypes.Padding, length: 8 },                             // 0x0080
  { name: 'statListEx', type: DataTypes.Pointer },                    // 0x0088
  { name: 'inventory', type: DataTypes.Pointer },                     // 0x0090
  { type: DataTypes.Padding, length: 40 },                            // 0x0098
  { name: 'packetList', type: DataTypes.Pointer },                    // 0x00C0
  { type: DataTypes.Padding, length: 12 },                            // 0x00C8
  { name: 'posX', type: DataTypes.Int16 },                            // 0x00D4
  { name: 'posY', type: DataTypes.Int16 },                            // 0x00D6
  { type: DataTypes.Padding, length: 40 },                            // 0x00D8
  { name: 'skills', type: DataTypes.Pointer },                        // 0x0100
  { type: DataTypes.Padding, length: 28 },                            // 0x0108
  { name: 'flags', type: DataTypes.Uint32 },                          // 0x0124
  { name: 'flagsEx', type: DataTypes.Uint32 },                        // 0x0128
  { type: DataTypes.Padding, length: 36 },                            // 0x012C
  { name: 'changeNextUnit', type: DataTypes.Pointer },                // 0x0150
  { name: 'unitNext', type: DataTypes.Pointer },                      // 0x0158
  { name: 'roomUnitNext', type: DataTypes.Pointer },                  // 0x0160
  { type: DataTypes.Padding, length: 16 },                            // 0x0168
  { name: 'collisionUnitType', type: DataTypes.Uint32 },              // 0x0178
  { name: 'collisionUnitClassId', type: DataTypes.Uint32 },           // 0x017C
  { name: 'collisionUnitSizeX', type: DataTypes.Uint32 },             // 0x0180
  { name: 'collisionUnitSizeY', type: DataTypes.Uint32 },             // 0x0184
]);

module.exports = {
  SeedModel,
  DrlgCoordModel,
  DrlgCoordsModel,
  DrlgModel,
  DrlgLevelModel,
  DrlgRoomModel,
  ActiveRoomModel,
  DrlgActModel,
  PathPointModel,
  DynamicPathModel,
  UnitModel,
};
