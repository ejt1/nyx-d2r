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

class DebugPanel {
  constructor(objectManager) {
    this._objMgr = objectManager;

    this._nodes = new Array(TYPE_COUNT);
    for (let i = 0; i < TYPE_COUNT; i++) {
      this._nodes[i] = new Map();
    }

    this._tickAvgs     = [new LoadAvg(1), new LoadAvg(10), new LoadAvg(60)];
    this._lockAvgs     = [new LoadAvg(1), new LoadAvg(10), new LoadAvg(60)];

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
  }

  _onUnitAdded(unit, type) {
    const node = new gui.TreeNode(this._unitLabel(unit));
    const detail = new gui.Text(this._unitDetail(unit, type));
    node.add(detail);
    node._detail = detail;
    node._unit = unit;

    this._nodes[type].set(unit.id, node);
    this._headers[type].add(node);
    this._updateHeaderLabel(type);
  }

  _onUnitRemoved(unit, type) {
    const node = this._nodes[type].get(unit.id);
    if (node) {
      node.destroy();
      this._nodes[type].delete(unit.id);
      this._updateHeaderLabel(type);
    }
  }

  _updateHeaderLabel(type) {
    this._headers[type].label = `${TYPE_NAMES[type]} (${this._nodes[type].size})###DebugPanelHeader${type}`;
  }

  refresh() {
    const parts = [];
    if (this._objMgr.tickTime !== '') {
      const now = Date.now();
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

    for (let type = 0; type < TYPE_COUNT; type++) {
      for (const [id, node] of this._nodes[type]) {
        const unit = node._unit;
        node.label = this._unitLabel(unit);
        node._detail.text = this._unitDetail(unit, type);
      }
    }
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

  destroy() {
    this._objMgr.off('unitAdded');
    this._objMgr.off('unitRemoved');
    this._panel.destroy();
  }
}

module.exports = { DebugPanel };
