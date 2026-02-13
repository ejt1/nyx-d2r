#pragma once

#include <dolos/game.h>

namespace d2r {

class D2rGame : public dolos::Game {
 public:
  bool OnInitialize() override;
  void OnShutdown() override;
};

}  // namespace d2r
