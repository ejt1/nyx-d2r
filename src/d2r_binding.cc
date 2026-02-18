#include "d2r_binding.h"

#include "d2r_methods.h"
#include "offsets.h"

#include <nyx/env.h>
#include <nyx/extension.h>
#include <nyx/isolate_data.h>
#include <nyx/util.h>

#include <dolos/pipe_log.h>

namespace d2r {

using nyx::Environment;
using v8::BigInt;
using v8::Context;
using v8::FunctionCallbackInfo;
using v8::HandleScope;
using v8::Isolate;
using v8::Local;
using v8::ObjectTemplate;
using v8::Value;

void AutomapGetMode(const FunctionCallbackInfo<Value>& args) {
  args.GetReturnValue().Set(AutoMapPanel_GetMode());
}
}

void RevealLevel(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Environment* env = Environment::GetCurrent(isolate);
  Local<Context> context = env->context();
  if (!args[0]->IsUint32()) {
    return;
  }
  uint32_t level_id = args[0]->Uint32Value(context).FromJust();
  args.GetReturnValue().Set(RevealLevelById(level_id));
}

// will break on patch, look at the end of GetPlayerUnit for decryption method
static void GetPlayerIdByIndex(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Environment* env = Environment::GetCurrent(isolate);
  Local<Context> context = env->context();
  if (!args[0]->IsUint32()) {
    return args.GetReturnValue().Set(-1);
  }
  uint32_t idx = args[0]->Uint32Value(context).FromJust();
  if (idx < 0 || idx >= 8) {
    return args.GetReturnValue().Set(-1);
  };

  uint32_t id = GetPlayerId(idx);
  args.GetReturnValue().Set(id);
}

static void GetLocalPlayerIndex(const FunctionCallbackInfo<Value>& args) {
  args.GetReturnValue().Set(*s_PlayerUnitIndex);
}

void GetClientSideUnitHashTableAddress(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  uint64_t addr = reinterpret_cast<uint64_t>(GetClientSideUnitHashTableByType(0));
  args.GetReturnValue().Set(BigInt::NewFromUnsigned(isolate, addr));
}

void GetServerSideUnitHashTableAddress(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  uint64_t addr = reinterpret_cast<uint64_t>(GetServerSideUnitHashTableByType(0));
  args.GetReturnValue().Set(BigInt::NewFromUnsigned(isolate, addr));
}

void InitD2RBinding(nyx::IsolateData* isolate_data, Local<ObjectTemplate> target) {
  Isolate* isolate = isolate_data->isolate();

  nyx::SetMethod(isolate, target, "log", [](const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    HandleScope handle_scope(isolate);
    nyx::Utf8Value utf8(isolate, args[0]);
    PIPE_LOG(*utf8);
  });

  nyx::SetMethod(isolate, target, "automapGetMode", AutomapGetMode);
  nyx::SetMethod(isolate, target, "revealLevel", RevealLevel);
  nyx::SetMethod(isolate, target, "getPlayerIdByIndex", GetPlayerIdByIndex);
  nyx::SetMethod(isolate, target, "getLocalPlayerIndex", GetLocalPlayerIndex);
  nyx::SetMethod(isolate, target, "getClientSideUnitHashTableAddress", GetClientSideUnitHashTableAddress);
  nyx::SetMethod(isolate, target, "getServerSideUnitHashTableAddress", GetServerSideUnitHashTableAddress);
}

}  // namespace d2r
