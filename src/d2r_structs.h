#pragma once

#include <cstdint>
#include <string>
#include "retcheck_bypass.h"

namespace d2r {

inline void* D2Allocator;
inline void* BcAllocator;

constexpr size_t kConstantOffset = 0xC6;

struct RetCheckData {
  uint8_t* constants;
  struct ReturnAddresses {
    uint32_t* ptr;
    uint32_t count;
  }* addresses;
  char pad_0010[8];
  struct ImageData {
    uint64_t size;
    void* base;
  }* range;
};
inline RetCheckData* kCheckData;

struct D2ActiveRoomStrc;
struct D2DrlgLevelStrc;
struct D2DrlgStrc;
struct D2UnitStrc;

template <typename T>
class vector {
  using ref_t = std::conditional_t<std::is_pointer_v<T>, T, T*>;

 public:
  ref_t operator[](size_t idx) {
    if (idx >= m_size) return nullptr;

    if constexpr (std::is_pointer_v<T>) {
      return m_elements[idx];
    } else {
      return &m_elements[idx];
    }
  }

  size_t size() { return m_size; }

  size_t capacity() { return m_capacity; }

  T* begin() { return m_elements; }

  T* end() { return &m_elements[m_size]; }

  T* m_elements;                      // 0x0000
  size_t m_size;                      // 0x0008
  size_t m_capacity : 63;             // 0x0010
  size_t m_capacity_is_embedded : 1;  // 0x0010
};  // Size = 0x0018
static_assert(sizeof(vector<void>) == 0x0018);

template <typename T>
struct Vector2 {
  Vector2() {
    x = static_cast<T>(0);
    y = static_cast<T>(0);
  }

  Vector2(T _x, T _y) {
    x = _x;
    y = _y;
  }

  Vector2(const Vector2<T>& other) { *this = other; }

  // Negative
  Vector2<T> operator-() const { return Vec2(-x, -y); }

  // Assign
  Vector2<T>& operator=(const Vector2<T>& other) {
    x = other.x;
    y = other.y;
    return *this;
  }

  // Addition
  Vector2<T> operator+(const Vector2<T>& v) const { return Vector2<T>(x + v.x, y + v.y); }

  Vector2<T>& operator+=(const Vector2<T>& v) {
    x += v.x;
    y += v.y;
    return *this;
  }

  Vector2<T> operator+(const T val) const { return Vector2<T>(x + val, y + val); }

  Vector2<T>& operator+=(const T val) {
    x += val;
    y += val;
    return *this;
  }

  // Subtraction
  Vector2<T> operator-(const Vector2<T>& v) const { return Vector2<T>(x - v.x, y - v.y); }

  Vector2<T>& operator-=(const Vector2<T>& v) {
    x -= v.x;
    y -= v.y;
    return *this;
  }

  Vector2<T> operator-(const T val) const { return Vector2<T>(x - val, y - val); }

  Vector2<T>& operator-=(const T val) {
    x -= val;
    y -= val;
    return *this;
  }

  // Multiplication
  Vector2<T> operator*(const Vector2<T>& v) const { return Vector2<T>(x * v.x, y * v.y); }

  Vector2<T>& operator*=(const Vector2<T>& v) {
    x *= v.x;
    y *= v.y;
    return *this;
  }

  Vector2<T> operator*(const T val) const { return Vector2<T>(x * val, y * val); }

  Vector2<T>& operator*=(const T val) {
    x *= val;
    y *= val;
    return *this;
  }

  // Division
  Vector2<T> operator/(const Vector2<T>& v) const { return Vector2<T>(x / v.x, y / v.y); }

  Vector2<T>& operator/=(const Vector2<T>& v) {
    x /= v.x;
    y /= v.y;
    return *this;
  }

  Vector2<T> operator/(const T val) const {
    T i = static_cast<T>(1.0f) / val;
    return Vector2<T>(x * i, y * i);
  }

  Vector2<T>& operator/=(const T val) {
    T i = static_cast<T>(1.0f) / val;
    x /= i;
    y *= i;
    return *this;
  }

  // Compare
  bool operator==(const Vector2<T>& v) const { return (x == v.x) && (y == v.y); }

