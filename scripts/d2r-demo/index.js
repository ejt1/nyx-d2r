'use strict';

import { ObjectManager, UnitTypes, DebugPanel, revealLevel } from 'nyx:d2r';
import { RuntimeModes, setRuntimeMode, getRuntimeMode, isActiveMutationEnabled } from 'nyx:d2r';
import { withGameLock } from 'nyx:memory';
import { Markers } from './markers.js';
import { ExitMarkers } from './exit-markers.js';
import { resolveLoggingConfig } from './lib/logging-config.js';
import { createDiagnosticLogger } from './lib/diagnostic-logger.js';

const processBinding = internalBinding('process');

// d2r-demo expects reveal behavior; keep mutation enabled by default here.
const ENABLE_ACTIVE_MUTATION = true;
const DEBUG_PANEL_REFRESH_INTERVAL_MS = 100;

const LOGGING = resolveLoggingConfig({
  processBinding,
});
const DEBUG_LOG = LOGGING.debugLog;
const UNIT_EXPLORER_PERF_LOG = LOGGING.unitExplorer.perfEnabled;
const UNIT_EXPLORER_PERF_LOG_FILE = LOGGING.unitExplorer.filePath;
const scriptLogger = createDiagnosticLogger({
  name: 'Script',
  enabled: LOGGING.script.enabled,
  minLevel: LOGGING.script.minLevel,
  toConsole: LOGGING.script.toConsole,
  toFile: LOGGING.script.toFile,
  filePath: LOGGING.script.filePath,
});
const unitExplorerLogger = createDiagnosticLogger({
  name: 'UnitExplorerPerf',
  enabled: LOGGING.unitExplorer.perfEnabled,
  minLevel: LOGGING.unitExplorer.minLevel,
  toConsole: LOGGING.unitExplorer.toConsole,
  toFile: LOGGING.unitExplorer.toFile,
  filePath: LOGGING.unitExplorer.filePath,
});
const objectManagerLogger = createDiagnosticLogger({
  name: 'ObjectManager',
  enabled: LOGGING.objectManager.enabled,
  minLevel: LOGGING.objectManager.minLevel,
  toConsole: LOGGING.objectManager.toConsole,
  toFile: LOGGING.objectManager.toFile,
  filePath: LOGGING.objectManager.filePath,
});

function unitExplorerPerfLogger(...args) {
  unitExplorerLogger.info(...args);
}

function debugLog(...args) {
  if (DEBUG_LOG) {
    scriptLogger.debug(...args);
  }
}

