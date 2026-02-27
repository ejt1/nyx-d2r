'use strict';

const gui = require('gui');
const { UnitTypes } = require('d2r/types');

function formatTime(ns) {
  if (ns < 1000) return `${ns.toFixed(1)}ns`;
  if (ns < 1000000) return `${(ns / 1000).toFixed(2)}us`;
  if (ns < 1000000000) return `${(ns / 1000000).toFixed(2)}ms`;
  return `${(ns / 1000000000).toFixed(2)}s`;
}

// moving average with a time-based decay.
class LoadAvg {
  constructor(windowSecs) {
    this._tau = windowSecs * 1000; // ms
    this._value = NaN;
    this._lastMs = 0;
  }

  update(sample, nowMs) {
    if (isNaN(this._value)) {
      this._value = sample;
      this._lastMs = nowMs;
      return;
    }
    const dt = nowMs - this._lastMs;
    this._lastMs = nowMs;
    if (dt > 0) {
      const alpha = 1 - Math.exp(-dt / this._tau);
      this._value += alpha * (sample - this._value);
    }
  }

  get value() { return this._value; }
}

const TYPE_NAMES = ['Players', 'Monsters', 'Objects', 'Missiles', 'Items', 'Tiles'];
const TYPE_COUNT = TYPE_NAMES.length;
const PANEL_REFRESH_INTERVAL_MS = 250;
const DETAIL_REFRESH_INTERVAL_MS = 500;
const PERF_LOG_INTERVAL_MS = 1000;

class DebugPanel {
  constructor(objectManager, options = {}) {
    this._objMgr = objectManager;
    this._perfEnabled = !!options.perfLog;
    this._logger = typeof options.logger === 'function' ? options.logger : (...args) => console.log(...args);

    this._nodes = new Array(TYPE_COUNT);
    for (let i = 0; i < TYPE_COUNT; i++) {
      this._nodes[i] = new Map();
    }

    this._tickAvgs     = [new LoadAvg(1), new LoadAvg(10), new LoadAvg(60)];
    this._lockAvgs     = [new LoadAvg(1), new LoadAvg(10), new LoadAvg(60)];
    this._lastPanelRefreshMs = 0;
    this._lastDetailRefreshMs = 0;
    this._trackingActive = false;
    this._needsResync = true;
    this._perfLastEmitMs = Date.now();
    this._perf = {
      refreshCalls: 0,
      refreshOk: 0,
      refreshThrottle: 0,
      skipPanelClosed: 0,
      skipPanelInvisible: 0,
      detailOk: 0,
      detailThrottle: 0,
      detailNodeUpdates: 0,
      headerClosedSkips: 0,
      headerStateReadErrors: 0,
      unitAdded: 0,
      unitRemoved: 0,
      unitEventsSkipped: 0,
      resyncRuns: 0
    };

    this._panel = new gui.Panel('Unit Explorer');
    this._summary = new gui.Text('No data');
    this._panel.add(this._summary);

    this._headers = new Array(TYPE_COUNT);
    for (let i = 0; i < TYPE_COUNT; i++) {
      this._headers[i] = new gui.CollapsingHeader(`${TYPE_NAMES[i]} (0)###DebugPanelHeader${i}`);
      this._panel.add(this._headers[i]);
    }

    objectManager.on('unitAdded', (unit, type) => this._onUnitAdded(unit, type));
    objectManager.on('unitRemoved', (unit, type) => this._onUnitRemoved(unit, type));

    if (this._perfEnabled) {
      this._logger('[UnitExplorerPerf] enabled');
    }
  }

  _onUnitAdded(unit, type) {
    if (!this._trackingActive) {
      this._needsResync = true;
      if (this._perfEnabled) this._perf.unitEventsSkipped++;
      return;
    }
    this._addNode(unit, type);
  }

  _addNode(unit, type) {
    const node = new gui.TreeNode(this._unitLabel(unit));
    const detail = new gui.Text(this._unitDetail(unit, type));
    node.add(detail);
    node._detail = detail;
    node._unit = unit;

    this._nodes[type].set(unit.id, node);
    this._headers[type].add(node);
    this._updateHeaderLabel(type);
    if (this._perfEnabled) this._perf.unitAdded++;
  }

  _onUnitRemoved(unit, type) {
    if (!this._trackingActive) {
      this._needsResync = true;
      if (this._perfEnabled) this._perf.unitEventsSkipped++;
      return;
    }
    const node = this._nodes[type].get(unit.id);
    if (node) {
      node.destroy();
      this._nodes[type].delete(unit.id);
      this._updateHeaderLabel(type);
      if (this._perfEnabled) this._perf.unitRemoved++;
    }
  }

  _updateHeaderLabel(type) {
    this._headers[type].label = `${TYPE_NAMES[type]} (${this._nodes[type].size})###DebugPanelHeader${type}`;
  }

