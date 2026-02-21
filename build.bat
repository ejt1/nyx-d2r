@echo off
for /f "usebackq tokens=*" %%i in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
  set VS_PATH=%%i
)
if not defined VS_PATH (
  echo Error: Visual Studio not found
  pause
  exit /b 1
)

set V8_LIB=%~dp0vendor\nyx\vendor\v8\lib\v8_monolith_x64-release.lib
set V8_ARCHIVE=%~dp0vendor\nyx\vendor\v8\lib\v8_monolith_x64-release.part01.rar
set V8_LIBDIR=%~dp0vendor\nyx\vendor\v8\lib

if exist "%V8_LIB%" goto :build

echo Extracting v8_monolith_x64-release...

if exist "%ProgramFiles%\WinRAR\WinRAR.exe" (
  "%ProgramFiles%\WinRAR\WinRAR.exe" x "%V8_ARCHIVE%" "%V8_LIBDIR%\"
  goto :check_extract
)
if exist "%ProgramFiles(x86)%\WinRAR\WinRAR.exe" (
  "%ProgramFiles(x86)%\WinRAR\WinRAR.exe" x "%V8_ARCHIVE%" "%V8_LIBDIR%\"
  goto :check_extract
)
if exist "%ProgramFiles%\7-Zip\7z.exe" (
  "%ProgramFiles%\7-Zip\7z.exe" x "%V8_ARCHIVE%" -o"%V8_LIBDIR%"
  goto :check_extract
)
if exist "%ProgramFiles(x86)%\7-Zip\7z.exe" (
  "%ProgramFiles(x86)%\7-Zip\7z.exe" x "%V8_ARCHIVE%" -o"%V8_LIBDIR%"
  goto :check_extract
)

echo Error: WinRAR or 7-Zip not found. Please extract %V8_ARCHIVE% manually.
pause
exit /b 1

:check_extract
if not exist "%V8_LIB%" (
  echo Error: Extraction failed.
  pause
  exit /b 1
)
echo Extraction complete.

:build
call "%VS_PATH%\VC\Auxiliary\Build\vcvarsall.bat" x64
cmake --preset x64-release
cmake --build out/build/x64-release
cmake --install out/build/x64-release
pause
