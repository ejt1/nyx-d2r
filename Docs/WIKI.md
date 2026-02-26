# nyx-d2r Project Wiki

> **Living document** — Updated as features are developed. Last updated: 2026-02-26
>
> **For AI assistants:** Read this file at the start of every session to restore full project context. Update relevant sections when new features, scripts, or APIs are added.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Build System](#3-build-system)
4. [Installation & Usage](#4-installation--usage)
5. [JavaScript Scripting API](#5-javascript-scripting-api)
6. [Script Structure & Patterns](#6-script-structure--patterns)
7. [Memory Offsets Reference (v3.0.26199.0)](#7-memory-offsets-reference-v3026199)
8. [Retcheck Bypass](#8-retcheck-bypass)
9. [Development Roadmap](#9-development-roadmap)
10. [Glossary](#10-glossary)
11. [Notes for AI Assistant](#11-notes-for-ai-assistant)

---

## 1. Project Overview

**nyx-d2r** is a C++ DLL that injects into `D2R.exe` at runtime and hosts a **V8 JavaScript engine** inside the game process. This creates a powerful scripting environment where JavaScript plugins can:

- Read live game data (player position, monsters, items, inventory, stats, map layout)
- Draw overlays on the in-game automap (markers, circles, labels)
- Reveal map levels automatically (maphack)
- Interact with UI widgets
- Send/receive game packets (advanced)

### Architecture Layers

```
D2R.exe (Game Process)
    └── nyx.d2r.dll  (injected C++ DLL)
            ├── V8 JavaScript Engine  (Google's JS runtime, embedded)
            │       └── Runs scripts from  scripts/
            ├── dolos  (framework: injection, logging, memory scanning)
            ├── Offset Scanner  (pattern-based RVA resolution at startup)
            └── Retcheck Bypass  (spoofs return addresses for anti-cheat)
```

### Fork Info

- **Upstream:** `ejt1/nyx-d2r`
- **This fork:** `ytb-frosty/nyx-d2r`, branch `new-v1`
- **Owner background:** Beginner Python developer building JS plugins and a future in-game Plugin Manager GUI

---

## 2. Repository Structure

```
nyx-d2r/
├── Docs/                       # This documentation folder
│   ├── README.md               # Index
│   └── WIKI.md                 # This file
├── src/                        # C++ DLL source
│   ├── main.cc                 # Entry point (DOLOS_MAIN macro)
│   ├── d2r_game.cc / .h        # Game lifecycle: init offsets, register binding, set script dir
│   ├── d2r_binding.cc / .h     # Exposes C++ functions to JS via internalBinding('d2r')
│   ├── d2r_methods.cc / .h     # Core game functions (GetUnit, RevealLevel, etc.)
│   ├── d2r_structs.h           # Memory layout structs (D2UnitStrc, D2ActiveRoomStrc, etc.)
│   ├── offsets.cc / .h         # Pattern scanner – resolves all game function/data pointers
│   ├── retcheck_bypass.cc / .h # Patches return-address check (anti-cheat bypass)
│   ├── retcheck_bypass-inl.h   # Inline template implementation for RetcheckFunction<>
│   └── decryption_stub.asm     # MASM stub used during encrypted value decryption
├── scripts/                    # JavaScript plugins (copied to install dir at build time)
│   └── d2r-demo/               # Demo script: ObjectManager, markers, maphack reveal
│       ├── index.js            # Main entry point
│       ├── markers.js          # Automap circle markers for players/monsters/missiles
│       ├── package.json        # Script package metadata
│       └── tsconfig.json       # TypeScript config for IDE support
├── typings/                    # TypeScript declaration files for JS scripting API
│   ├── d2r-bindings.d.ts       # internalBinding('d2r') type declarations
│   └── d2r/                    # Module declarations for 'nyx:d2r'
│       ├── index.d.ts          # Re-exports everything from the module
│       ├── types.d.ts          # UnitTypes, PlayerModes, MonsterModes, ItemModes constants
│       ├── models.d.ts         # MemoryModel exports (SeedModel, UnitModel, etc.)
│       ├── unit.d.ts           # Base Unit class
│       ├── player.d.ts         # Player and LocalPlayer classes
│       ├── monster.d.ts        # Monster class
│       ├── item.d.ts           # Item class
│       ├── game-object.d.ts    # GameObject class
│       ├── missile.d.ts        # Missile class
│       ├── room-tile.d.ts      # RoomTile class
│       ├── drlg-act.d.ts       # DrlgAct class
│       ├── seed.d.ts           # Seed class
│       ├── object-manager.d.ts # ObjectManager (EventEmitter) class
│       └── debug-panel.d.ts    # DebugPanel class
├── lib/                        # Built-in JS library sources (compiled into DLL)
├── tools/                      # CMake helper tools (JS bundler, etc.)
├── vendor/                     # Git submodules (nyx framework, dolos, v8)
│   └── nyx/
│       └── vendor/
│           └── v8/lib/         # Prebuilt V8 monolith (extracted via WinRAR/7-Zip)
├── certs/                      # Code-signing certificate (d2r.pfx)
├── CMakeLists.txt              # Top-level CMake build definition
├── CMakePresets.json           # Preset: x64-release
├── build.bat                   # One-click build script (extracts V8, runs CMake, installs)
├── update.bat                  # Submodule update helper
└── README.md                   # Quick-start build instructions
```

---

## 3. Build System

### Prerequisites

- **Windows** (DLL targets `D2R.exe`, a Windows-only game)
- **Visual Studio 2022** with "Desktop development with C++" workload (includes MSVC + CMake)
- **WinRAR** or **7-Zip** (to extract the split V8 library archive)
- **Git** with submodule support

### Quick Build

```bat
git clone --recursive https://github.com/ytb-frosty/nyx-d2r
cd nyx-d2r
update.bat    # optional: ensures submodules are up to date
build.bat     # extracts V8, configures cmake, builds, installs
```

`build.bat` performs these steps automatically:

1. Detects Visual Studio installation path via `vswhere.exe`
2. Extracts `vendor/nyx/vendor/v8/lib/v8_monolith_x64-release.part01.rar` if not already extracted
3. Calls `vcvarsall.bat x64` to set up the MSVC environment
4. Runs `cmake --preset x64-release` (reads `CMakePresets.json`)
5. Runs `cmake --build out/build/x64-release`
6. Runs `cmake --install out/build/x64-release`
7. Copies `scripts/` to `out/install/x64-release/bin/scripts/` (first build only)

### CMake Details

- **Standard:** C++23
- **Runtime:** Static (`/MT` release, `/MTd` debug)
- **Output:** `nyx.d2r.dll` (shared library)
- **Post-build:** Signs the DLL with `certs/d2r.pfx` using `signtool`
- **Install destination:** `out/install/x64-release/bin/`
- **JS builtins:** The `target_external_js_sources` CMake helper bundles JS files from `lib/` into `d2r_builtins.cc` and links them into the DLL

### Output Location

After a successful build and install:

```
out/install/x64-release/bin/
    nyx.d2r.dll      ← inject this
    scripts/         ← copy your scripts here
    typings/         ← TypeScript declarations (for IDE)
```

---

## 4. Installation & Usage

1. **Build** the DLL (see [Build System](#3-build-system))
2. **Start D2R** (Diablo II: Resurrected)
3. **Inject** `nyx.d2r.dll` into the `D2R.exe` process using `simple_injector` or any DLL injector
4. The DLL initializes on load:
   - Scans memory for all offsets
   - Installs the retcheck bypass
   - Registers the `d2r` binding
   - Sets the script directory to `<dll_dir>\scripts\`
   - Starts the V8 engine and runs every script package found in `scripts/`
5. **Add scripts** to the `scripts/` folder — each subfolder with a `package.json` is a script package

### Logging

The DLL uses `dolos::pipe_log`. Logs are visible through the `dolos` pipe interface (typically piped to a console window that the injector opens).

---

## 5. JavaScript Scripting API

Scripts are ES modules (`.js` files) running inside V8. The following built-in modules are available:

### `nyx:d2r` module

The primary game-data module. Import with:

```js
import { ObjectManager, UnitTypes, DebugPanel, revealLevel } from 'nyx:d2r';
```

#### `ObjectManager` class (extends `EventEmitter`)

Scans the game's unit hash tables and maintains a live view of all game entities.

| Member | Type | Description |
|--------|------|-------------|
| `me` | `LocalPlayer \| null` | The local player unit, or `null` if not in game |
| `tick()` | `() => boolean` | Scans unit tables; returns `false` if game lock unavailable |
| `getUnits(type)` | `(number) => Map<number, Unit>` | Returns a `Map<id, Unit>` for the given `UnitTypes` value |
| `reset()` | `() => void` | Clears all tracked units |
| `tickTime` | `string` | Formatted duration of the last `tick()` call |
| `gameLockTime` | `string` | Formatted time to acquire the game lock |
| **Events** | | |
| `'unitAdded'` | `(unit, type)` | Fired when a new unit is discovered |
| `'unitRemoved'` | `(unit, type)` | Fired when a unit disappears |

#### `UnitTypes` constants

| Name | Value |
|------|-------|
| `Player` | `0` |
| `Monster` | `1` |
| `Object` | `2` |
| `Missile` | `3` |
| `Item` | `4` |
| `Tile` | `5` |

#### `Unit` base class

All unit types extend `Unit`. Key fields:

| Field | Type | Description |
|-------|------|-------------|
| `type` | `number` | Unit type (see `UnitTypes`) |
| `classId` | `number` | Class/entry ID in game tables |
| `id` | `number` | Unique unit ID |
| `mode` | `number` | Current animation mode |
| `posX` / `posY` | `number` | World coordinates |
| `automapX` / `automapY` | `number` | Screen coordinates on the automap (`-1` if not visible) |
| `flags` / `flagsEx` | `number` | Bitfield flags |
| `_address` | `bigint` | Raw memory address of the unit struct |
| `isValid` | `boolean` | Whether the unit pointer is still valid |

#### `Player` / `LocalPlayer` class

Extends `Unit`. Additional fields:

| Field | Type | Description |
|-------|------|-------------|
| `isLocalPlayer` | `boolean` | `true` for the controlled character |
| `isAlive` | `boolean` | Whether the player is alive |
| `isInTown` | `boolean` | Whether in a town area |
| `isRunning` | `boolean` | Whether movement mode is run |

#### `Monster` class

Extends `Unit`. Additional fields:

| Field | Type | Description |
|-------|------|-------------|
| `isAlive` | `boolean` | Whether the monster is alive |
| `isAttacking` | `boolean` | Whether attacking |
| `isNeutral` | `boolean` | Whether neutral (non-hostile) |

#### `PlayerModes` / `MonsterModes` / `ItemModes` constants

Numeric constants for the `mode` field of units. Example:

```js
import { PlayerModes } from 'nyx:d2r';
if (unit.mode === PlayerModes.Run) { /* player is running */ }
```

#### `DebugPanel` class

Displays a debug overlay in-game.

```js
const debugPanel = new DebugPanel(objMgr);
debugPanel.refresh(); // call each tick
```

#### `revealLevel(levelId)` function

Reveals a map level (maphack). Returns `true` on success.

```js
import { revealLevel } from 'nyx:d2r';
revealLevel(me.path?.room?.drlgRoom?.level?.id);
```

---

### `nyx:memory` module

Provides synchronization with the game thread.

```js
import { withGameLock } from 'nyx:memory';

withGameLock(_ => {
  // code here runs while holding the game's critical section
  revealLevel(currentLevelId);
});
```

---

### `gui` module

Draws primitives on the in-game automap overlay.

```js
import { background } from 'gui';

// Color format: 0xAABBGGRR  (alpha, blue, green, red — little-endian ABGR)
const COLOR_RED   = 0xFF0000FF;
const COLOR_GREEN = 0xFF00FF00;

// Draw a filled circle at automap coordinates
background.addCircleFilled(key, [x, y], radius, color);

// Remove a previously added drawing by key
background.remove(key);
```

All drawing commands use a **string key** so they can be updated or removed efficiently each frame.

---

### `internalBinding('d2r')` (low-level)

Direct C++ binding, available without importing a module. Used for operations not yet wrapped by the higher-level JS API:

```js
const binding = internalBinding('d2r');

binding.log(message)                         // pipe log
binding.automapGetMode()                     // 0=fullscreen, 1=top-left, 2=top-right
binding.worldToAutomap(x, y)                 // {x, y} screen pos, or {-1,-1} if not visible
binding.revealLevel(levelId)                 // bool
binding.getPlayerIdByIndex(index)            // uint32
binding.getLocalPlayerIndex()                // uint32
binding.getClientSideUnitHashTableAddress()  // bigint
binding.getServerSideUnitHashTableAddress()  // bigint
```

---

## 6. Script Structure & Patterns

### Script Package

Each script is a folder under `scripts/` containing a `package.json`. The engine loads every such folder.

```
scripts/
└── my-plugin/
    ├── package.json    ← required: { "main": "index.js" }
    ├── index.js        ← entry point
    └── helpers.js      ← any supporting modules
```

### Typical Script Pattern

```js
'use strict';

import { ObjectManager, UnitTypes } from 'nyx:d2r';
import { withGameLock } from 'nyx:memory';
import { background } from 'gui';

const objMgr = new ObjectManager();

// Initial scan
objMgr.tick();

// Main loop — runs every 20ms
setInterval(() => {
  objMgr.tick();

  const me = objMgr.me;
  if (!me) return;

  // Example: reveal current level with game lock
  withGameLock(_ => {
    // safe to call game functions here
  });

  // Example: draw a marker for each monster
  for (const [id, monster] of objMgr.getUnits(UnitTypes.Monster)) {
    if (!monster.isAlive || monster.automapX < 0) continue;
    background.addCircleFilled(`monster-${id}`, [monster.automapX, monster.automapY], 3, 0xFF0000FF);
  }
}, 20);
```

### Event-Driven Pattern

```js
objMgr.on('unitAdded', (unit, type) => {
  if (type === UnitTypes.Monster) {
    unit.on('update', () => {
      // update marker position every time the unit moves
      background.addCircleFilled(`m-${unit.id}`, [unit.automapX, unit.automapY], 3, 0xFF0000FF);
    });
  }
});

objMgr.on('unitRemoved', (unit, type) => {
  background.remove(`m-${unit.id}`);
});
```

### Automap Coordinates

World coordinates (`posX`, `posY`) must be converted to automap screen coordinates before drawing. The `Unit` objects expose `automapX` / `automapY` which are already converted. When they are `-1`, the unit is outside the visible automap area and should be hidden.

---

## 7. Memory Offsets Reference (v3.0.26199.0)

Offsets are resolved at DLL startup by scanning for byte patterns in `D2R.exe`. All patterns are defined in `src/offsets.h` via the `D2R_OFFSET_LIST` macro.

### Pattern Format

- Hex bytes: `"8B 1D"` (space-separated)
- Wildcard: `"?"` (matches any single byte)
- Capture: `"^"` (marks where to extract the offset value; also acts as a wildcard)

Default resolution: **Relative32Add** (RIP-relative 32-bit signed offset, added to the instruction's next address). Use the third macro argument to override (e.g., `OffsetType::AbsolutePointer`).

### Offset Table

| Name | Pattern | Description |
|------|---------|-------------|
| `D2Allocator` | `48 8B 0D ^ ...` | Main game heap allocator pointer |
| `BcAllocator` | `E8 ^ ...` | BC allocator function |
| `kCheckData` | `48 8B 05 ^ ...` | Return-check data (anti-cheat) |
| `DRLG_AllocLevel` | `E8 ^ ...` | Allocates a DRLG level |
| `DRLG_InitLevel` | `E8 ^ ...` | Initialises a DRLG level |
| `ROOMS_AddRoomData` | `E8 ^ ...` | Adds room data to level |
| `GetLevelDef` | `E8 ^ ...` | Gets level definition entry |
| `s_automapLayerLink` | `48 8B 05 ^ ...` | Automap layer linked list pointer |
| `s_currentAutomapLayer` | `48 8B 05 ^ ...` | Current automap layer pointer |
| `ClearLinkedList` | `E8 ^ ...` | Clears a linked list |
| `AUTOMAP_NewAutomapCell` | `E8 ^ ...` | Allocates an automap cell |
| `AUTOMAP_AddAutomapCell` | `E8 ^ ...` | Adds a cell to the automap |
| `Widget::GetScaledPosition` | `E8 ^ ...` | Gets a widget's scaled screen position |
| `Widget::GetScaledSize` | `E8 ^ ...` | Gets a widget's scaled size |
| `PanelManager::GetScreenSizeX` | `E8 ^ ...` | Screen width |
| `s_panelManager` | `0F 84 ... 48 8B 05 ^ ...` | PanelManager singleton pointer |
| `AutoMapPanel_GetMode` | `E8 ^ ...` | Returns automap mode (0/1/2) |
| `AutoMapPanel_CreateAutoMapData` | (prologue pattern) | Creates automap transformation data |
| `AutoMapPanel_PrecisionToAutomap` | (prologue pattern) | Converts precision coords to automap |
| `AutoMapPanel_spdwShift` | `8B 0D ^ ...` | Automap shift direction |
| `sgptDataTbls` | `48 8D 15 ^ ...` | Data tables base pointer |
| `DATATBLS_GetAutomapCellId` | (prologue pattern) | Looks up automap cell ID |
| `s_PlayerUnitIndex` | `8B 0D ^ ...` | Local player unit index |
| `sgptClientSideUnitHashTable` | `48 63 C1 48 8D 0D ^ ...` | Client-side unit hash table |
| `GetClientSideUnitHashTableByType` | `E8 ^ ...` | Returns client unit table for given type |
| `GetServerSideUnitHashTableByType` | `E8 ^ ...` | Returns server unit table for given type |
| `EncTransformValue` | `E8 ^ ...` | Encryption transform helper |
| `EncEncryptionKeys` | `48 8B 05 ^ ...` | Encryption keys pointer |
| `PlayerIndexToIDEncryptedTable` | `48 8D 15 ^ ...` | Encrypted player index→ID table |

> **Note:** These patterns target game version **3.0.26199.0**. After a patch, run `ValidateOffsets()` and update any patterns that no longer match.

---

## 8. Retcheck Bypass

D2R uses a **return-address check** (retcheck) as an anti-cheat mechanism: before executing certain sensitive functions, the game validates that the caller's return address falls within the game's own image. Calling those functions from injected code would immediately fail this check.

### How the Bypass Works (`src/retcheck_bypass.cc`)

1. **At initialization** (`RetcheckBypass::Initialize()`):
   - Reads `kCheckData` — a struct containing the list of validated return addresses and the image's memory range
   - For each address that will be called from the DLL, registers it with `AddAddress()`

2. **`SwapIn()` / `SwapOut()`**:
   - `SwapIn()` patches the retcheck data to temporarily accept the DLL's return addresses
   - `SwapOut()` restores the original data
   - These are called automatically by `RetcheckFunction<R, Args...>::operator()()`

3. **`RetcheckFunction<R, Args...>` template** (`src/retcheck_bypass.h`):
   - Wraps any function pointer whose call needs to bypass retcheck
   - On `operator()()`, calls `SwapIn()`, invokes the function, then calls `SwapOut()`
   - Detects the real call site using `_ReturnAddress()` and `ProbeCallInstruction()`

4. **`decryption_stub.asm`**:
   - MASM assembly stub used during encrypted player ID decryption
   - Provides a raw call site that retcheck bypass can register

> **Warning:** After a game patch, `kCheckData` offset and the internal structure may change. The bypass must be re-validated.

---

## 9. Development Roadmap

### Completed ✅

- [x] Core DLL: V8 engine integration, script loading, game lifecycle
- [x] Memory offset scanner with pattern matching
- [x] Retcheck bypass for safe game function calls
- [x] Maphack: level reveal via `RevealLevelById`
- [x] Automap overlay: world→screen coordinate conversion
- [x] ObjectManager: live unit tracking with events
- [x] Marker system: automap circles for players/monsters/missiles
- [x] TypeScript typings for the scripting API
- [x] Demo script (`scripts/d2r-demo`)
- [x] Documentation (`Docs/`)

### Planned / In Progress 🔧

- [ ] **Plugin Manager GUI** — In-game overlay window (ImGui) to enable/disable/reload scripts without re-injecting
- [ ] **Item filter script** — Highlight valuable drops on the automap and ground
- [ ] **Minimap enhancements** — Draw room outlines, waypoints, shrines
- [ ] **Stat overlay** — Display player stats and resistances on screen
- [ ] **Multi-script support** — Hot-reload individual scripts
- [ ] **Expanded JS API** — Expose more game data (inventory, quests, town portals)

---

## 10. Glossary

| Term | Meaning |
|------|---------|
| **DLL injection** | Technique of loading a custom `.dll` into a running process's address space |
| **V8** | Google's open-source JavaScript and WebAssembly engine (used in Chrome/Node.js) |
| **dolos** | The framework/library this project is built on; handles injection, logging, and script hosting |
| **nyx** | The V8 embedding layer (part of `dolos`); provides module loading, bindings, environment |
| **DRLG** | Diablo Random Level Generator — D2's procedural map system |
| **Unit** | Any entity in the game world (player, monster, item, missile, object, tile) |
| **UnitHashTable** | The game's internal hash map of active units, one per unit type, client and server side |
| **Automap** | The in-game minimap overlay (top-left corner or fullscreen) |
| **Retcheck** | Return-address validation used by D2R as an anti-cheat measure |
| **RIP-relative** | x86-64 addressing mode: the address is computed as `RIP + 32-bit signed offset` |
| **Offset scanner** | Scans the game executable's loaded image for byte patterns to find function/data pointers |
| **Pattern** | A byte sequence (with wildcards) used to locate a game function or variable in memory |
| **ImGui** | Immediate-Mode GUI library, used by nyx for in-game overlays |
| **`withGameLock`** | Acquires D2R's critical section before calling game functions (prevents crashes) |
| **Plugin Manager** | Planned in-game GUI to manage loaded scripts dynamically |

---

## 11. Notes for AI Assistant

### Session Startup Checklist

When beginning a new session on this project:

1. Read this file (`Docs/WIKI.md`) for full context
2. Check which branch is active: `git branch --show-current` (target: `new-v1`)
3. Review recent commits: `git log --oneline -10`
4. If working on a new script, check `typings/d2r/` for the current API surface
5. If working on C++ code, check `src/offsets.h` for available game pointers

### Key Conventions

- **C++ namespace:** All game code lives in `namespace d2r`
- **JS imports:** Use `'nyx:d2r'` prefix (e.g., `import { ObjectManager } from 'nyx:d2r'`)
- **Color format in GUI:** `0xAABBGGRR` (ABGR, not ARGB — alpha is the most significant byte)
- **Game lock:** Always use `withGameLock()` when calling game functions that modify game state
- **Automap coordinates:** Use `unit.automapX` / `unit.automapY`; skip if either is `-1`
- **Script packages:** Each script folder needs a `package.json` with a `"main"` field
- **Build output:** Compiled DLL goes to `out/install/x64-release/bin/nyx.d2r.dll`

### Owner Context

- **ytb-frosty** is a beginner Python developer learning JavaScript
- Prefer clear, well-commented JS examples over terse code
- The owner's primary goal is building JS plugins and eventually a Plugin Manager GUI
- Avoid requiring C++ changes unless strictly necessary; prefer JS-only solutions where possible
