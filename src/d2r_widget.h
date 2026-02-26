#pragma once

#include <cstdint>
#include <string.h>

#include "d2r_templates.h"

namespace d2r {

struct TypeDesc;

struct WidgetMessage {
  uint64_t comp1;
  uint64_t comp2;
};

struct Widget {
  static inline Vector2i* (*GetScaledPosition)(Widget*, Vector2i*);
  static inline Vector2i* (*GetScaledSize)(Widget*, Vector2i*);

  string szName;               // 0x0008
  Widget* ptParent;            // 0x0030
  char pad_0038[16];           // 0x0038
  float flRelativeX;           // 0x0048
  float flRelativeY;           // 0x004C
  bool bEnabled;               // 0x0050
  bool bVisible;               // 0x0051
  bool bRelative;              // 0x0052
  bool unk_0053;               // 0x0053
  float unk_0054;              // 0x0054
  vector<Widget*> ptChildren;  // 0x0058
  RectInt tAbsolute;           // 0x0070
  float flScale;               // 0x0080
  float unk_0084;              // 0x0084

  virtual Widget* Destroy(uint8_t flag) { return nullptr; }
  virtual __int64 vfunc_1() { return 0; }
  virtual void Update() {}
  virtual void Draw() {}
  virtual bool OnMessage(WidgetMessage* ptMessage) { return false; }
  virtual void vfunc_5(__int64) {}
  virtual size_t OnShow() { return 0; }
  virtual size_t OnHide() { return 0; }
  virtual bool OnResize(size_t a1, size_t a2) { return false; }
  virtual void SetEnabled(bool enabled) {}
  virtual void SetVisible(bool visible) {}
  virtual TypeDesc* RegisterType() { return nullptr; }

  bool GetVisible() const { return bVisible; }

  Widget* GetWidget(const char* name) {
    if (_stricmp(szName, name) == 0) {
      return this;
    }

    for (size_t i = 0; ptChildren[i]; ++i) {
      Widget* ptChild = ptChildren[i]->GetWidget(name);
      if (ptChild) return ptChild;
    }

    return nullptr;
  }

  Widget* GetWidget(Widget* widget) {
    if (widget == this) {
      return this;
    }

    for (size_t i = 0; ptChildren[i]; ++i) {
      Widget* ptChild = ptChildren[i]->GetWidget(widget);
      if (ptChild) {
        return ptChild;
      }
    }

    return nullptr;
  }

  float GetScale() {
    if (ptParent) {
      return ptParent->GetScale() * flScale;
    }
    return 1.0f * flScale;
  }

  RectInt* GetRect(RectInt* ptRect) {
    if (bRelative) {
      RectInt v4;
      ptParent->GetRect(&v4);
      ptRect->left = 0;
      ptRect->top = 0;
      ptRect->right = v4.right;
      ptRect->bottom = v4.bottom;
    } else {
      *ptRect = tAbsolute;
    }
    return ptRect;
  }
};  // Size: 0x0088
static_assert(sizeof(Widget) == 0x88);

struct Button : Widget {
  char pad_0088[960];     // 0x0088
  uint64_t N00003567;     // 0x0448
  char pad_0450[200];     // 0x0450
  Widget* ptPanel;        // 0x0518
  uint64_t tGuid[2];      // 0x0520
  char* szOpenPanel;      // 0x0530
  char pad_0538[8];       // 0x0538
  uint64_t nFlags;        // 0x0540
  Widget ptBackground;    // 0x0548
  char pad_05D0[8];       // 0x05D0
  uint32_t nAction;       // 0x05D8
  char pad_05DC[124];     // 0x05DC
  string* pszLargeIcon2;  // 0x0658
  char pad_0660[232];     // 0x0660
  string szText;          // 0x0748
  char pad_0770[408];     // 0x0770
  string szText2;         // 0x0908
  char pad_0930[200];     // 0x0930

  virtual void fn12(int) {}
  virtual void fn13() {}
  virtual void fn14() {}
  virtual RectInt* GetScaledRect(RectInt* ptRect) { return nullptr; }
  virtual uint32_t* fn16(uint32_t*) { return nullptr; }
  virtual bool fn17() { return false; }
  virtual uint64_t* fn18(uint64_t*) { return nullptr; }
  virtual __int64 fn19() { return 0; }
  virtual bool fn20() { return false; }
  virtual __int64 Click() { return 0; }
};  // Size: 0x09F8
static_assert(sizeof(Button) == 0x9F8);

class FocusManager {
 public:
  char pad_0000[368];     // 0x0000
  Widget* ptHoverPanel;   // 0x0170
  Widget* ptHoverWidget;  // 0x0178
  char pad_0180[776];     // 0x0180
};  // Size: 0x0488
static_assert(sizeof(FocusManager) == 0x488);

struct PanelManager : Widget {
  static inline uint32_t (*GetScreenSizeX)();

  vector<Widget> unk_0088;       // 0x0088
  vector<Widget> unk_00A0;       // 0x00A0
  bool bMouseWantCapture;        // 0x00B8
  bool bIsHD;                    // 0x00B9
  char pad_00BA[2];              // 0x00BA
  uint32_t dwScreenWidth;        // 0x00BC
  uint32_t dwScreenHeight;       // 0x00C0
  char pad_00C4[4];              // 0x00C4
  size_t ptGlobalData;           // 0x00C8
  FocusManager* ptFocusManager;  // 0x00D0
  char pad_00D8[16];             // 0x00D8
};
// Size: 0x00E8
static_assert(sizeof(PanelManager) == 0xE8);
inline PanelManager** s_panelManager;

}  // namespace d2r