  refresh() {
    const now = Date.now();
    if (this._perfEnabled) this._perf.refreshCalls++;
    if (now - this._lastPanelRefreshMs < PANEL_REFRESH_INTERVAL_MS) {
      if (this._perfEnabled) this._perf.refreshThrottle++;
      this._maybeEmitPerf(now);
      return;
    }
    this._lastPanelRefreshMs = now;

    if (!this._panel || this._panel.open === false) {
      this._suspendTracking();
      if (this._perfEnabled) this._perf.skipPanelClosed++;
      this._maybeEmitPerf(now);
      return;
    }
    if (this._panel.visible === false) {
      this._suspendTracking();
      if (this._perfEnabled) this._perf.skipPanelInvisible++;
      this._maybeEmitPerf(now);
      return;
    }
    this._resumeTracking();
    if (this._needsResync) {
      this._resyncNodes();
      if (this._perfEnabled) this._perf.resyncRuns++;
    }
    if (this._perfEnabled) this._perf.refreshOk++;

    const parts = [];
    if (this._objMgr.tickTime !== '') {
      const tickNs = this._objMgr.tickTimeNs;
      const lockNs = this._objMgr.gameLockTimeNs;

      for (const avg of this._tickAvgs) avg.update(tickNs, now);
      for (const avg of this._lockAvgs) avg.update(lockNs, now);

      const fmtAvgs = (avgs) => avgs.map(a => formatTime(a.value)).join(' / ');

      parts.push(`Tick time:      avg (1s/10s/60s): ${fmtAvgs(this._tickAvgs)} last: ${this._objMgr.tickTime}`);
      parts.push(`Game lock time: avg (1s/10s/60s): ${fmtAvgs(this._lockAvgs)} last: ${this._objMgr.gameLockTime}`);
    }
    for (let i = 0; i < TYPE_COUNT; i++) {
      const count = this._nodes[i].size;
      if (count > 0) parts.push(`${TYPE_NAMES[i]}: ${count}`);
    }
    this._summary.text = parts.length > 0 ? parts.join('\n') : 'No units';

    // Skip expensive node label churn when panel is collapsed/invisible.
    // "visible" is available on newer panel bindings; fallback to throttling.
    if (now - this._lastDetailRefreshMs < DETAIL_REFRESH_INTERVAL_MS) {
      if (this._perfEnabled) this._perf.detailThrottle++;
      this._maybeEmitPerf(now);
      return;
    }
    this._lastDetailRefreshMs = now;
    if (this._perfEnabled) this._perf.detailOk++;

    let nodeUpdates = 0;

    for (let type = 0; type < TYPE_COUNT; type++) {
      // Avoid updating TreeNode labels when the header is collapsed to
      // reduce ImGui churn (prevents screen tear when many nodes exist).
      try {
        const header = this._headers[type];
        if (!header || !header.open) {
          if (this._perfEnabled) this._perf.headerClosedSkips++;
          continue;
        }
      } catch (_) {
        if (this._perfEnabled) this._perf.headerStateReadErrors++;
      }
      for (const [id, node] of this._nodes[type]) {
        const unit = node._unit;
        node.label = this._unitLabel(unit);
        node._detail.text = this._unitDetail(unit, type);
        nodeUpdates++;
      }
    }

    if (this._perfEnabled) this._perf.detailNodeUpdates += nodeUpdates;
    this._maybeEmitPerf(now);
  }

  _unitLabel(unit) {
    return `#${unit.id} classId=${unit.classId} mode=${unit.mode} @ (${unit.posX}, ${unit.posY})###Unit${unit.type}-${unit.id}`;
  }

  _unitDetail(unit, type) {
    const lines = [];
    lines.push(`Address: 0x${unit._address.toString(16)}`);
    lines.push(`Flags: 0x${(unit.flags >>> 0).toString(16)} FlagsEx: 0x${(unit.flagsEx >>> 0).toString(16)}`);

    switch (type) {
      case UnitTypes.Player:
        if (unit.isAlive !== undefined) lines.push(`Alive: ${unit.isAlive}`);
        if (unit.isInTown !== undefined) lines.push(`InTown: ${unit.isInTown}`);
        if (unit.isRunning !== undefined) lines.push(`Running: ${unit.isRunning}`);
        break;
      case UnitTypes.Monster:
        if (unit.isAlive !== undefined) lines.push(`Alive: ${unit.isAlive}`);
        if (unit.isAttacking !== undefined) lines.push(`Attacking: ${unit.isAttacking}`);
        if (unit.isNeutral !== undefined) lines.push(`Neutral: ${unit.isNeutral}`);
        break;
      case UnitTypes.Item:
        if (unit.isOnGround !== undefined) lines.push(`OnGround: ${unit.isOnGround}`);
        if (unit.isEquipped !== undefined) lines.push(`Equipped: ${unit.isEquipped}`);
        if (unit.isInBelt !== undefined) lines.push(`InBelt: ${unit.isInBelt}`);
        break;
    }

    return lines.join('\n');
  }

