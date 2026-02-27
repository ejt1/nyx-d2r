'use strict';

/**
 * exit-markers.js — draws diamond markers + text labels at level exits,
 * waypoints, and special POIs on the D2R automap.
 *
 * Exit detection uses two complementary sources:
 *
 * 1. Type 5 (RoomTile) game units — dungeon entrances, stairs, portals and
 *    doorway warps (e.g. Forgotten Tower entrance inside Black Marsh).
 *    Destination level read via pointer chain:
 *      tile.data → pTileData[0] → D2DrlgRoomStrc* → +0x90 → ptLevel → +0x1F8
 *
 * 2. DRLG room walk — walk-across map-edge transitions between outdoor
 *    areas (e.g. Dark Wood ↔ Black Marsh, River of Flame → Chaos Sanctuary).
 *    Walk the level's DrlgRoom linked list, check each room's ptRoomsNear
 *    vector for rooms that belong to a different level.
 *
 * Other POIs use Type 2 (GameObject) units identified by classId:
 *   - Waypoints: known classId set
 *   - Quest items: known classId → label mapping
 *
 * Features:
 *   - Magenta diamonds + labels for level exits
 *   - Yellow diamonds for waypoints
 *   - Green diamonds for Tal Rasha's real tomb (Canyon of the Magi)
 *   - Green diamonds for quest items (tomes, altars, etc.)
 *   - Lines from player to all POIs
 */

import { background } from 'gui';
import { tryWithGameLock } from 'nyx:memory';
import { appendFileSync } from 'fs';

import { getPlayerLevelAddress } from './lib/level-address.js';
import { scanTileExits } from './detection/tile-exit-reader.js';
import { walkRoom2 } from './detection/room2-walker.js';
import { detectBorderExits } from './detection/border-detector.js';
import { LEVEL_ADJACENCY, MAP_EDGE_ADJACENCY } from './data/level-adjacency.js';
import { buildPois } from './detection/poi-builder.js';
import { clearExits, redrawPois } from './rendering/poi-renderer.js';

const REDRAW_INTERVAL_MS = 40;  // redraw cap to reduce canvas churn
const PERF_TEXT_KEY = 'exit-perf';
const PERF_TEXT_SHADOW_KEY = 'exit-perf-shadow';
const PERF_TEXT_COLOR = 0xFF00FFFF;
const PERF_TEXT_SHADOW = 0xFF000000;
const PERF_TEXT_FONT = 18;
const PERF_TEXT_POS = [20, 62];
const DEFAULT_PERF_LOG_FILE = 'exit-markers-perf.log';


export class ExitMarkers {
  constructor(objMgr, options = {}) {
    const perf = options.perf || {};

    this._objMgr   = objMgr;
    this._perfEnabled = !!perf.perfEnabled;
    this._perfOverlayEnabled = !!perf.overlay;
    this._perfConsoleEnabled = !!perf.toConsole;
    this._perfLogEnabled = !!perf.toFile;
    this._perfLogFile = perf.filePath || DEFAULT_PERF_LOG_FILE;
    this._exitKeys = new Set();
    this._levelId  = -1;    // sentinel (never matches a real level)
    // Cached POI data: [{ clientX, clientY, subX, subY, destLevelId, poiType, label }]
    this._pois     = [];
    this._diagMsg  = '';      // per-tick chain info
    this._rebuildDiag = '';   // persists from last rebuild
    this._lastRebuild = 0;   // timestamp of last rebuild
    this._lastTileCount = 0; // track tile unit count changes
    this._realTombLevel = 0; // real Tal Rasha tomb level (66-72), from DRLG
    this._levelChangeTime = 0; // timestamp of last level change
    this._adjExpected = 0;     // expected adjacent levels from LEVEL_ADJACENCY
    this._adjFound = 0;        // actual adjacent levels found with Room2 data
    this._lastRedraw = 0;      // redraw throttle timestamp
    this._perfText = '';
    this._perfWindowStart = Date.now();
    this._perfReasons = Object.create(null);
    this._perfRbAttempt = 0;
    this._perfRbOk = 0;
    this._perfRbLockFail = 0;
    this._perfRbMs = 0;
    this._perfRrAttempt = 0;
    this._perfRrOk = 0;
    this._perfRrLockFail = 0;
    this._perfRrDrawn = 0;
    this._perfRrRemoved = 0;
    this._perfRbLockFailTotal = 0;
    this._perfRrLockFailTotal = 0;

    if (this._perfEnabled) {
      this._perfText = 'ExitPerf initializing...';
      if (this._perfLogEnabled) {
        this._appendPerfLog(`=== ${new Date().toISOString()} exit-markers perf session ===`);
        this._appendPerfLog(`log_file=${this._perfLogFile}`);
      }
      if (this._perfConsoleEnabled) {
        try { console.log(`[ExitPerf] logging to ${this._perfLogFile}`); } catch (_) {}
      }
    }
  }

