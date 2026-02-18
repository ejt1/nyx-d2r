#include "d2r_methods.h"

#include <dolos/pipe_log.h>
#include "d2r_structs.h"
#include "offsets.h"

#include <bit>
#include <map>

// Dear Blizzard,
//
// Adding ret checks in every automap function wont stop us. Try harder.
//
// Sincerely, everyone.

namespace d2r {

D2UnitStrc* GetUnit(uint32_t id, uint32_t type) {
  EntityHashTable* client_units = sgptClientSideUnitHashTable;
  for (size_t i = id & 0x7F; i < kUnitHashTableCount; ++i) {
    D2UnitStrc* current = client_units[type][i];
    for (; current; current = current->pUnitNext) {
      if (current->dwId == id) {
        return current;
      }
    }
  }
  return nullptr;
}

uint32_t GetPlayerId(uint32_t index) {
  if (index < 0 || index >= 8) {
    return 0;
  };

  uint32_t key = *(uint32_t*)(*EncEncryptionKeys + 0x146);
  uint32_t encrypted = PlayerIndexToIDEncryptedTable[index];
  // TODO: find xor values using patterns
  uint32_t temp = (encrypted ^ key ^ 0x8633C320) + 0x53D5CDD3;
  uint32_t v = std::rotl(std::rotl(temp, 9), 7);
  // transform doesn't seem to do anything, keep for now but can probably be removed.
  uint32_t id = EncTransformValue(&v);

  if (id == 0xFFFFFFFFu) {
    return 0;
  }

  return id;
}

D2UnitStrc* GetPlayerUnit(uint32_t index) {
  uint32_t id = GetPlayerId(index);
  if (id == 0) {
    return nullptr;
  }
  return GetUnit(id, 0);
}

static void* D2Alloc(size_t size, size_t align = 0x10) {
  auto allocator = *reinterpret_cast<void**>(D2Allocator);
  if (allocator == nullptr) {
    PIPE_LOG("allocator is null");
    // d2 creates the allocator here, because that should never happen for us we just skip it and fail
    return nullptr;
  }
  auto alloc_fn = reinterpret_cast<void* (*)(void*, size_t, size_t)>((*reinterpret_cast<void***>(allocator))[1]);
  return alloc_fn(allocator, sizeof(size), 0x10);
}

static D2AutomapLayerStrc* InitAutomapLayer(int32_t layer_id) {
  D2AutomapLayerStrc* link = *s_automapLayerLink;
  D2AutomapLayerStrc* current = *s_currentAutomapLayer;
  if (link != nullptr) {
    while (link->dwLayerID != layer_id) {
      link = link->prev;
      if (!link) {
        break;
      }
    }
  }
  // allocating a new link bugs out, cba to figure out why, fix me
  if (link == nullptr) {
    return nullptr;
  }
  if (link == nullptr) {
    link = static_cast<D2AutomapLayerStrc*>(D2Alloc(sizeof(D2AutomapLayerStrc)));
    if (link != nullptr) {
      link->dwLayerID = 0;
      link->unk = 0;
      link->visible_floors.head = 0;
      link->visible_floors.sentinel = &link->visible_floors;
      link->visible_floors.tail = &link->visible_floors;
      link->visible_floors.unk = 0;
      link->visible_floors.count = 0;
      link->visible_walls.head = 0;
      link->visible_walls.sentinel = &link->visible_walls;
      link->visible_walls.tail = &link->visible_walls;
      link->visible_walls.unk = 0;
      link->visible_walls.count = 0;
      link->visible_objects.head = 0;
      link->visible_objects.sentinel = &link->visible_objects;
      link->visible_objects.tail = &link->visible_objects;
      link->visible_objects.unk = 0;
      link->visible_objects.count = 0;
      link->visible_extras.head = 0;
      link->visible_extras.sentinel = &link->visible_extras;
      link->visible_extras.tail = &link->visible_extras;
      link->visible_extras.unk = 0;
      link->visible_extras.count = 0;
    }
    // this will crash if link was not allocated, but this is how Blizztard does it...
    // I could do better but... why?
    link->prev = *s_automapLayerLink;
    link->dwLayerID = layer_id;
    *s_automapLayerLink = link;
  }
  if (link != current) {
    return nullptr;  // bugs out, fix me
    PIPE_LOG("Replace automap layer with {:p} old {:p}", static_cast<void*>(link), static_cast<void*>(current));
    if (current) {
      ClearLinkedList(&current->visible_floors);
      ClearLinkedList(&current->visible_walls);
      ClearLinkedList(&current->visible_objects);
      ClearLinkedList(&current->visible_extras);
    }
    *s_currentAutomapLayer = link;
  }
  return link;
}

static void RevealAutomapCells(uint8_t datatbls_index,
                               D2DrlgTileDataStrc* tile_data,
                               D2DrlgRoomStrc* drlg_room,
                               D2LinkedList<D2AutomapCellStrc>* cells) {
  D2LevelDefBin* level_def;

  if ((tile_data->dwFlags & 0x40000) != 0) {
    return;  // already revealed
  }
  tile_data->dwFlags |= 0x40000;  // set revealed flag
  level_def = GetLevelDef(datatbls_index, drlg_room->ptLevel->eLevelId);
  uint32_t cell_id = DATATBLS_GetAutomapCellId(
      level_def->dwLevelType, tile_data->ptTile->nType, tile_data->ptTile->nStyle, tile_data->ptTile->nSequence);

  if (cell_id == -1u) {
    return;  // cell not found
  }

  int32_t x = tile_data->nPosX + drlg_room->tRoomCoords.nBackCornerTileX;
  int32_t y = tile_data->nPosY + drlg_room->tRoomCoords.nBackCornerTileY;
  int32_t absx = 80 * (x - y);
  int32_t absy = (80 * (y + x)) >> 1;
  if (tile_data->nTileCount >= 16) {
    absx += 24;
    absy += 24;
  }

  auto pack_coords = [](int32_t low, int32_t high) -> uint64_t {
    return (static_cast<uint64_t>(high / 10) << 32) | static_cast<uint32_t>(low / 10);
  };
  auto get_low_value = [](uint64_t value) -> int32_t { return (value << 32) >> 32; };
  auto get_high_value = [](uint64_t value) -> int32_t { return value >> 32; };

  int64_t packed = pack_coords(absx, absy);
  if (get_low_value(packed) + 0x8000 > 0xFFFF) {
    PIPE_LOG("low value out of bounds");
    return;
  }
  if (get_high_value(packed) + 0x8000 > 0xFFFF) {
    PIPE_LOG("high value out of bounds");
    return;
  }
  if (cell_id + 0x8000 > 0xFFFF) {
    PIPE_LOG("cell_id out of bounds");
    return;
  }

#pragma pack(push, 1)
  struct D2AutomapInitData {
    uint16_t fSaved;
    uint16_t nCellNo;
    uint64_t nPacked;
  } init_data;
#pragma pack(pop)
  init_data.fSaved = 0;
  init_data.nCellNo = static_cast<uint16_t>(cell_id);
  init_data.nPacked = packed;

  struct Link {
    D2AutomapCellStrc* tail;
    D2AutomapCellStrc** head;
  };
  Link link;
  // PIPE_LOG("new automap cell");
  Link* ret = static_cast<Link*>(AUTOMAP_NewAutomapCell(cells, &link, &init_data));
  if (ret == nullptr) {
    PIPE_LOG("Failed to allocate automap cell");
    return;
  }

  auto prev_next_ptr = ret->head;
  if (ret->head == nullptr) {
    return;
  }

  auto allocator = reinterpret_cast<void* (*)()>(BcAllocator)();
  auto alloc_fn = reinterpret_cast<void* (*)(void*, size_t, size_t)>((*reinterpret_cast<void***>(allocator))[1]);
  D2AutomapCellStrc* new_cell = static_cast<D2AutomapCellStrc*>(alloc_fn(allocator, sizeof(D2AutomapCellStrc), 0x10));

  // PIPE_LOG("increase count");
  cells->count++;

  auto prev_cell = link.tail;
  new_cell->pTail = link.tail;
  new_cell->pHead = 0;
  new_cell->N00000B37 = 0;
  *(uint64_t*)new_cell->pad_0018 = 0;
  new_cell->fSaved = init_data.fSaved;
  new_cell->nCellNo = init_data.nCellNo;
  new_cell->xPixel = get_low_value(packed);
  new_cell->yPixel = get_high_value(packed);

  if (prev_cell == (D2AutomapCellStrc*)cells) {
    cells->head = new_cell;
    cells->sentinel = (D2LinkedList<D2AutomapCellStrc>*)new_cell;
  } else {
    *prev_next_ptr = new_cell;
    if (prev_cell == (D2AutomapCellStrc*)cells->sentinel && prev_next_ptr == &prev_cell->pHead) {
      cells->sentinel = (D2LinkedList<D2AutomapCellStrc>*)new_cell;
    }
    if (prev_cell != (D2AutomapCellStrc*)cells->tail || prev_next_ptr != &prev_cell->N00000B37) {
      AUTOMAP_AddAutomapCell(cells, new_cell);
      return;
    }
  }
  cells->tail = (D2LinkedList<D2AutomapCellStrc>*)new_cell;
  AUTOMAP_AddAutomapCell(cells, new_cell);
}

static void RevealRoom(uint8_t datatbls_index,
                       D2ActiveRoomStrc* hRoom,
                       int32_t reveal_entire_room,
                       D2AutomapLayerStrc* layer) {
  D2DrlgRoomTilesStrc* tiles = hRoom->ptRoomTiles;
  D2DrlgRoomStrc* drlg_room = hRoom->ptDrlgRoom;
  if (tiles && tiles->nFloors > 0) {
    for (uint32_t n = 0; n < tiles->nFloors; ++n) {
      D2DrlgTileDataStrc* tile_data = &tiles->ptFloorTiles[n];
      if ((tile_data->dwFlags & 8) == 0 && (tile_data->dwFlags & 0x20000) != 0 || reveal_entire_room) {
        RevealAutomapCells(datatbls_index, tile_data, drlg_room, &layer->visible_floors);
      }
    }
  }
  if (tiles && tiles->nWalls > 0) {
    for (uint32_t n = 0; n < tiles->nWalls; ++n) {
      D2DrlgTileDataStrc* tile_data = &tiles->ptWallTiles[n];
      if ((tile_data->dwFlags & 8) == 0 && (tile_data->dwFlags & 0x20000) != 0 || reveal_entire_room) {
        RevealAutomapCells(datatbls_index, tile_data, drlg_room, &layer->visible_walls);
      }
    }
  }
  // TODO: RevealAutomapObjects
}

bool AutomapReveal(D2ActiveRoomStrc* hRoom) {
  D2UnitStrc* player = GetPlayerUnit(*s_PlayerUnitIndex);
  uint8_t datatbls_index = 0;
  uint32_t current_layer_id = -1;
  uint32_t level_id = 0;
  D2LevelDefBin* level_def = nullptr;
  D2AutomapLayerStrc* inited;
  D2AutomapLayerStrc* current = *s_currentAutomapLayer;

  if (player) {
    datatbls_index = player->nDataTblsIndex;
  } else {
    // datatbls_index = *0x1D44ACF
  }
  if (current) {
    current_layer_id = current->dwLayerID;
  }
  if (hRoom) {
    level_id = hRoom->ptDrlgRoom->ptLevel->eLevelId;
  }

  level_def = GetLevelDef(datatbls_index, level_id);
  inited = InitAutomapLayer(level_def->dwLayer);
  if (inited == nullptr) {
    return false;
  }
  // PIPE_LOG("inited = {:p}", static_cast<void*>(inited));
  RevealRoom(datatbls_index, hRoom, 1, inited);
  if (current_layer_id != -1) {
    // PIPE_LOG("init back previous layer");
    InitAutomapLayer(current_layer_id);
  }
  return true;
}

bool RevealLevelById(uint32_t id) {
  if (id <= 0 || id >= 137) {
    return false;
  }

  D2UnitStrc* player = GetPlayerUnit(*s_PlayerUnitIndex);
  if (player == nullptr) {
    PIPE_LOG("No player");
    return false;
  }

  D2DrlgActStrc* drlg_act = player->pDrlgAct;
  if (drlg_act == nullptr) {
    PIPE_LOG("No DRLG act");
    return false;
  }

  D2DrlgStrc* drlg = drlg_act->ptDrlg;
  if (drlg == nullptr) {
    PIPE_LOG("No DRLG");
    return false;
  }

  D2DrlgLevelStrc* level;
  for (level = drlg->ptLevel; level; level = level->ptNextLevel) {
    if (level->eLevelId == id && level->tCoords.nBackCornerTileX > 0) {
      break;
    }
  }
  if (level == nullptr) {
    // alloc level
    level = DRLG_AllocLevel(player->nDataTblsIndex, drlg, id);
    if (level == nullptr) {
      PIPE_LOG("Failed to allocate level");
      return false;  // failed to alloc
    }
  }
  if (level->ptRoomFirst == nullptr) {
    // temp fix cba to find load act
    std::map<uint32_t, uint32_t> town_ids = {
        {0, 1},
        {1, 40},
        {2, 75},
        {3, 103},
        {4, 109},
        {5, 137},
    };
    if (id < town_ids[drlg_act->dwActId] || id >= town_ids[drlg_act->dwActId + 1]) {
      PIPE_LOG("Unsupported revealing level in another act ({})", id);
      return false;
    }
    reinterpret_cast<void (*)(uint8_t, D2DrlgLevelStrc*)>(DRLG_InitLevel)(player->nDataTblsIndex, level);
    if (level->ptRoomFirst == nullptr) {
      PIPE_LOG("Failed to init level");
      return false;  // failed to init level
    }
  }
  for (D2DrlgRoomStrc* drlg_room = level->ptRoomFirst; drlg_room; drlg_room = drlg_room->ptDrlgRoomNext) {
    if (drlg_room->hRoom == nullptr) {
      ROOMS_AddRoomData(player->nDataTblsIndex,
                        drlg_room->ptLevel->ptDrlg->ptAct,
                        drlg_room->ptLevel->eLevelId,
                        drlg_room->tRoomCoords.nBackCornerTileX,
                        drlg_room->tRoomCoords.nBackCornerTileY,
                        drlg_room->hRoom);
    }
    if (drlg_room->hRoom == nullptr) {
      PIPE_LOG("Failed to add room data");
      return false;
    }
    if (!AutomapReveal(drlg_room->hRoom)) {
      return false;
    }
  }
  return true;
}

}  // namespace d2r
