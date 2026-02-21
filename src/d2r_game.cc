#include "d2r_game.h"

#include <dolos/dolos.h>
#include <nyx/extension.h>
#include <nyx/nyx.h>

#include "d2r_binding.h"
#include "d2r_builtins.h"
#include "offsets.h"
#include "retcheck_bypass.h"

#include <dolos/pipe_log.h>

dolos::Game* dolos::Game::Create() {
  return new d2r::D2rGame();
}

namespace d2r {

bool D2rGame::OnInitialize() {
  PIPE_LOG("[nyx.d2r] Initializing offsets...");
  if (!InitializeOffsets()) {
    PIPE_LOG_WARN("[nyx.d2r] Some offsets could not be resolved - features may be limited");
  }

  if (!RetcheckBypass::Initialize()) {
    PIPE_LOG_WARN("[nyx.d2r] Failed to install retcheck bypass - game function calls may crash");
  }

  nyx::RegisterBinding("d2r", InitD2RBinding);
  d2r_builtins::RegisterBuiltins();
  nyx::SetScriptDirectory(dolos::get_module_cwd() + "\\scripts");

  return true;
}

void D2rGame::OnShutdown() {
  RetcheckBypass::Shutdown();
}

}  // namespace d2r
