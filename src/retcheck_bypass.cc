#include "retcheck_bypass.h"

#include "offsets.h"

#include <Windows.h>
#include <dolos/pipe_log.h>
#include <nyx/util.h>
#include <algorithm>
#include <bit>
#include <vector>

namespace d2r {

static std::vector<uint32_t> s_patched_array;
static RetCheckData::ReturnAddresses s_replacement_table;

static const uint8_t sbox_30[16] = {
    0x05, 0x01, 0x0D, 0x09, 0x04, 0x02, 0x0B, 0x03, 0x0A, 0x07, 0x0C, 0x0E, 0x00, 0x06, 0x08, 0x0F};

static const uint8_t sbox_10[16] = {
    0x0C, 0x01, 0x05, 0x07, 0x04, 0x00, 0x0D, 0x09, 0x0E, 0x03, 0x08, 0x06, 0x0A, 0x02, 0x0B, 0x0F};

static uint32_t apply_sbox(uint32_t val, const uint8_t* sbox) {
  uint32_t result = 0;
  for (int i = 0; i < 4; i++) {
    uint8_t byte_val = (val >> (i * 8)) & 0xFF;
    uint8_t low_nibble = byte_val & 0xF;
    uint8_t high_nibble = (byte_val >> 4) & 0xF;
    uint8_t new_low = sbox[low_nibble];
    uint8_t new_high = sbox[high_nibble];
    uint8_t new_byte = new_low | (new_high << 4);
    result |= (new_byte << (i * 8));
  }
  return result;
}

static uint32_t obfuscate_return_address(uintptr_t retaddr, uintptr_t image_base, uint32_t constant) {
  uint32_t offset = static_cast<uint32_t>(retaddr - image_base);
  uint32_t v21 = offset ^ 0x95BE951C;
  uint32_t transformed = apply_sbox(v21, sbox_30);
  v21 = (0x23CC70 + transformed) ^ 0x7F8AA577;
  v21 = std::rotl(v21, 7);
  uint32_t v20 = std::rotr(v21, 7);
  uint32_t v8 = (v20 ^ constant) - 0x23CC70;
  v20 = apply_sbox(v8, sbox_10);
  uint32_t v9 = v20 ^ 0x95BE951C;
  return v9;
}

static uint32_t deobfuscate_return_address(uint32_t obfuscated, uint32_t constant) {
  uint32_t v20 = obfuscated ^ 0x95BE951C;
  uint32_t v8 = apply_sbox(v20, sbox_30);  // inv(sbox_10) = sbox_30
  uint32_t v21 = (v8 + 0x23CC70) ^ constant;
  uint32_t transformed = (v21 ^ 0x7F8AA577) - 0x23CC70;
  uint32_t original_v21 = apply_sbox(transformed, sbox_10);  // inv(sbox_30) = sbox_10
  return original_v21 ^ 0x95BE951C;
}

static uint32_t get_constant_at_index(uint8_t* constants, size_t index) {
  return *reinterpret_cast<uint32_t*>(&constants[index]);
}

RetcheckBypass::RetcheckBypass() : original_address_table_ptr_(0), original_image_base_(0), original_image_size_(0) {}

RetcheckBypass::~RetcheckBypass() {}

bool RetcheckBypass::Patch(uintptr_t return_address) {
  if (!Backup()) {
    return false;
  }

  RetCheckData* data_ptr = kCheckData;
  RetCheckData::ReturnAddresses* address_table = data_ptr->addresses;
  RetCheckData::ImageData* image_data = data_ptr->range;
  uint8_t* constants = data_ptr->constants;

  image_data->base = 0;
  image_data->size = std::numeric_limits<int64_t>::max();
  uintptr_t stored_image_base = reinterpret_cast<uintptr_t>(image_data->base);
  uint32_t constant = get_constant_at_index(constants, kConstantOffset);

  uint32_t obfuscated = obfuscate_return_address(return_address, stored_image_base, constant);

  PIPE_LOG_TRACE("Patching integrity table:");
  PIPE_LOG_TRACE("  Return Address: 0x{:016X}", return_address);
  PIPE_LOG_TRACE("  Image Base: 0x{:p}", image_data->base);
  PIPE_LOG_TRACE("  Image Size: 0x{}", image_data->size);
  PIPE_LOG_TRACE("  Constant at +0x{:04X}: 0x{:08X}", kConstantOffset, constant);
  PIPE_LOG_TRACE("  Obfuscated Value: 0x{:08X}", obfuscated);
  PIPE_LOG_TRACE("  Address table pointer: {:p}", (void*)data_ptr->addresses->ptr);
  PIPE_LOG_TRACE("  Address table count: {}", data_ptr->addresses->count);

  // fixme: should only copy then only insert since game table never changes
  // right now it reconstructs the replacement table every time a retcheck bypass function is called.
  if (data_ptr->addresses != &s_replacement_table) {
    uintptr_t real_image_base = reinterpret_cast<uintptr_t>(GetModuleHandle(nullptr));
    s_patched_array.clear();
    s_patched_array.reserve(address_table->count);
    for (uint32_t i = 0; i < address_table->count; ++i) {
      uint32_t offset = deobfuscate_return_address(address_table->ptr[i], constant);
      uintptr_t retaddr = real_image_base + offset;
      s_patched_array.push_back(obfuscate_return_address(retaddr, stored_image_base, constant));
    }
    std::sort(s_patched_array.begin(), s_patched_array.end());
  }

  auto it = std::lower_bound(s_patched_array.begin(), s_patched_array.end(), obfuscated);
  if (it == s_patched_array.end() || *it != obfuscated) {
    PIPE_LOG_TRACE("Inserting {:04X} into valid return address table", obfuscated);
    s_patched_array.insert(it, obfuscated);
  }

  PIPE_LOG_TRACE("  Reusing global table at: 0x{:016X}", reinterpret_cast<uintptr_t>(s_patched_array.data()));

  s_replacement_table.ptr = s_patched_array.data();
  s_replacement_table.count = static_cast<uint32_t>(s_patched_array.size());
  data_ptr->addresses = &s_replacement_table;

  PIPE_LOG_TRACE("Table pointer updated successfully ({} entries)", s_patched_array.size());
  return true;
}

bool RetcheckBypass::Restore() {
  if (!is_backed_up()) {
    PIPE_LOG("No backup to restore!");
    return false;
  }

  PIPE_LOG_TRACE("Restoring original integrity table pointer:");
  PIPE_LOG_TRACE("  Original Table Pointer: 0x{:016X}", original_address_table_ptr_);
  PIPE_LOG_TRACE("  Original Image base: 0x{:08X}", original_image_base_);
  PIPE_LOG_TRACE("  Original Image size: 0x{}", original_image_size_);

  RetCheckData* data_ptr = kCheckData;
  data_ptr->addresses = reinterpret_cast<RetCheckData::ReturnAddresses*>(original_address_table_ptr_);
  data_ptr->range->base = reinterpret_cast<void*>(original_image_base_);
  data_ptr->range->size = original_image_size_;

  PIPE_LOG_TRACE("Clearing global patched table ({} entries)", s_patched_array.size());
  s_patched_array.clear();

  original_image_size_ = 0;
  original_image_base_ = 0;
  original_address_table_ptr_ = 0;

  PIPE_LOG_TRACE("Table pointer restored successfully");
  return true;
}

void RetcheckBypass::ValidateReturnAddressValid(uintptr_t retaddr) {
  RetCheckData* data = kCheckData;
  const uintptr_t image_base = reinterpret_cast<uintptr_t>(data->range->base);
  const uint32_t constant = get_constant_at_index(data->constants, kConstantOffset);
  uint32_t calculated = obfuscate_return_address(retaddr, image_base, constant);

  PIPE_LOG_TRACE("Data");
  PIPE_LOG_TRACE("  Return Address: {:p}", (void*)retaddr);
  PIPE_LOG_TRACE("  Image Base: {:p}", (void*)image_base);
  PIPE_LOG_TRACE("  Constant: {}", constant);
  PIPE_LOG_TRACE("  Offset: 0x{:08X}", static_cast<uint32_t>(retaddr - image_base));
  PIPE_LOG_TRACE("  Obfuscated Value: 0x{:08X}", calculated);
  PIPE_LOG_TRACE("");

  uint32_t* array_ptr = data->addresses->ptr;
  uint32_t array_size = data->addresses->count;

  PIPE_LOG_TRACE("Integrity Check Table:");
  PIPE_LOG_TRACE("  Array Pointer: 0x{:p}", (void*)array_ptr);
  PIPE_LOG_TRACE("  Array Size: {} entries", array_size);
  PIPE_LOG_TRACE("");

  if (array_ptr == 0 || array_size == 0) {
    PIPE_LOG_TRACE("ERROR: Invalid table configuration!");
    return;
  }

  PIPE_LOG_TRACE("Performing Linear Scan");
  bool found_linear = false;
  int linear_index = -1;

  for (uint32_t i = 0; i < array_size; i++) {
    if (array_ptr[i] == calculated) {
      found_linear = true;
      linear_index = i;
      break;
    }
  }

  if (found_linear) {
    PIPE_LOG_TRACE("  FOUND at index {}", linear_index);
  } else {
    PIPE_LOG_TRACE("  NOT FOUND");
  }

  PIPE_LOG_TRACE("Performing Binary Search");
  bool found_binary = false;
  int binary_index = -1;

  if (array_size > 0) {
    int v10 = array_size - 1;
    int v11 = 0;

    if (array_size - 1 > 1) {
      while (v10 - v11 > 1) {
        int v12 = (v10 + v11) / 2;

        if (array_ptr[v12] >= calculated) {
          v10 = v12;
        }

        int v14 = v12 + 1;
        if (array_ptr[v12] >= calculated) {
          v14 = v11;
        }
        v11 = v14;
      }
    }

    if (array_ptr[v11] == calculated) {
      found_binary = true;
      binary_index = v11;
    } else if (array_ptr[v10] == calculated) {
      found_binary = true;
      binary_index = v10;
    }

    if (found_binary) {
      PIPE_LOG_TRACE("  FOUND at index {}", binary_index);
    } else {
      PIPE_LOG_TRACE("  NOT FOUND");
      PIPE_LOG_TRACE("  indices: v11={} (0x{:08X}), v10={} (0x{:08X})", v11, array_ptr[v11], v10, array_ptr[v10]);
    }
  }
  PIPE_LOG_TRACE("");

  PIPE_LOG_TRACE("\nSample:");
  for (uint32_t i = 0; i < array_size && i < 10; i++) {
    PIPE_LOG_TRACE("  [{}] 0x{:08X}{}", i, array_ptr[i], (array_ptr[i] == calculated) ? " <-- TARGET" : "");
  }

  if (array_size > 10) {
    PIPE_LOG_TRACE("  ... ({} more entries)", array_size - 10);
  }

  PIPE_LOG_TRACE("Results");
  if (found_linear && found_binary) {
    PIPE_LOG_TRACE("SUCCESS: Algorithm is CORRECT!");
    PIPE_LOG_TRACE("The obfuscated value was found using both methods.");
  } else if (found_linear && !found_binary) {
    PIPE_LOG_TRACE("WARNING: Found via linear scan but NOT binary search.");
    PIPE_LOG_TRACE("This suggests the array may not be properly sorted.");
  } else {
    PIPE_LOG_TRACE("FAILURE: Value not found in table.");
    PIPE_LOG_TRACE("Possible causes:");
    PIPE_LOG_TRACE("  1. Obfuscation algorithm is incorrect");
    PIPE_LOG_TRACE("  2. Wrong constant[c6] value");
    PIPE_LOG_TRACE("  3. Wrong image_base value");
    PIPE_LOG_TRACE("  4. Return address is invalid");
  }
}

bool RetcheckBypass::Backup() {
  if (is_backed_up()) {
    return true;
  }

  RetCheckData* data_ptr = kCheckData;
  if (data_ptr->addresses == nullptr) {
    PIPE_LOG_ERROR("Original address table pointer is NULL!");
    return false;
  }
  if (data_ptr->range == nullptr) {
    PIPE_LOG_ERROR("Original image range pointer is NULL!");
    return false;
  }
  original_address_table_ptr_ = reinterpret_cast<uintptr_t>(data_ptr->addresses);
  original_image_base_ = reinterpret_cast<uintptr_t>(data_ptr->range->base);
  original_image_size_ = data_ptr->range->size;

  if (original_address_table_ptr_ == 0) {
    PIPE_LOG_ERROR("Backuped variables are invalid!");
    return false;
  }

  PIPE_LOG_TRACE("Backing up return address table pointer:");
  PIPE_LOG_TRACE("  Original Table Pointer: 0x{:016X}", original_address_table_ptr_);
  PIPE_LOG_TRACE("  Original Image base: 0x{:08X}", original_image_base_);
  PIPE_LOG_TRACE("  Original Image size: 0x{}", original_image_size_);

  return true;
}

}  // namespace d2r
