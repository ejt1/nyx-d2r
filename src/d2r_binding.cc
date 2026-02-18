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

void WorldToAutomap(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);
  Environment* env = Environment::GetCurrent(isolate);
  Local<Context> context = env->context();

  // default return
  ImVec2 xy(-1.0f, -1.0f);
  args.GetReturnValue().Set(xy.ToObject(context));

  D2CoordStrc ptCoords(static_cast<int32_t>(args[0]->Int32Value(context).FromMaybe(0)),
                       static_cast<int32_t>(args[1]->Int32Value(context).FromMaybe(0)));
  PIPE_LOG_TRACE("Converting {}, {} to automap coords", ptCoords.nX, ptCoords.nY);

  // 16-byte alignement otherwise SIMD operations crash
  alignas(16) RectInt ptRect = {0, 0, 0, 0};
  Vector2i ptCenter;
  float flFinalScale;

  if (s_panelManager == nullptr || *s_panelManager == nullptr) {
    PIPE_LOG_ERROR("Failed to get panel manager");
    return;  // safety why not
  }
  PanelManager* panel_mgr = *s_panelManager;

  Widget* ptAutoMap = panel_mgr->GetWidget("AutoMap");
  if (ptAutoMap == nullptr) {
    PIPE_LOG_ERROR("AutoMapPanel not found");
    return;
  }
  PIPE_LOG_TRACE("Found AutoMapPanel at {:p}", static_cast<void*>(ptAutoMap));
  if (!ptAutoMap->bEnabled || !ptAutoMap->bVisible) {
    // PIPE_LOG_WARN("AutoMapPanel is disabled or not visible");
    return;
  }

  uint32_t mode = AutoMapPanel_GetMode();
  PIPE_LOG_TRACE("mode = {}", mode);
  if (mode == 1) {
    // automap is in corner
    Vector2i ptPosition;
    Vector2i ptScaledSize;
    Widget::GetScaledPosition(ptAutoMap, &ptPosition);
    Widget::GetScaledSize(ptAutoMap, &ptScaledSize);
    PIPE_LOG_TRACE("Scaled position = {}, {}", ptPosition.x, ptPosition.y);
    PIPE_LOG_TRACE("Scaled size = {}, {}", ptScaledSize.x, ptScaledSize.y);
    ptRect = {ptPosition, ptScaledSize};
    ptCenter = ptRect.center();
    flFinalScale = ptAutoMap->GetScale() * (*(float*)((uint64_t)ptAutoMap + 0x15AC));
  } else {
    // automap is in center
    Vector2i ptPosition;
    Vector2i ptScaledSize;
    Widget::GetScaledPosition(panel_mgr, &ptPosition);
    Widget::GetScaledSize(panel_mgr, &ptScaledSize);
    PIPE_LOG_TRACE("Scaled position = {}, {}", ptPosition.x, ptPosition.y);
    PIPE_LOG_TRACE("Scaled size = {}, {}", ptScaledSize.x, ptScaledSize.y);
    ptRect = {ptPosition, ptScaledSize};
    ptCenter = ptRect.center();

    uint32_t shift = *AutoMapPanel_spdwShift;
    PIPE_LOG_TRACE("Shift = {}", shift);
    if (shift == 1) {
      // automap is shifted to the left
      ptCenter.x -= PanelManager::GetScreenSizeX() / 4;
    } else if (shift == 2) {
      // automap is shifted to the right
      ptCenter.x += PanelManager::GetScreenSizeX() / 4;
    }
    PIPE_LOG_TRACE("ptCenter = {}, {}", ptCenter.x, ptCenter.y);

    flFinalScale = ptAutoMap->GetScale() * (*(float*)((uint64_t)ptAutoMap + 0x15A8));
  }

  AutoMapData automap_data{};
  PIPE_LOG_TRACE("AutoMapData inputs");
  PIPE_LOG_TRACE("  ptRect: {}, {}, {}, {}", ptRect.left, ptRect.top, ptRect.right, ptRect.bottom);
  PIPE_LOG_TRACE("  ptCenter: {}, {}", ptCenter.x, ptCenter.y);
  PIPE_LOG_TRACE("  flFinalSize: {}", flFinalScale);
  AutoMapPanel_CreateAutoMapData(&automap_data, &ptRect, *(uint64_t*)&ptCenter.x, flFinalScale);
  PIPE_LOG_TRACE("AutoMapData output");
  PIPE_LOG_TRACE("  automap_data.unk_0000: {}", automap_data.unk_0000);
  PIPE_LOG_TRACE("  automap_data.unk_0008: {}", automap_data.unk_0008);
  PIPE_LOG_TRACE("  automap_data.unk_0010: {}", automap_data.unk_0010);
  PIPE_LOG_TRACE("  automap_data.unk_0018: {}", automap_data.unk_0018);
  PIPE_LOG_TRACE("  automap_data.unk_0020: {}", automap_data.unk_0020);
  PIPE_LOG_TRACE("  automap_data.unk_0028: {}", automap_data.unk_0028);
  PIPE_LOG_TRACE("  automap_data.unk_0030: {}", automap_data.unk_0030);
  PIPE_LOG_TRACE("  automap_data.unk_0034: {}", automap_data.unk_0034);
  PIPE_LOG_TRACE("  automap_data.unk_0038: {}", automap_data.unk_0038);

  int64_t nPrecision = *(int64_t*)&ptCoords.nX;
  PIPE_LOG_TRACE("PrecisionToAutomap inputs");
  PIPE_LOG_TRACE("  nPrecision: {} ({}, {})", nPrecision, ptCoords.nX, ptCoords.nY);
  AutoMapPanel_PrecisionToAutomap(&automap_data, &nPrecision, nPrecision);
  PIPE_LOG_TRACE("PrecisionToAutomap outputs");
  PIPE_LOG_TRACE("  nPrecision: {} ({}, {})", nPrecision, ptCoords.nX, ptCoords.nY);
  PIPE_LOG_TRACE("  automap_data.unk_0000: {}", automap_data.unk_0000);
  PIPE_LOG_TRACE("  automap_data.unk_0008: {}", automap_data.unk_0008);
  PIPE_LOG_TRACE("  automap_data.unk_0010: {}", automap_data.unk_0010);
  PIPE_LOG_TRACE("  automap_data.unk_0018: {}", automap_data.unk_0018);
  PIPE_LOG_TRACE("  automap_data.unk_0020: {}", automap_data.unk_0020);
  PIPE_LOG_TRACE("  automap_data.unk_0028: {}", automap_data.unk_0028);
  PIPE_LOG_TRACE("  automap_data.unk_0030: {}", automap_data.unk_0030);
  PIPE_LOG_TRACE("  automap_data.unk_0034: {}", automap_data.unk_0034);
  PIPE_LOG_TRACE("  automap_data.unk_0038: {}", automap_data.unk_0038);

  ptCoords.nX = (int)nPrecision;
  ptCoords.nY = (int)(nPrecision >> 32);

  PIPE_LOG_TRACE("Final result = {}, {}", ptCoords.nX, ptCoords.nY);
  xy = ImVec2(ptCoords.nX, ptCoords.nY);
  args.GetReturnValue().Set(xy.ToObject(context));
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
  nyx::SetMethod(isolate, target, "worldToAutomap", WorldToAutomap);
  nyx::SetMethod(isolate, target, "revealLevel", RevealLevel);
  nyx::SetMethod(isolate, target, "getPlayerIdByIndex", GetPlayerIdByIndex);
  nyx::SetMethod(isolate, target, "getLocalPlayerIndex", GetLocalPlayerIndex);
  nyx::SetMethod(isolate, target, "getClientSideUnitHashTableAddress", GetClientSideUnitHashTableAddress);
  nyx::SetMethod(isolate, target, "getServerSideUnitHashTableAddress", GetServerSideUnitHashTableAddress);
}

}  // namespace d2r
