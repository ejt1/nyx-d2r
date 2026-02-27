#pragma once

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <type_traits>

namespace d2r {

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
  Vector2<T> operator-() const { return Vector2<T>(-x, -y); }

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

  operator _Elem*() { return m_elements; }

  _Elem* c_str() { return m_elements; }

  size_t length() { return m_size; }

  size_t capacity() { return m_capacity; }

  bool is_embedded() { return m_capacity_is_embedded; }
};

using string = basic_string<char, 15>;
template <size_t Size>
using string_sized = basic_string<char, Size>;

using wstring = basic_string<wchar_t, 15>;
template <size_t Size>
using wstring_sized = basic_string<wchar_t, Size>;

}  // namespace d2r
