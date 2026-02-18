cmake_minimum_required(VERSION 3.22)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# Set runtime linking to /MT
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
message(STATUS "Link against static runtime")

project(nyx_d2r LANGUAGES C CXX ASM_MASM)

add_subdirectory(tools)
add_subdirectory(vendor)

set(NYX_D2R_SOURCES
  src/d2r_binding.cc
  src/d2r_game.cc
  src/d2r_methods.cc
  src/decryption_stub.asm
  src/main.cc
  src/offsets.cc
  src/retcheck_bypass.cc
)

add_library(nyx.d2r SHARED ${NYX_D2R_SOURCES})

target_external_js_sources(nyx.d2r lib ${CMAKE_CURRENT_BINARY_DIR}/d2r_builtins.cc d2r_builtins)

target_link_libraries(nyx.d2r PRIVATE nyx::dolos)
target_include_directories(nyx.d2r PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src ${CMAKE_CURRENT_BINARY_DIR})

add_custom_command(
  TARGET nyx.d2r POST_BUILD
  COMMAND signtool sign /fd SHA256 /f ${CMAKE_CURRENT_SOURCE_DIR}/certs/d2r.pfx /p asdf $<TARGET_FILE:nyx.d2r>
)

install(TARGETS nyx.d2r RUNTIME DESTINATION bin)

install(
  DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/typings
  DESTINATION ${CMAKE_INSTALL_PREFIX}/bin
  FILES_MATCHING PATTERN "*.d.ts")
