#include "d2r_methods.h"

#include <dolos/pipe_log.h>
#include "d2r_structs.h"
#include "offsets.h"

#include <Windows.h>

// Dear Blizzard,
//
// Adding ret checks in every automap function wont stop us. Try harder.
//
// Sincerely, everyone.

namespace d2r {

namespace {
constexpr std::size_t kMaxUnitChainTraversal = 8192;
}  // namespace

D2UnitStrc* GetUnit(uint32_t id, uint32_t type) {
  if (sgptClientSideUnitHashTable == nullptr || type >= kUnitHashTableCount) {
    return nullptr;
  }

#if defined(_MSC_VER)
  __try {
#endif
  EntityHashTable* client_units = sgptClientSideUnitHashTable;
  for (size_t i = id & 0x7F; i < kUnitHashTableCount; ++i) {
    std::size_t traversed = 0;
    D2UnitStrc* current = client_units[type][i];
    for (; current; current = current->pUnitNext) {
      if (++traversed > kMaxUnitChainTraversal) {
        static ULONGLONG s_last_log_ms = 0;
        if (ShouldLogNow(&s_last_log_ms, 5000)) {
          PIPE_LOG_WARN("[GetUnit] Chain traversal limit hit (type={}, bucket={}, id={})", type, i, id);
        }
        break;
      }
      if (current->dwId == id) {
        return current;
      }
    }
  }
  return nullptr;
#if defined(_MSC_VER)
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return nullptr;
  }
#endif
}

}  // namespace d2r
