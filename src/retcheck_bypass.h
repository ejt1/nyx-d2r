#pragma once

#include <nyx/util.h>
#include <cstdint>

namespace d2r {

class RetcheckBypass {
 public:
  RetcheckBypass();
  ~RetcheckBypass();

  bool Patch(uintptr_t return_address);
  bool Restore();
  void ValidateReturnAddressValid(uintptr_t retaddr);

  bool is_backed_up() { return original_address_table_ptr_ != 0; }

 private:
  bool Backup();

  uintptr_t original_address_table_ptr_;
  uint64_t original_image_base_;
  uint64_t original_image_size_;
};

static NYX_NOINLINE void* GetCallSite() {
  return static_cast<void*>(static_cast<uint8_t*>(_ReturnAddress()) - 5);
}

static NYX_NOINLINE void* ProbeCallInstruction(void* inst) {
  for (size_t i = 0; i <= 16; ++i) {
    uint8_t* probe = static_cast<uint8_t*>(inst) - i;

    // indirect call via register: FF /2
    if (probe[0] == 0xFF && (probe[1] & 0xF8) == 0xD0) {
      return probe + 2;
    }

    // with REX prefix: 41-4F FF D0-D7
    if (i >= 2 && (probe[0] & 0xF0) == 0x40 && probe[1] == 0xFF && (probe[2] & 0xF8) == 0xF0) {
      return probe + 3;
    }
  }
  return nullptr;
}

template <typename R, typename... Args>
struct RetcheckFunction {
  using FuncPtr = R (*)(Args...);
  FuncPtr dummy = [](Args...) [[msvc::noinline]] -> R {
    if constexpr (!std::is_void_v<R>) return {};
  };
  FuncPtr real_fn = nullptr;
  void* call_site = nullptr;
  RetcheckBypass bypass;

  RetcheckFunction() : real_fn(nullptr) {}
  RetcheckFunction(R (*fn)(Args...)) : real_fn(fn) {}

  // implement operators for offset scanner to grab raw pointer to real function
  inline operator void*() { return real_fn; }
  inline void** operator&() { return reinterpret_cast<void**>(&real_fn); }

  // call operator
  NYX_NOINLINE R operator()(Args... args) {
    if constexpr (!std::is_void_v<R>) {
      R result = {};
      DoCall(&result, std::forward<Args>(args)...);
      return result;
    } else {
      void* dummy_result = nullptr;  // never used
      DoCall(dummy_result, std::forward<Args>(args)...);
    }
  }

  inline void DoCall(R* result, Args... args);
};

}  // namespace d2r

#include "retcheck_bypass-inl.h"
