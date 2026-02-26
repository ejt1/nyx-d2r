'use strict';

import { Text, TextColored, SeparatorText, Spacing, Separator } from 'gui';

function registerHelp(manager) {
  manager.register('help', {
    name: 'Help / About',
    description: '',
    enabledByDefault: true,
    defaultOpen: false,

    onEnable() {},
    onDisable() {},

    buildUI(container) {
      container.add(new SeparatorText('About'));
      container.add(new TextColored('Nyx D2R Plugin Suite', 0.4, 0.8, 1.0, 1.0));
      container.add(new Text('A modular plugin framework for Diablo II: Resurrected'));
      container.add(new Text('Built on the Nyx runtime + Dolos injection framework'));

      container.add(new Spacing());
      container.add(new SeparatorText('Plugins'));

      container.add(new TextColored('Maphack', 0.3, 1.0, 0.6, 1.0));
      container.add(new Text('  Auto-reveals the automap when entering new areas.\n  Color-coded dots on the map for monsters, players,\n  and missiles. Special monsters highlighted.'));

      container.add(new Spacing());
      container.add(new TextColored('Auto Potion', 0.3, 1.0, 0.6, 1.0));
      container.add(new Text('  Monitors your HP and Mana in real time.\n  Will auto-use belt potions when they drop below\n  your configured thresholds.\n  (Packet sending requires C++ binding)'));

      container.add(new Spacing());
      container.add(new TextColored('Auto Teleport', 0.3, 1.0, 0.6, 1.0));
      container.add(new Text('  Teleport chain planner for Sorc / Enigma.\n  Set a target, press F5, and it plans the route.\n  (Packet sending requires C++ binding)'));

      container.add(new Spacing());
      container.add(new SeparatorText('Controls'));
      container.add(new Text('  Each plugin has an Enable checkbox.\n  Collapse/expand sections by clicking the header.\n  InputInt fields: click +/- or type a value.\n  SliderInt fields: drag left/right to adjust.'));

      container.add(new Spacing());
      container.add(new SeparatorText('Status'));
      container.add(new TextColored('Features ready:', 0.8, 0.8, 0.8, 1.0));
      container.add(new Text('  [x] Map reveal\n  [x] Automap markers\n  [x] HP/Mana monitoring\n  [x] Teleport chain planning'));

      container.add(new Spacing());
      container.add(new TextColored('Needs C++ binding:', 0.8, 0.6, 0.2, 1.0));
      container.add(new Text('  [ ] Belt packet sending (auto pot)\n  [ ] Skill cast packets (auto tele)\n  [ ] Game camera zoom'));

      container.add(new Spacing());
      container.add(new Separator());
      container.add(new TextColored('nyx-d2r by Anthony', 0.4, 0.4, 0.4, 1.0));
    },
  });
}

export { registerHelp };
