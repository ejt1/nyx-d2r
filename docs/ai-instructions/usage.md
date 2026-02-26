# Usage Reference

This file collects practical usage details for building and running `nyx-d2r`.

## Compilation

### C++ Build (Primary)

Project uses CMake + Ninja + MSVC (Visual Studio 2022).

#### Option A: `build.bat` (recommended)

From repo root:

```bat
build.bat
```

What it does:
1. Finds VS2022 toolchain via `vswhere`.
2. Ensures V8 monolith lib is extracted.
3. Runs:
   - `cmake --preset x64-release`
   - `cmake --build out/build/x64-release`
   - `cmake --install out/build/x64-release`
4. Ensures scripts exist in install output.

#### Option B: Direct CMake commands

From repo root:

```powershell
cmake --preset x64-release
cmake --build out/build/x64-release
cmake --install out/build/x64-release
```

Available presets (`CMakePresets.json`):
- `x64-debug` (`Debug`)
- `x64-release` (`RelWithDebInfo`)
- `x64-dist` (`Release`)
- `x64-debug-local-nyx` (`Debug`, local Nyx override)
- `x64-release-local-nyx` (`RelWithDebInfo`, local Nyx override)
- `x64-dist-local-nyx` (`Release`, local Nyx override)

#### Local Nyx dependency workflow (Maven-style local override)

Use this when you want `nyx-d2r` to consume local changes from a separate Nyx checkout without changing `vendor/nyx`.

Default local override path in presets is a sibling directory:

`../nyx`

Build with local Nyx:

```powershell
cmake --preset x64-release-local-nyx
cmake --build out/build/x64-release-local-nyx
cmake --install out/build/x64-release-local-nyx
```

Debug variant:

```powershell
cmake --preset x64-debug-local-nyx
cmake --build out/build/x64-debug-local-nyx
cmake --install out/build/x64-debug-local-nyx
```

Notes:
- You do not need to build the local Nyx repo separately first.
- Rebuilding `nyx-d2r` with a `*-local-nyx` preset picks up latest local Nyx source edits automatically.
- If your local Nyx path differs, override it at configure time:
- If build fails with `v8_monolith_x64-release.lib` missing under your local Nyx `vendor/v8/lib`, run the configure task first; it now auto-copies the release lib from vendored Nyx when available.

```powershell
cmake --preset x64-release-local-nyx -DNYX_SOURCE_OVERRIDE=/path/to/your/nyx
```

VS Code tasks (`.vscode/tasks.json`) for this flow:
- `CMake Configure (x64-release-local-nyx)`
- `CMake Build (x64-release-local-nyx)`
- `CMake Install (x64-release-local-nyx)`
- `Run Injector (x64-release-local-nyx)`

#### Hardening-related CMake options

Defined in `CMakeLists.txt`:
- `NYX_D2R_ENABLE_PE_DUMP` (default `OFF`)
- `NYX_D2R_ENABLE_RETCHECK_DEBUG` (default `OFF`)

Example:

```powershell
cmake --preset x64-release -DNYX_D2R_ENABLE_PE_DUMP=ON -DNYX_D2R_ENABLE_RETCHECK_DEBUG=ON
cmake --build out/build/x64-release
cmake --install out/build/x64-release
```


## Runtime / Injector CLI

`simple_injector.exe` supports:

- no args:
  - Inject into active (foreground) `D2R.exe` instance.
- `--follow` / `-f`:
  - Follow focus across D2R instances and hide/show overlay accordingly.
- `--all` / `-a`:
  - Inject into all running `D2R.exe` instances.
- `--launch <path>` / `-l <path>`:
  - Launch D2R from path and inject.
- `--help` / `-h`:
  - Show usage.

Notes:
- Injector-only args are parsed in `tools/simple_injector.cc`.
- Unknown args fail fast with `Unknown argument`.

## Logging Controls

Script/in-overlay diagnostics are default-off and controlled by a JSON config file.
See full inventory and categories in:

- `docs/ai-instructions/logging-controls.md`

### Important

- `simple_injector.exe --verbose` and `--debug-log` are **not valid injector args**.
- Script runtime does not consume injector CLI flags.
- Script logging does not use `.flag` files anymore.

### JSON config

- `<install-bin>\scripts\d2r-demo.logging.json`
- `<install-bin>\scripts\d2r-demo\logging.json`
- Canonical repo config: `scripts/d2r-demo/logging.json`
- Repo template: `scripts/d2r-demo/d2r-demo.logging.example.json`

Use this to explicitly set `true`/`false` for each logging category.

### Log output folder

- Default: `<install-bin>\scripts\logs`
- Can be overridden in JSON config with `logsDir`.

Default install-bin:

`out\install\x64-release\bin`