  bool operator!=(const Vector2<T>& v) const { return (x != v.x) || (y != v.y); }

  bool operator<=(const Vector2<T>& v) const { return (x < v.x && x == v.x) || (x == v.x && (y < v.y || y == v.y)); }

  bool operator<(const Vector2<T>& v) const { return (x < v.x && x != v.x) || (x == v.x && (y < v.y || y != v.y)); }

  bool operator>=(const Vector2<T>& v) const { return (x > v.x && x == v.x) || (x == v.x && (y > v.y || y == v.y)); }

  bool operator>(const Vector2<T>& v) const { return (x > v.x && x != v.x) || (x == v.x && (y > v.y || y != v.y)); }

  T x;
  T y;
};
typedef Vector2<int32_t> Vector2i;
typedef Vector2<uint32_t> Vector2u;
typedef Vector2<float> Vector2f;
typedef Vector2<double> Vector2d;

template <typename T>
struct RectT {
  RectT<T>() : left(T(0)), top(T(0)), right(T(0)), bottom(T(0)) {}
  RectT<T>(T x, T y, T w, T h) : left(x), top(y), right(w), bottom(h) {}
  RectT<T>(Vector2<T> ptPosition, Vector2<T> ptSize) {
    left = ptPosition.x;
    top = ptPosition.y;
    right = ptSize.x;
    bottom = ptSize.y;
  }

  Vector2<T> center() { return {left + right / 2, top + bottom / 2}; }

  T left;
  T top;
  T right;
  T bottom;
};

typedef RectT<int> RectInt;
typedef RectT<float> Rect;

template <class _Elem, size_t Initial>
struct basic_string {
  _Elem* m_elements;                    // 0x0000
  uint64_t m_size;                      // 0x0008
  uint64_t m_capacity : 63;             // 0x0010
  uint64_t m_capacity_is_embedded : 1;  // 0x0014
  _Elem m_storage[Initial];             // 0x0018

  // need proper BcAllocator implementation
  // basic_string() {
  //   m_elements = m_storage;
  //   m_size = 0;
  //   m_capacity = Initial;
  //   m_capacity_is_embedded = 1;
  //   memset(m_storage, 0, sizeof(_Elem) * Initial);
  // }

  // need proper BcAllocator implementation
  // basic_string(const _Elem* ptr, const size_t count) {
  //   m_elements = m_storage;
  //   m_size = 0;
  //   m_capacity = Initial;
  //   m_capacity_is_embedded = 1;
  //   memset(m_storage, 0, sizeof(_Elem) * Initial);
  //   resize(count);
  //   if (count) {
  //     memcpy(m_elements, ptr, sizeof(_Elem) * count);
  //   }
  //   m_elements[count] = 0;
  //   m_size = count;
  // }

  // need proper BcAllocator implementation
  //~basic_string() {
  //  if (!m_capacity_is_embedded) {
  //    d2r::bcAllocatorWrap* allocator = d2r::MEMORY_BcAllocator();
  //    allocator->Free(m_elements);
  //  }
  //}

  operator _Elem*() { return m_elements; }

  _Elem* c_str() { return m_elements; }

  size_t length() { return m_size; }

  size_t capacity() { return m_capacity; }

  bool is_embedded() { return m_capacity_is_embedded; }

  // need proper BcAllocator implementation
  // void assign(const _Elem* ptr, size_t count) {
  //   resize(count);
  //   if (count) {
  //     memcpy(m_elements, ptr, sizeof(_Elem) * count);
  //   }
  //   m_elements[count] = 0;
  //   m_size = count;
  // }

  // need proper BcAllocator implementation
  // void resize(size_t new_size) {
  //   d2r::bcAllocatorWrap* allocator = d2r::MEMORY_BcAllocator();
  //   // Calculate new capacity (grow by factor of 2)
  //   if (new_size > m_capacity) {
  //     size_t new_capacity = std::max(new_size, m_capacity * 2);
  //     if (new_capacity < Initial) {
  //       new_capacity = Initial;
  //     }

  //    // Allocate new memory
  //    _Elem* new_elements = static_cast<_Elem*>(allocator->Allocate(sizeof(_Elem) * (new_capacity + 1), 0x10));

