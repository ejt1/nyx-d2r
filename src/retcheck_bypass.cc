#include "retcheck_bypass.h"

#include "offsets.h"

#include <dolos/pipe_log.h>
#include <nyx/util.h>
#include <algorithm>
#include <bit>

namespace d2r {

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
  PIPE_LOG_TRACE("  Image Base: 0x{:016X}", image_data->base);
  PIPE_LOG_TRACE("  Image Size: 0x{}", image_data->size);
  PIPE_LOG_TRACE("  Constant at +0x{:04X}: 0x{:08X}", kConstantOffset, constant);
  PIPE_LOG_TRACE("  Obfuscated Value: 0x{:08X}", obfuscated);

  patched_array_.clear();
  patched_array_.push_back(obfuscated);

  PIPE_LOG_TRACE("  Allocated new table at: 0x{:016X}", reinterpret_cast<uintptr_t>(patched_array_.data()));

  RetCheckData::ReturnAddresses* replacement_address_table = new RetCheckData::ReturnAddresses;
  replacement_address_table->ptr = patched_array_.data();
  replacement_address_table->count = patched_array_.size();
  data_ptr->addresses = replacement_address_table;

  PIPE_LOG_TRACE("Table pointer updated successfully ({} entries)", patched_array_.size());
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
  delete data_ptr->addresses;
  data_ptr->addresses = reinterpret_cast<RetCheckData::ReturnAddresses*>(original_address_table_ptr_);
  data_ptr->range->base = reinterpret_cast<void*>(original_image_base_);
  data_ptr->range->size = original_image_size_;

  if (!patched_array_.empty()) {
    PIPE_LOG_TRACE("Freeing patched table at: 0x{:016X}", reinterpret_cast<uintptr_t>(patched_array_.data()));
    patched_array_.clear();
  }

  original_image_size_ = 0;
  original_image_base_ = 0;
  original_address_table_ptr_ = 0;

  PIPE_LOG_TRACE("Table pointer restored successfully");
  return true;
}

void RetcheckBypass::IsReturnAddressValid(uintptr_t retaddr) {
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
    PIPE_LOG_ERROR("ERROR: Invalid table configuration!");
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
    PIPE_LOG("  FOUND at index {}", linear_index);
  } else {
    PIPE_LOG_ERROR("  NOT FOUND");
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
      PIPE_LOG("  FOUND at index {}", binary_index);
    } else {
      PIPE_LOG_ERROR("  NOT FOUND");
      PIPE_LOG_ERROR("  indices: v11={} (0x{:08X}), v10={} (0x{:08X})", v11, array_ptr[v11], v10, array_ptr[v10]);
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

  PIPE_LOG("Results");
  if (found_linear && found_binary) {
    PIPE_LOG_ERROR("SUCCESS: Algorithm is CORRECT!");
    PIPE_LOG_ERROR("The obfuscated value was found using both methods.");
  } else if (found_linear && !found_binary) {
    PIPE_LOG_ERROR("WARNING: Found via linear scan but NOT binary search.");
    PIPE_LOG_ERROR("This suggests the array may not be properly sorted.");
  } else {
    PIPE_LOG_ERROR("FAILURE: Value not found in table.");
    PIPE_LOG_ERROR("Possible causes:");
    PIPE_LOG_ERROR("  1. Obfuscation algorithm is incorrect");
    PIPE_LOG_ERROR("  2. Wrong constant[c6] value");
    PIPE_LOG_ERROR("  3. Wrong image_base value");
    PIPE_LOG_ERROR("  4. Return address is invalid");
  }
}

bool RetcheckBypass::Backup() {
  if (is_backed_up()) {
    PIPE_LOG_ERROR("Table already backed up!");
    return false;
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
