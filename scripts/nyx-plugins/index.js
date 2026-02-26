'use strict';

import { ObjectManager } from 'nyx:d2r';
import { withGameLock }  from 'nyx:memory';
import { PluginManager } from './plugin-manager.js';
import { registerMaphack } from './maphack.js';
import { registerAutoPot }  from './auto-pot.js';
import { registerAutoTele } from './auto-tele.js';
import { registerHelp }     from './help.js';

const binding = internalBinding('d2r');

try {
  const objMgr  = new ObjectManager();
  const manager = new PluginManager();

  // ── Register plugins (order = display order in panel) ────────────────────
  // registerMaphack returns the live config object AND exposes getZoneExits()
  const mhResult = registerMaphack(manager, objMgr, binding);
  // mhResult is the config object; zone exits instance lives inside maphack.js
  // We get it via the accessor that maphack.js attaches to its own module export.
  // Cleaner approach: maphack now returns { config, getZoneExits }
  const getMhZoneExits = mhResult.getZoneExits ?? (() => null);

  registerAutoPot(manager, objMgr);
  registerAutoTele(manager, objMgr);
  registerHelp(manager);

  // ── Attach Unit Explorer at the bottom of the panel ──────────────────────
  // This restores the original debug-panel functionality inside the manager.
  manager.attachUnitExplorer(objMgr);

  // ── Main tick loop ────────────────────────────────────────────────────────
  let revealedLevels = [];

  setInterval(() => {
    // Scan all units — fires unitAdded/unitRemoved events
    objMgr.tick();

    // Refresh Unit Explorer labels
    manager.tick();

    const me = objMgr.me;

    // Reset reveal list when we leave a game
    if (!me && revealedLevels.length > 0) {
      revealedLevels = [];
    }

    // Auto-reveal current level on the minimap
    if (me && manager.isEnabled('maphack') && mhResult.revealEnabled) {
      const levelId = me.path?.room?.drlgRoom?.level?.id;
      if (levelId !== undefined && !revealedLevels.includes(levelId)) {
        withGameLock(() => {
          if (binding.revealLevel(levelId)) {
            console.log(`[Maphack] Revealed level ${levelId}`);
            revealedLevels.push(levelId);
          }
        });
      }
    }

    // Zone exits — update draw positions every tick
    if (manager.isEnabled('maphack')) {
      const ze = getMhZoneExits();
      if (ze) ze.update();
    }

  }, 20);

  console.log('[Nyx] Loaded: Maphack, AutoPot, AutoTele, Help | Unit Explorer active');

} catch (err) {
  console.error(`[Nyx] Fatal: ${err.message}`);
  console.error(err.stack);
}
