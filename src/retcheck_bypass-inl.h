#include "retcheck_bypass.h"

#include <dolos/pipe_log.h>

namespace d2r {

template <typename R, typename... Args>
inline void RetcheckFunction<R, Args...>::DoCall(R* result, Args... args) {
  FuncPtr cur_fn = dummy;
  do {
    if (call_site != nullptr) {
      cur_fn = real_fn;

      if (real_call_site == nullptr) {
        real_call_site = ProbeCallInstruction(call_site);
        if (real_call_site == nullptr) {
          PIPE_LOG("Call failed: Could not find call site");
          return;
        }
      }
      if (!RetcheckBypass::AddAddress(reinterpret_cast<uintptr_t>(real_call_site))) {
        PIPE_LOG("Call failed: Could not add return address");
        return;
      }
      RetcheckBypass::SwapIn();
    }
    if constexpr (!std::is_void_v<R>) {
      *result = cur_fn(args...);
    } else {
      cur_fn(args...);
    }
    call_site = GetCallSite();
  } while (cur_fn != real_fn);
  RetcheckBypass::SwapOut();
}

}  // namespace d2r