try {
  if (UNIT_EXPLORER_PERF_LOG) {
    unitExplorerLogger.info(`session_start log_file=${UNIT_EXPLORER_PERF_LOG_FILE}`);
    if (LOGGING.sourcePath) {
      unitExplorerLogger.info(`config_source=${LOGGING.sourcePath}`);
    }
  }
  const objMgr = new ObjectManager({
    logChainIssues: LOGGING.objectManager.chainWarnings,
    logRiskCircuit: LOGGING.objectManager.riskCircuit,
    logInfo: (...args) => objectManagerLogger.info(...args),
    logError: (...args) => objectManagerLogger.error(...args),
  });
  const debugPanel = new DebugPanel(objMgr, {
    perfLog: UNIT_EXPLORER_PERF_LOG,
    logger: unitExplorerPerfLogger
  });
  const markers  = new Markers(objMgr);
  const exitMarkers = new ExitMarkers(objMgr, {
    perf: LOGGING.exitMarkers,
  });
  const desiredRuntimeMode = ENABLE_ACTIVE_MUTATION ? RuntimeModes.ActiveMutation : RuntimeModes.ReadOnlySafe;
  if (!setRuntimeMode(desiredRuntimeMode)) {
    console.warn(`[RuntimeMode] Failed to set mode: ${desiredRuntimeMode}`);
  }
  if (DEBUG_LOG) {
    scriptLogger.info('debug logging enabled');
    if (LOGGING.sourcePath) {
      scriptLogger.info(`config_source=${LOGGING.sourcePath}`);
    }
  }
  debugLog(`[RuntimeMode] ${getRuntimeMode()}`);
  if (!isActiveMutationEnabled()) {
    console.warn('Mutation features disabled in read_only_safe mode');
  }

  objMgr.tick();

  const players = objMgr.getUnits(UnitTypes.Player);
  const monsters = objMgr.getUnits(UnitTypes.Monster);
  const items = objMgr.getUnits(UnitTypes.Item);
  const objects = objMgr.getUnits(UnitTypes.Object);
  const missiles = objMgr.getUnits(UnitTypes.Missile);
  const tiles = objMgr.getUnits(UnitTypes.Tile);

  debugLog(`Objects`);
  debugLog(`  Players:  ${players.size}`);
  debugLog(`  Monsters: ${monsters.size}`);
  debugLog(`  Items:    ${items.size}`);
  debugLog(`  Objects:  ${objects.size}`);
  debugLog(`  Missiles: ${missiles.size}`);
  debugLog(`  Tiles:    ${tiles.size}`);

  if (DEBUG_LOG && objMgr.me) {
    debugLog(`\nLocal player: id=${objMgr.me.id} at (${objMgr.me.posX}, ${objMgr.me.posY})`);
    debugLog(JSON.stringify(objMgr.me, (_, v) => typeof v === 'bigint' ? v.toString(16) : v, 2));
  }

  // Show first few monsters
  let count = 0;
  for (const [id, monster] of monsters) {
    if (count >= 5) break;
    if (DEBUG_LOG) {
      debugLog(`  Monster id=${id} classId=${monster.classId} at (${monster.posX}, ${monster.posY}) alive=${monster.isAlive}`);
    }
    count++;
  }

  let revealed_levels = [];
  let revealDisabled = !isActiveMutationEnabled();
  let revealFailureStreak = 0;
  let wasInGame = !!objMgr.me;
  let lastDebugPanelRefresh = 0;
  setInterval(() => {
    objMgr.tick();
    exitMarkers.tick();
    const now = Date.now();
    if (now - lastDebugPanelRefresh >= DEBUG_PANEL_REFRESH_INTERVAL_MS) {
      debugPanel.refresh();
      lastDebugPanelRefresh = now;
    }

    if (!revealDisabled && !isActiveMutationEnabled()) {
      revealDisabled = true;
      console.warn('Runtime mode changed to read_only_safe; disabling reveal');
    }

    if (!revealDisabled && typeof objMgr.isRiskCircuitTripped === 'function' && objMgr.isRiskCircuitTripped()) {
      revealDisabled = true;
      console.warn('Reveal circuit breaker enabled for this session; keeping read-only overlays active');
    }

    const me = objMgr.me;
    const inGame = !!me;
    if (inGame !== wasInGame) {
      if (inGame) {
        debugLog('[Transition] Entered game');
      } else {
        debugLog('[Transition] Left game');
      }
      wasInGame = inGame;
    }

    if (!me && revealed_levels.length > 0) {
      debugLog("Resetting revealed levels");
      revealed_levels = [];
      revealFailureStreak = 0;
    }
    if (me && !revealDisabled) {
      const currentLevelId = me.path?.room?.drlgRoom?.level?.id;
      if (currentLevelId !== undefined && !revealed_levels.includes(currentLevelId)) {
        withGameLock(_ => {
          if (revealLevel(currentLevelId)) {
            debugLog(`Revealed level ${currentLevelId}`);
            revealed_levels.push(currentLevelId);
            revealFailureStreak = 0;
          } else {
            revealFailureStreak++;
            if (revealFailureStreak >= 3) {
              revealDisabled = true;
              console.warn('Reveal disabled after repeated failures; continuing in read-only mode');
            }
          }
        });
      }
    }
  }, 20);
} catch (err) {
  console.error(err.message);
  console.error(err.stack);
}
