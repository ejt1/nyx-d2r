#pragma once

// Aggregator header — includes all d2r public API sub-headers so existing
// callers (d2r_binding.cc) continue to work with a single #include.

#include "d2r_safety.h"
#include "d2r_player_id.h"
#include "d2r_reveal.h"
#include "d2r_structs.h"

namespace d2r {

D2UnitStrc* GetUnit(uint32_t id, uint32_t type);

}  // namespace d2r
