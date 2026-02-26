#pragma once

#include <cstdint>

#include "d2r_templates.h"
#include "retcheck_bypass.h"

namespace d2r {

#pragma pack(push, 4)
struct AutoMapData {
  uint64_t unk_0000;
  uint64_t unk_0008;
  uint64_t unk_0010;
  uint64_t unk_0018;
  uint64_t unk_0020;
  uint64_t unk_0028;
  float unk_0030;
  float unk_0034;
  float unk_0038;
};
static_assert(sizeof(AutoMapData) == 0x3C);
#pragma pack(pop)

// fixme: move into AutoMapPanel : Panel struct
inline RetcheckFunction<uint32_t> AutoMapPanel_GetMode;
inline void (*AutoMapPanel_CreateAutoMapData)(AutoMapData*, RectInt*, uint64_t, float);
inline RetcheckFunction<void, AutoMapData*, int64_t*, int64_t> AutoMapPanel_PrecisionToAutomap;
inline uint32_t* AutoMapPanel_spdwShift;

template <typename T>
class D2LinkedList {
 public:
  T* head;                    // 0x0000
  D2LinkedList<T>* sentinel;  // 0x0008
  D2LinkedList<T>* tail;      // 0x0010
  uint8_t unk;                // 0x0018
  char pad_0019[7];           // 0x0019
  uint64_t count;             // 0x0020
};  // Size: 0x0028
static_assert(sizeof(D2LinkedList<void>) == 0x28);

struct D2AutomapCellStrc {
  D2AutomapCellStrc* pTail;      // 0x0000
  D2AutomapCellStrc* pHead;      // 0x0008
  D2AutomapCellStrc* N00000B37;  // 0x0010
  char pad_0018[8];              // 0x0018
  int16_t fSaved;                // 0x0020
  int16_t nCellNo;               // 0x0022
  int32_t xPixel;                // 0x0024
  int32_t yPixel;                // 0x0028
  char pad_002C[4];              // 0x002C
};  // Size: 0x002C
static_assert(sizeof(D2AutomapCellStrc) == 0x30);

class D2AutomapLayerStrc {
 public:
  int32_t dwLayerID;                                // 0x0000
  int32_t unk;                                      // 0x0004
  D2LinkedList<D2AutomapCellStrc> visible_floors;   // 0x0008
  D2LinkedList<D2AutomapCellStrc> visible_walls;    // 0x0030
  D2LinkedList<D2AutomapCellStrc> visible_objects;  // 0x0058
  D2LinkedList<D2AutomapCellStrc> visible_extras;   // 0x0080
  D2AutomapLayerStrc* prev;                         // 0x00A8
};  // Size: 0x00B0
static_assert(sizeof(D2AutomapLayerStrc) == 0xB0);

inline D2AutomapLayerStrc** s_automapLayerLink;
inline D2AutomapLayerStrc** s_currentAutomapLayer;
inline void (*ClearLinkedList)(D2LinkedList<D2AutomapCellStrc>*);
inline void* (*AUTOMAP_NewAutomapCell)(D2LinkedList<D2AutomapCellStrc>*, void*, void*);
inline void* (*AUTOMAP_AddAutomapCell)(D2LinkedList<D2AutomapCellStrc>*, D2AutomapCellStrc*);
inline uint32_t (*DATATBLS_GetAutomapCellId)(int32_t, int32_t, int32_t, int32_t);

}  // namespace d2r