  // -- main loop (call from setInterval AFTER objMgr.tick()) ----------------

  tick() {
    try {
      const me = this._objMgr.me;
      if (!me) { this._clearAll(); return; }

      // --- read level ID via snapshot chain ---
      const path = me.path;
      const room = path?.room;
      const drlgRoom = room?.drlgRoom;
      const level = drlgRoom?.level;
      const levelId = level?.id;

      // Show chain diagnostic
      this._diagMsg = `chain: path=${!!path} room=${!!room} ` +
        `drlg=${!!drlgRoom} lvl=${!!level} id=${levelId}`;

      // Rebuild POI list when level changes or tile count changes
      if (levelId !== undefined && levelId !== this._levelId) {
        this._levelId = levelId;
        this._lastTileCount = 0;
        this._levelChangeTime = Date.now();
        this._adjExpected = (LEVEL_ADJACENCY[levelId] || []).length;
        this._adjFound = 0;
        this._rebuild(me, levelId, 'levelChange');
      } else if (levelId !== undefined) {
        // Re-scan when new tile units appear (exits load as player explores)
        const tiles = this._objMgr.getUnits(5);
        const tc = tiles ? tiles.size : 0;
        const now = Date.now();
        const sinceLevelChange = now - this._levelChangeTime;
        // Keep rebuilding every ~2s for 10s after entering a level, if
        // adjacent level data is still incomplete (Room2 lists load async).
        const adjIncomplete = this._adjFound < this._adjExpected
          && sinceLevelChange < 10000
          && now - this._lastRebuild > 2000;
        const tileCountChanged = tc !== this._lastTileCount;
        const emptyRetry = (now - this._lastRebuild > 3000 && this._pois.length === 0);
        const bossRescan = (this._needsBossRescan && now - this._lastRebuild > 2000);
        if (tileCountChanged || emptyRetry || bossRescan || adjIncomplete) {
          this._lastTileCount = tc;
          const reasons = [];
          if (tileCountChanged) reasons.push('tileCount');
          if (emptyRetry) reasons.push('emptyRetry');
          if (bossRescan) reasons.push('bossRescan');
          if (adjIncomplete) reasons.push('adjIncomplete');
          this._rebuild(me, levelId, reasons.join('+'));
        }
      }

      if (me.automapX < 0) {
        clearExits(this._exitKeys);
        this._clearPerfOverlay();
        if (this._perfEnabled) this._flushPerfWindow(Date.now());
        return;
      }

      const redrawNow = Date.now();
      if (redrawNow - this._lastRedraw >= REDRAW_INTERVAL_MS) {
        const renderStats = redrawPois(this._pois, me, this._exitKeys, this._levelId, this._rebuildDiag);
        this._noteRenderStats(renderStats);
        this._lastRedraw = redrawNow;
      }
      if (this._perfEnabled) {
        this._flushPerfWindow(redrawNow);
        this._drawPerfOverlay();
      }
    } catch (e) {
      if (this._perfEnabled) {
        this._appendPerfLog(`${new Date().toISOString()} tickErr=${e.message}`);
      }
      try {
        // background.addText('exit-err', [20, 80], 0xFF0000FF, `ERR: ${e.message}`);
      } catch (_) {}
    }
  }

