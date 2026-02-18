#pragma once

#include "d2r_structs.h"

#include <dolos/offset_types.h>

#include <cstddef>
#include <cstdint>

namespace d2r {

using dolos::OffsetType;

#define D2R_EXPAND(x) x

#define D2R_GET_NAME_2(name, pattern) #name
#define D2R_GET_NAME_3(name, pattern, type) #name
#define D2R_GET_NAME_SELECT(_1, _2, _3, MACRO, ...) MACRO
#define D2R_GET_NAME(...) D2R_EXPAND(D2R_GET_NAME_SELECT(__VA_ARGS__, D2R_GET_NAME_3, D2R_GET_NAME_2)(__VA_ARGS__))

#define D2R_GET_VAR_2(name, pattern) name
#define D2R_GET_VAR_3(name, pattern, type) name
#define D2R_GET_VAR_SELECT(_1, _2, _3, MACRO, ...) MACRO
#define D2R_GET_VAR(...) D2R_EXPAND(D2R_GET_VAR_SELECT(__VA_ARGS__, D2R_GET_VAR_3, D2R_GET_VAR_2)(__VA_ARGS__))

#define D2R_GET_PATTERN_2(name, pattern) pattern
#define D2R_GET_PATTERN_3(name, pattern, type) pattern
#define D2R_GET_PATTERN_SELECT(_1, _2, _3, MACRO, ...) MACRO
#define D2R_GET_PATTERN(...)                                                                                           \
  D2R_EXPAND(D2R_GET_PATTERN_SELECT(__VA_ARGS__, D2R_GET_PATTERN_3, D2R_GET_PATTERN_2)(__VA_ARGS__))

#define D2R_GET_TYPE_2(name, pattern) OffsetType::Relative32Add
#define D2R_GET_TYPE_3(name, pattern, type) type
#define D2R_GET_TYPE_SELECT(_1, _2, _3, MACRO, ...) MACRO
#define D2R_GET_TYPE(...) D2R_EXPAND(D2R_GET_TYPE_SELECT(__VA_ARGS__, D2R_GET_TYPE_3, D2R_GET_TYPE_2)(__VA_ARGS__))

// Pattern format:
//   - Hex bytes: "8B 1D" (space-separated)
//   - Wildcard:  "?" (matches any single byte)
//   - Offset:    "^" (marks where to extract the offset value, counts as a wildcard)
//
// Examples:
//   "48 8B 0D ^ ? ? ?" - LEA/MOV with RIP-relative offset
//   "E8 ^ ? ? ?" - CALL with relative offset
//   "48 89 5C 24 ? 48 89 74 24 ?" - Function prologue (no ^)
#define D2R_OFFSET_LIST(V)                                                                                             \
  V(D2Allocator, "48 8B 0D ^ ? ? ? 8B F8 48 85 C9")                                                                    \
  V(BcAllocator, "E8 ^ ? ? ? 33 DB 48 89 05")                                                                          \
  V(kAutoLimit, "48 8B 05 ^ ? ? ? 48 85 C0 75 ? C6 45")                                                                \
                                                                                                                       \
  /* Maphack offsets */                                                                                                \
  V(DRLG_AllocLevel, "E8 ^ ? ? ? 48 8B D8 83 3B")                                                                      \
  V(DRLG_InitLevel, "E8 ^ ? ? ? 44 8B 8C 24 ? ? ? ? 41 83 F9")                                                         \
  V(ROOMS_AddRoomData, "E8 ^ ? ? ? 49 BB ? ? ? ? ? ? ? ? FF C6")                                                       \
  V(GetLevelDef, "E8 ^ ? ? ? 44 0F B6 90")                                                                             \
  V(s_automapLayerLink, "48 8B 05 ^ ? ? ? 49 89 86")                                                                   \
  V(s_currentAutomapLayer, "48 8B 05 ^ ? ? ? 8B 08")                                                                   \
  V(ClearLinkedList, "E8 ^ ? ? ? 48 8D 3D ? ? ? ? 48 8D 2D")                                                           \
  V(AUTOMAP_NewAutomapCell, "E8 ^ ? ? ? 48 8B 75 ? 48 85 F6 0F 84 ? ? ? ? E8 ? ? ? ? 8D 57")                           \
  V(AUTOMAP_AddAutomapCell, "E8 ^ ? ? ? 4D 89 1F")                                                                     \
  V(AutoMapPanel_GetMode, "E8 ^ ? ? ? 83 F8 ? 75 ? 33 D2 48 8B CF")                                                    \
                                                                                                                       \
  /* Data table offsets*/                                                                                              \
  V(sgptDataTbls, "48 8D 15 ^ ? ? ? 49 8B 9E")                                                                         \
  V(DATATBLS_GetAutomapCellId, "48 89 5C 24 ? 48 89 74 24 ? 57 48 83 EC ? 48 63 D9 45 8B D9")                          \
                                                                                                                       \
  /* Unit offsets */                                                                                                   \
  V(s_PlayerUnitIndex, "8B 0D ^ ? ? ? 48 8B 58 18")                                                                    \
  V(sgptClientSideUnitHashTable, "48 63 C1 48 8D 0D ^ ? ? ? 48 C1 E0")                                                 \
  V(GetClientSideUnitHashTableByType, "E8 ^ ? ? ? 8B D5 41 B9")                                                        \
  V(GetServerSideUnitHashTableByType, "E8 ^ ? ? ? 45 8B C1 41 83 E0")                                                  \
  V(EncTransformValue, "E8 ^ ? ? ? 44 39 45")                                                                          \
  V(EncEncryptionKeys, "48 8B 05 ^ ? ? ? 8B 80")                                                                       \
  V(PlayerIndexToIDEncryptedTable, "48 8D 15 ^ ? ? ? 8B DF")

constexpr std::size_t kOffsetCount = 0
#define COUNT_OFFSET(...) +1
    D2R_OFFSET_LIST(COUNT_OFFSET)
#undef COUNT_OFFSET
    ;

struct AutoLimitFixer {
  AutoLimitFixer() : ptr(*static_cast<uint64_t**>(kAutoLimit)), old_min(ptr[1]), old_delta(ptr[0]) {
    ptr[1] = 0;
    ptr[0] = 0x7FFFFFFFFFFFFFF;
  }

  ~AutoLimitFixer() {
    ptr[1] = old_min;
    ptr[0] = old_delta;
  }

  uint64_t* ptr;
  uint64_t old_min;
  uint64_t old_delta;
};

bool InitializeOffsets();
bool ValidateOffsets();

struct OffsetInfo {
  const char* name;
  const char* pattern;
  OffsetType type;
  void* value;
  bool found;
};

void GetOffsetInfo(OffsetInfo* out, std::size_t count);

}  // namespace d2r
