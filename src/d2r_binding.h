#pragma once

#include <nyx/extension.h>

namespace d2r {

void InitD2RBinding(nyx::IsolateData* isolate_data, v8::Local<v8::ObjectTemplate> target);

}  // namespace d2r