  // -----------------------------------------------------------------------
  // Rebuild POI list from multiple data sources:
  //
  // Source 1 — Type 5 (RoomTile) units: These represent dungeon entrances,
  //   stairs, portals, and doorway warps (e.g. Forgotten Tower entrance,
  //   Hole entrance).  We chase the data pointer to get the exact
  //   destination level ID.  NOT available for outdoor walk-across exits.
  //
  // Source 2 — Center warps + level-coordinate matching: Read center warp
  //   positions from the DrlgLevel struct, then walk the DrlgLevel linked
  //   list to get coordinates of adjacent levels.  Distance-based matching
  //   assigns each unmatched warp to the closest adjacent level, correctly
  //   labeling walk-across map-edge transitions (e.g. Dark Wood ↔ Black
  //   Marsh, River of Flame → Chaos Sanctuary).
  //
  // Source 3 — Type 2 (GameObject) units: Waypoints and quest items
  //   identified by classId.
  // -----------------------------------------------------------------------
  _rebuild(me, currentLevelId, reason = 'unknown') {
    if (!currentLevelId) return;
    const rebuildStart = Date.now();
    this._noteRebuildAttempt(reason);

    let rd = '';

    // ===== All memory reads happen inside a single game lock =====
    const tileUnits = [];          // { posX, posY, classId, destLevelId } — all Type-5 tiles
    const centerWarps = [];        // { subX, subY }
    const adjLevelCoords = new Map(); // levelId → { centerSubX, centerSubY, backX, backY, sizeX, sizeY }
    let curLevelBounds = null;     // { minX, minY, maxX, maxY } in subtile coords
    const roomExits = [];          // { subX, subY, destLevelId } — outdoor exits via direction matching
    const roomTileExits = [];      // { subX, subY, destLevelId } — from Room2.ptRoomTiles walk
    const presetBosses = [];        // { subX, subY, classId, label } — from Room2.ptPresetUnits
    const presetWaypoints = [];     // { subX, subY } — waypoints from Room2 presets
    const presetNPCs = [];          // { classId, levelRelX, levelRelY } — raw NPC presets for special handling
    const presetCairnStones = [];   // { subX, subY } — Cairn Stones in Stony Field (Tristram portal)

    const locked = tryWithGameLock(() => {
      // ----- Read tile units (Source 1) -----
      {
        const { tileUnits: tu, diag: td } =
          scanTileExits(this._objMgr.getUnits(5), currentLevelId);
        tileUnits.push(...tu);
        rd += td;
      }

      // ----- Sources 2a + 2b: center warps, adj level coords, Room2 walk -----
      {
        const lvlAddr = getPlayerLevelAddress(me._address);
        const allAdjSet = new Set(LEVEL_ADJACENCY[currentLevelId] || []);
        const r2 = walkRoom2(lvlAddr, currentLevelId, allAdjSet);

        centerWarps.push(...r2.centerWarps);
        for (const [k, v] of r2.adjLevelCoords) adjLevelCoords.set(k, v);
        curLevelBounds = r2.curLevelBounds;
        roomTileExits.push(...r2.roomTileExits);
        presetBosses.push(...r2.presetBosses);
        presetWaypoints.push(...r2.presetWaypoints);
        presetNPCs.push(...r2.presetNPCs);
        presetCairnStones.push(...r2.presetCairnStones);
        if (r2.realTombLevel > 0) this._realTombLevel = r2.realTombLevel;
        this._adjFound = r2.adjLevelCoords.size;
        rd += r2.diag;

        // Border detection: shared-edge walk-across outdoor exits
        roomExits.push(...detectBorderExits(
          curLevelBounds,
          adjLevelCoords,
          MAP_EDGE_ADJACENCY[currentLevelId] || [],
        ));
      }

      return true; // signal success
    }, 500);

    if (locked !== true) {
      this._noteRebuildResult(false, Date.now() - rebuildStart);
      this._rebuildDiag = rd + ' LOCK';
      return;
    }

    rd += ` cw=${centerWarps.length}`;

    const built = buildPois({
      currentLevelId,
      objMgr: this._objMgr,
      tileUnits,
      roomTileExits,
      roomExits,
      presetBosses,
      presetWaypoints,
      presetNPCs,
      presetCairnStones,
      adjLevelCoords,
      curLevelBounds,
      realTombLevel: this._realTombLevel,
    });

    this._pois = built.pois;
    this._needsBossRescan = built.needsBossRescan;
    if (built.realTombLevel > 0) this._realTombLevel = built.realTombLevel;
    rd += built.diag;
    this._rebuildDiag = rd;
    this._lastRebuild = Date.now();
    this._noteRebuildResult(true, this._lastRebuild - rebuildStart);
  }

  _appendPerfLog(line) {
    if (!this._perfEnabled || !this._perfLogEnabled) return;
    try {
      appendFileSync(this._perfLogFile, `${line}\n`);
    } catch (_) {
      this._perfLogEnabled = false;
    }
  }

  _noteRebuildAttempt(reason) {
    if (!this._perfEnabled) return;
    this._perfRbAttempt++;
    if (!reason) return;
    for (const part of reason.split('+')) {
      if (!part) continue;
      this._perfReasons[part] = (this._perfReasons[part] || 0) + 1;
    }
  }