  //    // Copy existing data
  //    if (m_size != static_cast<size_t>(-1)) {
  //      memcpy(new_elements, m_elements, sizeof(_Elem) * (m_size + 1));
  //    } else {
  //      // null terminate
  //      new_elements[0] = 0;
  //    }

  //    if (!m_capacity_is_embedded) {
  //      allocator->Free(m_elements);
  //    }

  //    m_elements = new_elements;
  //    m_capacity = new_capacity;
  //    m_capacity_is_embedded = 0;
  //  }
  //}
};

using string = basic_string<char, 15>;
template <size_t Size>
using string_sized = basic_string<char, Size>;

using wstring = basic_string<wchar_t, 15>;
template <size_t Size>
using wstring_sized = basic_string<wchar_t, Size>;

struct TypeDesc {
  const char* szTypename;  // 0x0008
  TypeDesc* ptBase;        // 0x0010
  size_t N000012AC;        // 0x0018
  uint64_t N000012AD;      // 0x0020
  char pad_0028[16];       // 0x0028

  virtual void Function0() = 0;
  virtual void Function1() = 0;
  virtual void Function2() = 0;
  virtual void Function3() = 0;
  virtual void Function4() = 0;
  virtual void Function5() = 0;
  virtual void Function6() = 0;
  virtual void Function7() = 0;
  virtual void Function8() = 0;
  virtual void Function9() = 0;
};  // Size: 0x0038
static_assert(sizeof(TypeDesc) == 0x38);

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

#pragma pack(push, 4)
struct AutoMapData {
  uint64_t unk_0000;
  uint64_t unk_0008;
  uint64_t unk_0010;
  uint64_t unk_0018;
  uint64_t unk_0020;
  uint64_t unk_0028;
  float unk_0030;
  float unk_0034;
  float unk_0038;
};
static_assert(sizeof(AutoMapData) == 0x3C);
#pragma pack(pop)

// fixme: move into AutoMapPanel : Panel struct
inline RetcheckFunction<uint32_t> AutoMapPanel_GetMode;
inline void (*AutoMapPanel_CreateAutoMapData)(AutoMapData*, RectInt*, uint64_t, float);
inline RetcheckFunction<void, AutoMapData*, int64_t*, int64_t> AutoMapPanel_PrecisionToAutomap;
inline uint32_t* AutoMapPanel_spdwShift;

template <typename T>
class D2LinkedList {
 public:
  T* head;                    // 0x0000
  D2LinkedList<T>* sentinel;  // 0x0008
  D2LinkedList<T>* tail;      // 0x0010
  uint8_t unk;                // 0x0018
  char pad_0019[7];           // 0x0019
  uint64_t count;             // 0x0020
};  // Size: 0x0028
static_assert(sizeof(D2LinkedList<void>) == 0x28);

struct D2AutomapCellStrc {
  D2AutomapCellStrc* pTail;      // 0x0000
  D2AutomapCellStrc* pHead;      // 0x0008
  D2AutomapCellStrc* N00000B37;  // 0x0010
  char pad_0018[8];              // 0x0018
  int16_t fSaved;                // 0x0020
  int16_t nCellNo;               // 0x0022
  int32_t xPixel;                // 0x0024
  int32_t yPixel;                // 0x0028
  char pad_002C[4];              // 0x002C
};  // Size: 0x002C
static_assert(sizeof(D2AutomapCellStrc) == 0x30);

class D2AutomapLayerStrc {
 public:
  int32_t dwLayerID;                                // 0x0000
  int32_t unk;                                      // 0x0004
  D2LinkedList<D2AutomapCellStrc> visible_floors;   // 0x0008
  D2LinkedList<D2AutomapCellStrc> visible_walls;    // 0x0030
  D2LinkedList<D2AutomapCellStrc> visible_objects;  // 0x0058
  D2LinkedList<D2AutomapCellStrc> visible_extras;   // 0x0080
  D2AutomapLayerStrc* prev;                         // 0x00A8
};  // Size: 0x00B0
static_assert(sizeof(D2AutomapLayerStrc) == 0xB0);

class D2LevelDefBin {
 public:
  uint32_t dwQuestFlag;     // 0x0000
  uint32_t dwQuestFlagEx;   // 0x0004
  int32_t dwLayer;          // 0x0008
  uint32_t dwSizeX[3];      // 0x000C
  uint32_t dwSizeY[3];      // 0x0018
  int32_t dwOffsetX;        // 0x0024
  int32_t dwOffsetY;        // 0x0028
  uint32_t dwDepend;        // 0x002C
  uint32_t dwDrlgType;      // 0x0030
  uint32_t dwLevelType;     // 0x0034
  int32_t nSubType;         // 0x0038
  int32_t nSubTheme;        // 0x003C
  int32_t nSubWaypoint;     // 0x0040
  int32_t nSubShrine;       // 0x0044
  uint32_t dwVis[8];        // 0x0048
  int32_t nWarp[8];         // 0x0068
  uint8_t nIntensity;       // 0x0088
  uint8_t nRed;             // 0x0089
  uint8_t nGreen;           // 0x008A
  uint8_t nBlue;            // 0x008B
  uint32_t dwPortal;        // 0x008C
  uint32_t dwPosition;      // 0x0090
  uint32_t dwSaveMonsters;  // 0x0094
  uint32_t dwLOSDraw;       // 0x0098
};  // Size: 0x009C
static_assert(sizeof(D2LevelDefBin) == 0x9C);

class D2SeedStrc {
 public:
  uint32_t dwLow;   // 0x0000
  uint32_t dwHigh;  // 0x0004
};  // Size: 0x0008
static_assert(sizeof(D2SeedStrc) == 0x8);

class D2FP16 {
 public:
  uint16_t wOffsetX;  // 0x0000
  uint16_t wPosX;     // 0x0002
  uint16_t wOffsetY;  // 0x0004
  uint16_t wPosY;     // 0x0006
};  // Size: 0x0008
static_assert(sizeof(D2FP16) == 0x8);

class D2FP32 {
 public:
  uint32_t dwPrecisionX;  // 0x0000
  uint32_t dwPrecisionY;  // 0x0004
};  // Size: 0x0008
static_assert(sizeof(D2FP32) == 0x8);

class D2FP32_16 {
 public:
  union  // 0x0000
  {
    D2FP16 fp16;  // 0x0000
    D2FP32 fp32;  // 0x0000
  };
};  // Size: 0x0008
static_assert(sizeof(D2FP32_16) == 0x8);

class D2PathPointStrc {
 public:
  uint16_t wX;  // 0x0000
  uint16_t wY;  // 0x0002
};  // Size: 0x0004
static_assert(sizeof(D2PathPointStrc) == 0x4);

class D2DrlgCoordsStrc {
 public:
  int32_t nSubtileX;       // 0x0000 nBackCornerTileX
  int32_t nSubtileY;       // 0x0004 nBackCornerTileY
  int32_t nSubtileWidth;   // 0x0008 nSizeGameX
  int32_t nSubtileHeight;  // 0x000C nSizeGameY
  int32_t nTileXPos;       // 0x0010 nSizeTileX
  int32_t nTileYPos;       // 0x0014 nSizeTileY
  int32_t nTileWidth;      // 0x0018
  int32_t nTileHeight;     // 0x001C
};  // Size: 0x0020
static_assert(sizeof(D2DrlgCoordsStrc) == 0x20);

class D2CoordStrc {
 public:
  int32_t nX;  // 0x0000
  int32_t nY;  // 0x0004
};  // Size: 0x0008
static_assert(sizeof(D2CoordStrc) == 0x8);

class D2DrlgCoordStrc {
 public:
  int32_t nBackCornerTileX;  // 0x0000
  int32_t nBackCornerTileY;  // 0x0004
  int32_t nSizeTileX;        // 0x0008
  int32_t nSizeTileY;        // 0x000C
};  // Size: 0x0010
static_assert(sizeof(D2DrlgCoordStrc) == 0x10);

class D2DrlgTileInfoStrc {
 public:
  int32_t nPosX;       // 0x0000
  int32_t nPosY;       // 0x0004
  int32_t nTileIndex;  // 0x0008
};  // Size: 0x000C
static_assert(sizeof(D2DrlgTileInfoStrc) == 0xC);

class D2DrlgRoomStrc {
 public:
  char pad_0000[8];                          // 0x0000
  uint32_t dwInitSeed;                       // 0x0008
  char pad_000C[4];                          // 0x000C
  vector<D2DrlgRoomStrc*> ptRoomsNear;       // 0x0010
  char pad_0028[8];                          // 0x0028
  D2SeedStrc tSeed;                          // 0x0030
  D2DrlgRoomStrc* ptStatusNext;              // 0x0038
  size_t ptMaze;                             // 0x0040
  D2DrlgRoomStrc* ptDrlgRoomNext;            // 0x0048
  uint32_t dwFlags;                          // 0x0050
  char pad_0054[4];                          // 0x0054
  D2ActiveRoomStrc* hRoom;                   // 0x0058
  D2DrlgCoordStrc tRoomCoords;               // 0x0060
  uint8_t fRoomStatus;                       // 0x0070
  char pad_0071[3];                          // 0x0071
  int32_t nType;                             // 0x0074
  size_t ptRoomTiles;                        // 0x0078
  uint32_t dwDT1Mask;                        // 0x0080
  char pad_0084[12];                         // 0x0084
  D2DrlgLevelStrc* ptLevel;                  // 0x0090
  /*D2PresetUnitStrc*/ void* ptPresetUnits;  // 0x0098
  char pad_00A0[16];                         // 0x00A0
  char pTiles[32][8];                        // 0x00B0
  D2DrlgRoomStrc* ptStatusPrev;              // 0x01B0
  uint64_t nUniqueId;                        // 0x01B8
};  // Size: 0x01C0
static_assert(sizeof(D2DrlgRoomStrc) == 0x1C0);

class D2TileLibraryEntryStrc {
 public:
  int32_t nLightDirection;         // 0x0000
  int16_t nRoofHeight;             // 0x0004
  int16_t nFlags;                  // 0x0006
  int32_t nTotalHeight;            // 0x0008
  int32_t nWidth;                  // 0x000C
  int32_t nHeightToBottom;         // 0x0010
  int32_t nType;                   // 0x0014
  int32_t nStyle;                  // 0x0018
  int32_t nSequence;               // 0x001C
  int32_t nRarity_Frame;           // 0x0020
  int32_t nTransparentColorRGB24;  // 0x0024
  uint8_t dwTileFlags[4];          // 0x0028
  char pad_002C[84];               // 0x002C
};  // Size: 0x0080
static_assert(sizeof(D2TileLibraryEntryStrc) == 0x80);

class D2DrlgTileDataStrc {
 public:
  int32_t nWidth;                  // 0x0000
  int32_t nHeight;                 // 0x0004
  int32_t nPosX;                   // 0x0008
  int32_t nPosY;                   // 0x000C
  char pad_0010[8];                // 0x0010
  uint32_t dwFlags;                // 0x0018
  char pad_001C[4];                // 0x001C
  D2TileLibraryEntryStrc* ptTile;  // 0x0020
  int32_t nTileCount;              // 0x0028
  char pad_0028[28];               // 0x002C
};  // Size: 0x0048
static_assert(sizeof(D2DrlgTileDataStrc) == 0x48);

class D2DrlgRoomTilesStrc {
 public:
  D2DrlgTileDataStrc* ptWallTiles;   // 0x0000
  uint64_t nWalls;                   // 0x0008
  char pad_0010[16];                 // 0x0010
  D2DrlgTileDataStrc* ptFloorTiles;  // 0x0020
  uint64_t nFloors;                  // 0x0028
  char pad_0030[16];                 // 0x0030
  D2DrlgTileDataStrc* ptRoofTiles;   // 0x0040
  uint64_t nRoofs;                   // 0x0048
  char pad_0050[24];                 // 0x0050
};  // Size: 0x0068
static_assert(sizeof(D2DrlgRoomTilesStrc) == 0x68);

class D2ActiveRoomStrc {
 public:
  D2ActiveRoomStrc** ptRoomList;                      // 0x0000
  D2DrlgRoomTilesStrc* ptRoomTiles;                   // 0x0008
  char pad_0010[8];                                   // 0x0010
  D2DrlgRoomStrc* ptDrlgRoom;                         // 0x0018
  char pad_0020[24];                                  // 0x0020
  /*D2RoomCollisionGridStrc*/ void* ptCollisionGrid;  // 0x0038
  uint32_t dwNumRooms;                                // 0x0040
  uint32_t dwNumUnits;                                // 0x0044
  /*D2DrlgActStrc*/ void* ptDrlgAct;                  // 0x0048
  char pad_0050[4];                                   // 0x0050
  uint32_t dwFlags;                                   // 0x0054
  char pad_0058[40];                                  // 0x0058
  D2DrlgCoordsStrc tCoords;                           // 0x0080
  D2SeedStrc tSeed;                                   // 0x00A0
  D2UnitStrc* ptUnitFirst;                            // 0x00A8
  D2ActiveRoomStrc* ptRoomNext;                       // 0x00B0
  char pad_00B8[8];                                   // 0x00B8
};  // Size: 0x00C0
static_assert(sizeof(D2ActiveRoomStrc) == 0xC0);

class D2DrlgLevelStrc {
 public:
  uint32_t dwDrlgType;          // 0x0000
  uint32_t dwFlags;             // 0x0004
  int32_t nRooms;               // 0x0008
  char pad_000C[4];             // 0x000C
  D2DrlgRoomStrc* ptRoomFirst;  // 0x0010
  union                         // 0x0018
  {
    /*LevelMazeTableRecord*/ void* pMaze;           // 0x0000
    /*D2DrlgPresetInfoStrc*/ void* pPresetInfo;     // 0x0000
    /*D2DrlgOutdoorInfoStrc*/ void* pOutdoorsInfo;  // 0x0000
  };
  char pad_0020[8];                   // 0x0020
  D2DrlgCoordStrc tCoords;            // 0x0028
  D2DrlgTileInfoStrc ptTileInfo[32];  // 0x0038
  D2DrlgLevelStrc* ptNextLevel;       // 0x01B8
  size_t ptCurrentMap;                // 0x01C0 D2DrlgMapStrc*
  D2DrlgStrc* ptDrlg;                 // 0x01C8
  char pad_01D0[16];                  // 0x01D0
  uint32_t dwLevelType;               // 0x01E0
  D2SeedStrc tSeed;                   // 0x01E4
  char pad_01EC[12];                  // 0x01EC
  int32_t eLevelId;                   // 0x01F8
  char pad_01FC[12];                  // 0x01FC
  int32_t nRoom_Center_Warp_X[9];     // 0x0208
  int32_t nRoom_Center_Warp_Y[9];     // 0x022C
  uint32_t dwNumCenterWarps;          // 0x0250
  char pad_0254[44];                  // 0x0254
};  // Size: 0x0280
static_assert(sizeof(D2DrlgLevelStrc) == 0x280);

class D2DrlgActStrc {
 public:
  uint32_t bUpdate;          // 0x0000
  char pad_0004[4];          // 0x0004
  size_t ptEnvironment;      // 0x0008
  D2SeedStrc tInitSeed;      // 0x0010
  D2ActiveRoomStrc* ptRoom;  // 0x0018
  uint32_t dwActId;          // 0x0020
  char pad_0024[36];         // 0x0024
  size_t ptTileData;         // 0x0048
  char pad_0050[32];         // 0x0050
  D2DrlgStrc* ptDrlg;        // 0x0070
  void* pfnActCallback;      // 0x0078
  char pad_0080[16];         // 0x0080
};  // Size: 0x0090
static_assert(sizeof(D2DrlgActStrc) == 0x90);

class D2DrlgStrc {
 public:
  D2SeedStrc tSeed;                     // 0x0000
  uint32_t nAllocatedRooms;             // 0x0008
  char pad_000C[4];                     // 0x000C
  void* ptTiles[32];                    // 0x0010
  uint32_t dwFlags;                     // 0x0110
  char pad_0114[4];                     // 0x0114
  /*D2DrlgWarpStrc*/ void* pWarp;       // 0x0118
  uint32_t dwStaffLevelOffset;          // 0x0120
  char pad_0124[4];                     // 0x0124
  size_t ptGame;                        // 0x0128
  D2DrlgRoomStrc tStatusRoomsLists[4];  // 0x0130
  uint8_t nDifficulty;                  // 0x0830
  char pad_0831[7];                     // 0x0831
  void* pfnAutomap;                     // 0x0838
  uint32_t dwInitSeed;                  // 0x0840 encrypted
  uint32_t dwJungleInterlink;           // 0x0844
  D2DrlgRoomStrc* ptDrlgRoom;           // 0x0848
  char pad_0850[8];                     // 0x0850
  D2DrlgActStrc* ptAct;                 // 0x0858
  uint32_t dwStartSeed;                 // 0x0860
  char pad_0864[4];                     // 0x0864
  D2DrlgLevelStrc* ptLevel;             // 0x0868
  uint8_t nActNo;                       // 0x0870
  char pad_0871[3];                     // 0x0871
  uint32_t dwBossLevelOffset;           // 0x0874
  void* pfnTownAutomap;                 // 0x0878
};  // Size: 0x0880
static_assert(sizeof(D2DrlgStrc) == 0x880);

class D2DynamicPathStrc {
 public:
  D2FP32_16 tGameCoords;              // 0x0000
  uint32_t dwClientCoordX;            // 0x0008
  uint32_t dwClientCoordY;            // 0x000C
  D2PathPointStrc tTargetCoord;       // 0x0010
  D2PathPointStrc tPrevTargetCoord;   // 0x0014
  D2PathPointStrc tFinalTargetCoord;  // 0x0018
  char pad_001C[4];                   // 0x001C
  D2ActiveRoomStrc* ptRoom;           // 0x0020
  D2ActiveRoomStrc* ptPreviousRoom;   // 0x0028
  uint32_t dwCurrentPointIdx;         // 0x0030
  uint32_t dwPathPoints;              // 0x0034
  char pad_0038[8];                   // 0x0038
  D2UnitStrc* ptUnit;                 // 0x0040
  uint32_t dwFlags;                   // 0x0048
  char pad_004C[4];                   // 0x004C
  uint32_t dwPathType;                // 0x0050
  uint32_t dwPrevPathType;            // 0x0054
  uint32_t dwUnitSize;                // 0x0058
  uint32_t dwCollisionPattern;        // 0x005C
  uint32_t dwFootprintCollisionMask;  // 0x0060
  uint32_t dwMoveTestCollisionMask;   // 0x0064
  char pad_0068[8];                   // 0x0068
  D2UnitStrc* pTargetUnit;            // 0x0070
  uint32_t dwTargetType;              // 0x0078
  uint32_t dwTargetId;                // 0x007C
  float fDirection;                   // 0x0080
  float fNewDirection;                // 0x0084
  float fDiffDirection;               // 0x0088
  char pad_008C[2];                   // 0x008C
  D2CoordStrc tDirectionVector;       // 0x008E
  D2CoordStrc tVelocityVector;        // 0x0096
  char pad_009E[2];                   // 0x009E
  int32_t nVelocity;                  // 0x00A0
  int32_t nPreviousVelocity;          // 0x00A4
  int32_t nMaxVelocity;               // 0x00A8
  char pad_00AC[28];                  // 0x00AC
  D2PathPointStrc ptPathPoints[78];   // 0x00C8
  uint32_t dwSavedStepsCount;         // 0x0200
  D2PathPointStrc ptSavedSteps[10];   // 0x0204
};  // Size: 0x022C
static_assert(sizeof(D2DynamicPathStrc) == 0x230);

class D2UnitStrc {
 public:
  uint32_t dwUnitType;  // 0x0000
  uint32_t dwClassId;   // 0x0004
  uint32_t dwId;        // 0x0008
  uint32_t dwMode;      // 0x000C
  union                 // 0x0010
  {
    /*D2PlayerDataStrc*/ void* pPlayerData;    // 0x0000
    /*D2MonsterDataStrc*/ void* pMonsterData;  // 0x0000
    /*D2ItemDataStrc*/ void* pItemData;        // 0x0000
    /*D2ObjectDataStrc*/ void* pObjectData;    // 0x0000
  };
  uint64_t dwAct;           // 0x0018
  D2DrlgActStrc* pDrlgAct;  // 0x0020
  D2SeedStrc tSeed;         // 0x0028
  D2SeedStrc tInitSeed;     // 0x0030
  union                     // 0x0038
  {
    D2DynamicPathStrc* pDynamicPath;         // 0x0000
    /*D2StaticPathStrc*/ void* pStaticPath;  // 0x0000
  };
  char pad_0040[28];                         // 0x0040
  uint32_t dwAnimSeqFrame;                   // 0x005C
  uint32_t dwAnimSeqFrame2;                  // 0x0060
  uint32_t dwAnimSeqFrameCount;              // 0x0064
  uint32_t dwAnimSpeed;                      // 0x0068
  char pad_006C[4];                          // 0x006C
  /*D2AnimDataRecordStrc*/ void* pAnimData;  // 0x0070
  /*D2GfxDataStrc*/ void* pGfxData;          // 0x0078
  char pad_0080[8];                          // 0x0080
  /*D2StatListExStrc*/ void* pStatListEx;    // 0x0088
  /*D2InventoryStrc*/ void* pInventory;      // 0x0090
  char pad_0098[40];                         // 0x0098
  size_t pPacketList;                        // 0x00C0
  char pad_00C8[12];                         // 0x00C8
  uint16_t wPosX;                            // 0x00D4
  uint16_t wPosY;                            // 0x00D6
  uint64_t nResourceId;                      // 0x00D8
  char pad_00E0[32];                         // 0x00E0
  /*D2SkillListStrc*/ void* pSkills;         // 0x0100
  char pad_0108[28];                         // 0x0108
  uint32_t dwFlags;                          // 0x0124
  uint32_t dwFlagsEx;                        // 0x0128
  char pad_012C[36];                         // 0x012C
  D2UnitStrc* pChangeNextUnit;               // 0x0150
  D2UnitStrc* pUnitNext;                     // 0x0158
  D2UnitStrc* pRoomUnitNext;                 // 0x0160
  char pad_0168[16];                         // 0x0168
  uint32_t dwCollisionUnitType;              // 0x0178
  uint32_t dwCollisionUnitClassId;           // 0x017C
  uint32_t dwCollisionUnitSizeX;             // 0x0180
  uint32_t dwCollisionUnitSizeY;             // 0x0184
  char pad_0188[53];                         // 0x0188
  uint8_t nDataTblsIndex;                    // 0x01BD
  char pad_01BE[2];                          // 0x01BE
};  // Size: 0x01C0
static_assert(sizeof(D2UnitStrc) == 0x1C0);

constexpr size_t kUnitHashTableCount = 128;
typedef D2UnitStrc* EntityHashTable[kUnitHashTableCount];
inline EntityHashTable* sgptClientSideUnitHashTable;

// function definitions
inline D2DrlgLevelStrc* (*DRLG_AllocLevel)(uint8_t, D2DrlgStrc*, uint32_t);
inline void (*DRLG_InitLevel)(uint8_t, D2DrlgLevelStrc*);
inline void (*ROOMS_AddRoomData)(uint8_t, void*, int32_t, uint32_t, uint32_t, D2ActiveRoomStrc*);
inline D2LevelDefBin* (*GetLevelDef)(uint8_t, uint32_t);
inline D2AutomapLayerStrc** s_automapLayerLink;
inline D2AutomapLayerStrc** s_currentAutomapLayer;
inline void (*ClearLinkedList)(D2LinkedList<D2AutomapCellStrc>*);
inline void* (*AUTOMAP_NewAutomapCell)(D2LinkedList<D2AutomapCellStrc>*, void*, void*);
inline void* (*AUTOMAP_AddAutomapCell)(D2LinkedList<D2AutomapCellStrc>*, D2AutomapCellStrc*);

inline void** sgptDataTbls;  // unused
inline uint32_t (*DATATBLS_GetAutomapCellId)(int32_t, int32_t, int32_t, int32_t);

inline uint32_t* s_PlayerUnitIndex;
inline EntityHashTable* (*GetClientSideUnitHashTableByType)(uint32_t);
inline EntityHashTable* (*GetServerSideUnitHashTableByType)(uint32_t);
// fixme: can call GetPlayerUnit directly instead of decrypting the pointer using retcheck bypass
inline uint32_t (*EncTransformValue)(uint32_t*);
inline uintptr_t* EncEncryptionKeys;
inline uint32_t* PlayerIndexToIDEncryptedTable;

}  // namespace d2r
