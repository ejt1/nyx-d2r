#include "retcheck_bypass.h"

#include <dolos/pipe_log.h>

namespace d2r {

template <typename R, typename... Args>
inline void RetcheckFunction<R, Args...>::DoCall(R* result, Args... args) {
  FuncPtr cur_fn = dummy;
  do {
    if (call_site) {
      cur_fn = real_fn;
      call_site = ProbeCallInstruction(call_site);
      if (!call_site) {
        PIPE_LOG("Call failed: Could not find call site");
        return;
      }
      if (!bypass.Patch(reinterpret_cast<uintptr_t>(call_site))) {
        PIPE_LOG("Call failed: Could not patch return check");
        return;
      }
    }
    if constexpr (!std::is_void_v<R>) {
      *result = cur_fn(args...);
    } else {
      cur_fn(args...);
    }
    call_site = GetCallSite();
  } while (cur_fn != real_fn);
  bypass.Restore();
}

}  // namespace d2r
