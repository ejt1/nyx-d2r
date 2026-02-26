#pragma once

#include <cstdint>
#include <Windows.h>

namespace d2r {

// ---------------------------------------------------------------------------
// RuntimeMode — controls whether invasive game-state mutations are permitted.
// Moved here from d2r_methods.h so safety infrastructure is self-contained.
// ---------------------------------------------------------------------------
enum class RuntimeMode : uint32_t {
  ReadOnlySafe   = 0,
  ActiveMutation = 1,
};

// ---------------------------------------------------------------------------
// State structs — instances live in d2r_safety.cc and d2r_player_id.cc
// ---------------------------------------------------------------------------
struct CircuitBreakerState {
  const char* name;
  bool        tripped          = false;
  ULONGLONG   window_start_ms  = 0;
  uint32_t    strikes          = 0;
};

struct PlayerIdCandidateState {
  uint32_t  xor_const   = 0;
  uint32_t  add_const   = 0;
  uint32_t  hits        = 0;
  ULONGLONG last_hit_ms = 0;
  bool      committed   = false;
};

struct LocalPlayerIdentityState {
  uint32_t  cached_id          = 0;
  ULONGLONG last_scan_ms       = 0;
  bool      logged_direct_path = false;
};

// ---------------------------------------------------------------------------
// Logging utility
// ---------------------------------------------------------------------------

// Returns true if enough time has elapsed since *last_ms, and updates it.
// Passing nullptr always returns true.
bool ShouldLogNow(ULONGLONG* last_ms, ULONGLONG interval_ms);

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------
void RecordCircuitStrike(CircuitBreakerState* state, const char* reason);
bool IsCircuitTripped(const CircuitBreakerState* state);

// ---------------------------------------------------------------------------
// Mode / state guards
// ---------------------------------------------------------------------------

// Returns true (and logs) if the current RuntimeMode blocks mutations.
bool IsMutationBlockedByMode(const char* caller);

// Returns true if any player unit entries exist in the client hash table.
bool HasAnyPlayerUnits();

// Returns true (and logs) when the game state is unsafe for invasive calls.
bool IsUnsafeStateForInvasiveCall(const char* caller);

// ---------------------------------------------------------------------------
// Runtime mode API
// ---------------------------------------------------------------------------
RuntimeMode GetRuntimeMode();
void        SetRuntimeMode(RuntimeMode mode);
bool        IsActiveMutationEnabled();
const char* GetRuntimeModeName(RuntimeMode mode);

}  // namespace d2r