  get panel() {
    return this._panel;
  }

  _totalNodeCount() {
    let total = 0;
    for (let i = 0; i < TYPE_COUNT; i++) total += this._nodes[i].size;
    return total;
  }

  _openHeaderCount() {
    let openHeaders = 0;
    for (let i = 0; i < TYPE_COUNT; i++) {
      try {
        if (this._headers[i] && this._headers[i].open) openHeaders++;
      } catch (_) {}
    }
    return openHeaders;
  }

  _ratePerSec(count, dtMs) {
    if (dtMs <= 0) return 0;
    return (count * 1000) / dtMs;
  }

  _maybeEmitPerf(now) {
    if (!this._perfEnabled) return;
    const dtMs = now - this._perfLastEmitMs;
    if (dtMs < PERF_LOG_INTERVAL_MS) return;

    const p = this._perf;
    const panelOpen = !!(this._panel && this._panel.open !== false);
    const panelVisibleKnown = !!(this._panel && this._panel.visible !== undefined);
    const panelVisible = panelVisibleKnown ? this._panel.visible !== false : true;
    const totalNodes = this._totalNodeCount();
    const openHeaders = this._openHeaderCount();

    this._logger(
      `[UnitExplorerPerf] open=${panelOpen ? 1 : 0} visible=${panelVisible ? 1 : 0} visible_known=${panelVisibleKnown ? 1 : 0}` +
      ` nodes=${totalNodes} headers_open=${openHeaders}/${TYPE_COUNT}` +
      ` refresh_call_ps=${this._ratePerSec(p.refreshCalls, dtMs).toFixed(2)}` +
      ` refresh_ok_ps=${this._ratePerSec(p.refreshOk, dtMs).toFixed(2)}` +
      ` refresh_throttle_ps=${this._ratePerSec(p.refreshThrottle, dtMs).toFixed(2)}` +
      ` skip_closed_ps=${this._ratePerSec(p.skipPanelClosed, dtMs).toFixed(2)}` +
      ` skip_invisible_ps=${this._ratePerSec(p.skipPanelInvisible, dtMs).toFixed(2)}` +
      ` detail_ok_ps=${this._ratePerSec(p.detailOk, dtMs).toFixed(2)}` +
      ` detail_throttle_ps=${this._ratePerSec(p.detailThrottle, dtMs).toFixed(2)}` +
      ` detail_node_updates_ps=${this._ratePerSec(p.detailNodeUpdates, dtMs).toFixed(2)}` +
      ` header_closed_skips_ps=${this._ratePerSec(p.headerClosedSkips, dtMs).toFixed(2)}` +
      ` header_state_err_ps=${this._ratePerSec(p.headerStateReadErrors, dtMs).toFixed(2)}` +
      ` unit_added_ps=${this._ratePerSec(p.unitAdded, dtMs).toFixed(2)}` +
      ` unit_removed_ps=${this._ratePerSec(p.unitRemoved, dtMs).toFixed(2)}` +
      ` unit_evt_skipped_ps=${this._ratePerSec(p.unitEventsSkipped, dtMs).toFixed(2)}` +
      ` resync_ps=${this._ratePerSec(p.resyncRuns, dtMs).toFixed(2)}`
    );

    this._perfLastEmitMs = now;
    p.refreshCalls = 0;
    p.refreshOk = 0;
    p.refreshThrottle = 0;
    p.skipPanelClosed = 0;
    p.skipPanelInvisible = 0;
    p.detailOk = 0;
    p.detailThrottle = 0;
    p.detailNodeUpdates = 0;
    p.headerClosedSkips = 0;
    p.headerStateReadErrors = 0;
    p.unitAdded = 0;
    p.unitRemoved = 0;
    p.unitEventsSkipped = 0;
    p.resyncRuns = 0;
  }

  _clearNodes() {
    for (let type = 0; type < TYPE_COUNT; type++) {
      for (const [, node] of this._nodes[type]) {
        try { node.destroy(); } catch (_) {}
      }
      this._nodes[type].clear();
      this._updateHeaderLabel(type);
    }
  }

  _suspendTracking() {
    if (!this._trackingActive) return;
    this._trackingActive = false;
    this._clearNodes();
    this._needsResync = true;
  }

  _resumeTracking() {
    if (this._trackingActive) return;
    this._trackingActive = true;
    this._needsResync = true;
  }

  _resyncNodes() {
    this._clearNodes();
    for (let type = 0; type < TYPE_COUNT; type++) {
      const units = this._objMgr.getUnits(type);
      if (!units) continue;
      for (const [, unit] of units) {
        this._addNode(unit, type);
      }
    }
    this._needsResync = false;
  }

  destroy() {
    this._objMgr.off('unitAdded');
    this._objMgr.off('unitRemoved');
    this._panel.destroy();
  }
}

module.exports = { DebugPanel };
