#include "d2r_safety.h"

#include <dolos/pipe_log.h>
#include "d2r_structs.h"
#include "offsets.h"

namespace d2r {

namespace {

constexpr ULONGLONG kRevealCircuitWindowMs   = 10000;
constexpr uint32_t  kRevealCircuitMaxStrikes = 6;

RuntimeMode s_runtime_mode = RuntimeMode::ReadOnlySafe;

const char* RuntimeModeToString(RuntimeMode mode) {
  switch (mode) {
    case RuntimeMode::ReadOnlySafe:   return "read_only_safe";
    case RuntimeMode::ActiveMutation: return "active_mutation";
    default:                          return "unknown";
  }
}

}  // namespace

// ---------------------------------------------------------------------------
// ShouldLogNow
// ---------------------------------------------------------------------------
bool ShouldLogNow(ULONGLONG* last_ms, ULONGLONG interval_ms) {
  if (last_ms == nullptr) {
    return true;
  }
  ULONGLONG now = GetTickCount64();
  if (now - *last_ms >= interval_ms) {
    *last_ms = now;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------
void RecordCircuitStrike(CircuitBreakerState* state, const char* reason) {
  if (state == nullptr || state->tripped) {
    return;
  }
  ULONGLONG now = GetTickCount64();
  if (state->window_start_ms == 0 || now - state->window_start_ms > kRevealCircuitWindowMs) {
    state->window_start_ms = now;
    state->strikes = 0;
  }
  ++state->strikes;
  if (state->strikes >= kRevealCircuitMaxStrikes) {
    state->tripped = true;
    PIPE_LOG_ERROR("[{}] Circuit breaker tripped (reason: {})", state->name, reason ? reason : "unknown");
  } else {
    static ULONGLONG s_last_circuit_log_ms = 0;
    if (ShouldLogNow(&s_last_circuit_log_ms, 3000)) {
      PIPE_LOG_WARN("[{}] Circuit strike {}/{} ({})",
                    state->name,
                    state->strikes,
                    kRevealCircuitMaxStrikes,
                    reason ? reason : "unknown");
    }
  }
}

bool IsCircuitTripped(const CircuitBreakerState* state) {
  if (state == nullptr) {
    return false;
  }
  if (state->tripped) {
    static ULONGLONG s_last_log_ms = 0;
    if (ShouldLogNow(&s_last_log_ms, 5000)) {
      PIPE_LOG_WARN("[{}] Circuit breaker active, skipping call", state->name);
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Mode / state guards
// ---------------------------------------------------------------------------
bool IsMutationBlockedByMode(const char* caller) {
  if (s_runtime_mode == RuntimeMode::ActiveMutation) {
    return false;
  }
  static ULONGLONG s_last_log_ms = 0;
  if (ShouldLogNow(&s_last_log_ms, 5000)) {
    PIPE_LOG_WARN("[{}] Blocked by runtime mode: {}",
                  caller ? caller : "Mutation",
                  RuntimeModeToString(s_runtime_mode));
  }
  return true;
}

bool HasAnyPlayerUnits() {
  if (sgptClientSideUnitHashTable == nullptr) {
    return false;
  }
#if defined(_MSC_VER)
  __try {
#endif
    EntityHashTable* client_units = sgptClientSideUnitHashTable;
    for (size_t i = 0; i < kUnitHashTableCount; ++i) {
      if (client_units[0][i] != nullptr) {
        return true;
      }
    }
    return false;
#if defined(_MSC_VER)
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return false;
  }
#endif
}

bool IsUnsafeStateForInvasiveCall(const char* caller) {
  bool unsafe = false;
  if (sgptClientSideUnitHashTable == nullptr) {
    unsafe = true;
  } else if (s_PlayerUnitIndex == nullptr || *s_PlayerUnitIndex >= 8) {
    unsafe = true;
  } else if (!HasAnyPlayerUnits()) {
    unsafe = true;
  }

  if (unsafe) {
    static ULONGLONG s_last_log_ms = 0;
    if (ShouldLogNow(&s_last_log_ms, 5000)) {
      PIPE_LOG_WARN("[{}] Skipping invasive call in unsafe runtime state",
                    caller ? caller : "InvasiveCall");
    }
  }
  return unsafe;
}

// ---------------------------------------------------------------------------
// Runtime mode API
// ---------------------------------------------------------------------------
RuntimeMode GetRuntimeMode() {
  return s_runtime_mode;
}

void SetRuntimeMode(RuntimeMode mode) {
  if (mode == s_runtime_mode) {
    return;
  }
  s_runtime_mode = mode;
  PIPE_LOG_INFO("[RuntimeMode] Switched to {}", RuntimeModeToString(s_runtime_mode));
}

bool IsActiveMutationEnabled() {
  return s_runtime_mode == RuntimeMode::ActiveMutation;
}

const char* GetRuntimeModeName(RuntimeMode mode) {
  return RuntimeModeToString(mode);
}

}  // namespace d2r