  _noteRebuildResult(ok, durationMs) {
    if (!this._perfEnabled) return;
    if (ok) {
      this._perfRbOk++;
      this._perfRbMs += Math.max(0, durationMs || 0);
    } else {
      this._perfRbLockFail++;
      this._perfRbLockFailTotal++;
    }
  }

  _noteRenderStats(stats) {
    if (!this._perfEnabled) return;
    if (!stats || stats.attempted !== true) return;
    this._perfRrAttempt++;
    if (!stats.projected) {
      this._perfRrLockFail++;
      this._perfRrLockFailTotal++;
      return;
    }
    if (stats.reconciled) {
      this._perfRrOk++;
      this._perfRrDrawn += stats.drawn || 0;
      this._perfRrRemoved += stats.removed || 0;
    }
  }

  _clearPerfOverlay() {
    try { background.remove(PERF_TEXT_KEY); } catch (_) {}
    try { background.remove(PERF_TEXT_SHADOW_KEY); } catch (_) {}
  }

  _drawPerfOverlay() {
    if (!this._perfEnabled || !this._perfOverlayEnabled) return;
    if (!this._perfText) return;
    background.addText(PERF_TEXT_SHADOW_KEY,
      [PERF_TEXT_POS[0] + 1, PERF_TEXT_POS[1] + 1],
      PERF_TEXT_SHADOW, this._perfText, PERF_TEXT_FONT);
    background.addText(PERF_TEXT_KEY, PERF_TEXT_POS,
      PERF_TEXT_COLOR, this._perfText, PERF_TEXT_FONT);
  }

  _resetPerfWindow(now) {
    this._perfWindowStart = now;
    this._perfReasons = Object.create(null);
    this._perfRbAttempt = 0;
    this._perfRbOk = 0;
    this._perfRbLockFail = 0;
    this._perfRbMs = 0;
    this._perfRrAttempt = 0;
    this._perfRrOk = 0;
    this._perfRrLockFail = 0;
    this._perfRrDrawn = 0;
    this._perfRrRemoved = 0;
  }

  _flushPerfWindow(now) {
    if (!this._perfEnabled) return;
    const elapsedMs = now - this._perfWindowStart;
    if (elapsedMs < 1000) return;
    const sec = Math.max(elapsedMs / 1000, 1);
    const rbPerSec = this._perfRbOk / sec;
    const rrPerSec = this._perfRrOk / sec;
    const rrDrawnPerSec = this._perfRrDrawn / sec;
    const rrRemovedPerSec = this._perfRrRemoved / sec;
    const rbAvgMs = this._perfRbOk > 0 ? (this._perfRbMs / this._perfRbOk) : 0;
    const reasonStr = Object.entries(this._perfReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}:${v}`)
      .join(',');

    this._perfText = `RB ${rbPerSec.toFixed(1)}/s lock:${this._perfRbLockFail} avg:${rbAvgMs.toFixed(0)}ms`
      + ` | RR ${rrPerSec.toFixed(1)}/s lock:${this._perfRrLockFail}`
      + ` draw:${rrDrawnPerSec.toFixed(1)}/s rm:${rrRemovedPerSec.toFixed(1)}/s`
      + ` | lv:${this._levelId} pois:${this._pois.length}`
      + ` | ${reasonStr || 'idle'}`;

    this._appendPerfLog(
      `${new Date(now).toISOString()} lv=${this._levelId} pois=${this._pois.length}`
      + ` rb_ok_ps=${rbPerSec.toFixed(2)} rb_attempt=${this._perfRbAttempt}`
      + ` rb_lock=${this._perfRbLockFail} rb_avg_ms=${rbAvgMs.toFixed(1)}`
      + ` rr_ok_ps=${rrPerSec.toFixed(2)} rr_attempt=${this._perfRrAttempt}`
      + ` rr_lock=${this._perfRrLockFail} rr_draw_ps=${rrDrawnPerSec.toFixed(2)}`
      + ` rr_rm_ps=${rrRemovedPerSec.toFixed(2)} reasons=${reasonStr || 'none'}`
      + ` total_rb_lock=${this._perfRbLockFailTotal} total_rr_lock=${this._perfRrLockFailTotal}`
    );

    this._resetPerfWindow(now);
  }

  _clearAll() {
    clearExits(this._exitKeys);
    this._clearPerfOverlay();
    this._levelId = -1;
    this._pois = [];
    this._diagMsg = '';
    this._rebuildDiag = '';
    this._lastRedraw = 0;
    this._resetPerfWindow(Date.now());
  }

  destroy() {
    this._clearAll();
  }
}
