@echo off
for /f "usebackq tokens=*" %%i in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
  set VS_PATH=%%i
)
if not defined VS_PATH (
  echo Error: Visual Studio not found
  pause
  exit /b 1
)
call "%VS_PATH%\VC\Auxiliary\Build\vcvarsall.bat" x64
cmake --preset x64-release
cmake --build out/build/x64-release
cmake --install out/build/x64-release
pause
