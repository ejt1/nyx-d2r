'use strict';

import {
  Panel, Text, TextColored, Separator, SeparatorText,
  Checkbox, Spacing, CollapsingHeader, TreeNode, TreeNodeFlags, WindowFlags
} from 'gui';

// ─── Unit Explorer ────────────────────────────────────────────────────────────
// Restored from the original debug-panel.js.
// Lives as a collapsing section at the bottom of the plugin manager.
// Shows live unit counts + expandable tree nodes for every unit in memory.
// Also exposes a live "selected unit" dump which zone-exits.js uses for
// coordinate debugging.

const TYPE_NAMES = ['Players', 'Monsters', 'Objects', 'Missiles', 'Items', 'Tiles'];
const TYPE_COUNT = TYPE_NAMES.length;

class UnitExplorer {
  constructor(objMgr, parentContainer) {
    this._om    = objMgr;
    this._nodes = Array.from({ length: TYPE_COUNT }, () => new Map());

    // Root collapsing header inside the plugin panel
    this._root = new CollapsingHeader('Unit Explorer###UnitExplorer', TreeNodeFlags.None);
    parentContainer.add(this._root);

    // Summary line — tick timing + per-type counts
    this._summary = new Text('Waiting...');
    this._root.add(this._summary);

    // One sub-header per unit type
    this._headers = Array.from({ length: TYPE_COUNT }, (_, i) => {
      const h = new CollapsingHeader(
        `${TYPE_NAMES[i]} (0)###UEHeader${i}`,
        TreeNodeFlags.None
      );
      this._root.add(h);
      return h;
    });

    // Listen for units
    this._onAdded   = (u, t) => this._unitAdded(u, t);
    this._onRemoved = (u, t) => this._unitRemoved(u, t);
    objMgr.on('unitAdded',   this._onAdded);
    objMgr.on('unitRemoved', this._onRemoved);
  }

  _unitAdded(unit, type) {
    if (type >= TYPE_COUNT) return;

    const node   = new TreeNode(this._unitLabel(unit), TreeNodeFlags.None);
    const detail = new Text(this._unitDetail(unit, type));
    node.add(detail);
    node._detail = detail;
    node._unit   = unit;

    this._nodes[type].set(unit.id, node);
    this._headers[type].add(node);
    this._updateHeader(type);
  }

  _unitRemoved(unit, type) {
    if (type >= TYPE_COUNT) return;
    const node = this._nodes[type].get(unit.id);
    if (node) {
      node.destroy();
      this._nodes[type].delete(unit.id);
      this._updateHeader(type);
    }
  }

  _updateHeader(type) {
    const n = this._nodes[type].size;
    this._headers[type].label = `${TYPE_NAMES[type]} (${n})###UEHeader${type}`;
  }

  _unitLabel(unit) {
    // ###-suffix makes imgui use a stable ID so the node doesn't collapse on
    // every label refresh
    return `#${unit.id}  cls=${unit.classId}  mode=${unit.mode}  (${unit.posX??'?'}, ${unit.posY??'?'})###UEUnit${unit.type??0}-${unit.id}`;
  }

  _unitDetail(unit, type) {
    const lines = [];

    // Address + flags always shown
    if (unit._address !== undefined)
      lines.push(`Addr  : 0x${unit._address.toString(16)}`);
    if (unit.flags !== undefined)
      lines.push(`Flags : 0x${(unit.flags >>> 0).toString(16)}  FlagsEx: 0x${(unit.flagsEx >>> 0).toString(16)}`);

    // Position — show both posX/Y (unit model) and raw path offsets if available
    lines.push(`Pos   : (${unit.posX??'?'}, ${unit.posY??'?'})`);

    // Type-specific fields
    if (unit.isAlive    !== undefined) lines.push(`Alive    : ${unit.isAlive}`);
    if (unit.isInTown   !== undefined) lines.push(`InTown   : ${unit.isInTown}`);
    if (unit.isNeutral  !== undefined) lines.push(`Neutral  : ${unit.isNeutral}`);
    if (unit.isOnGround !== undefined) lines.push(`OnGround : ${unit.isOnGround}`);
    if (unit.isEquipped !== undefined) lines.push(`Equipped : ${unit.isEquipped}`);
    if (unit.isInBelt   !== undefined) lines.push(`InBelt   : ${unit.isInBelt}`);

    // For Objects (type 2) and Tiles (type 5) — show automap coords
    // These are the two types ZoneExits cares about
    if (type === 2 || type === 5) {
      if (unit.automapX !== undefined)
        lines.push(`AutomapXY: (${unit.automapX}, ${unit.automapY})`);
    }

    return lines.join('\n');
  }

  // Called every tick from the main loop to refresh labels + summary
  refresh(objMgr) {
    const parts = [];
    if (objMgr.tickTime && objMgr.tickTime !== '') {
      parts.push(`Tick: ${objMgr.tickTime}  |  Lock: ${objMgr.gameLockTime}`);
    }
    const me = objMgr.me;
    if (me) {
      parts.push(`You: (${me.posX}, ${me.posY})`);
    }
    // Per-type counts inline
    const counts = this._nodes.map((m, i) => `${TYPE_NAMES[i]}:${m.size}`).join('  ');
    parts.push(counts);
    this._summary.text = parts.join('\n');

    // Refresh each node's label and detail
    for (let type = 0; type < TYPE_COUNT; type++) {
      for (const [, node] of this._nodes[type]) {
        node.label        = this._unitLabel(node._unit);
        node._detail.text = this._unitDetail(node._unit, type);
      }
    }
  }

  destroy() {
    this._om.off('unitAdded',   this._onAdded);
    this._om.off('unitRemoved', this._onRemoved);
    this._root.destroy();
  }
}

// ─── Plugin Manager ───────────────────────────────────────────────────────────

class PluginManager {
  constructor() {
    this._plugins     = new Map();
    this._explorer    = null;   // created after plugins register, lazily
    this._panel       = new Panel('Plugin Manager###NyxPluginManager', WindowFlags.None);

    this._headerText  = new TextColored('D2R Plugin Manager', 0.4, 0.8, 1.0, 1.0);
    this._panel.add(this._headerText);

    this._statusText  = new Text('Plugins: 0');
    this._panel.add(this._statusText);

    this._panel.add(new Separator());
  }

  register(id, opts) {
    if (this._plugins.has(id)) return;

    const plugin = {
      id,
      name:        opts.name        || id,
      description: opts.description || '',
      onEnable:    opts.onEnable    || (() => {}),
      onDisable:   opts.onDisable   || (() => {}),
      buildUI:     opts.buildUI     || (() => {}),
      state:       { enabled: opts.enabledByDefault === true },
    };

    const header = new CollapsingHeader(
      `${plugin.name}###PluginHeader_${id}`,
      opts.defaultOpen ? TreeNodeFlags.DefaultOpen : TreeNodeFlags.None
    );
    this._panel.add(header);

    const checkbox = new Checkbox(`Enable###PluginEnable_${id}`, plugin.state, 'enabled');
    header.add(checkbox);
    checkbox.on('change', () => {
      if (plugin.state.enabled) {
        try { plugin.onEnable(); } catch (e) { console.error(`[${plugin.name}] onEnable: ${e.message}`); }
      } else {
        try { plugin.onDisable(); } catch (e) { console.error(`[${plugin.name}] onDisable: ${e.message}`); }
      }
      this._updateStatus();
    });

    if (plugin.description) {
      header.add(new TextColored(plugin.description, 0.6, 0.6, 0.6, 1.0));
    }

    header.add(new Spacing());

    try {
      plugin.buildUI(header);
    } catch (e) {
      header.add(new TextColored(`UI Error: ${e.message}`, 1.0, 0.3, 0.3, 1.0));
      console.error(`[${plugin.name}] buildUI: ${e.message}`);
    }

    this._plugins.set(id, plugin);
    this._updateStatus();

    if (plugin.state.enabled) {
      try { plugin.onEnable(); } catch (e) { console.error(`[${plugin.name}] onEnable: ${e.message}`); }
    }

    return plugin;
  }

  // ── Unit Explorer ─────────────────────────────────────────────
  // Call this once after all plugins have registered, passing objMgr.
  // Adds the Unit Explorer section at the bottom of the panel.
  attachUnitExplorer(objMgr) {
    this._panel.add(new Separator());
    this._explorer = new UnitExplorer(objMgr, this._panel);
    this._objMgr   = objMgr;
  }

  // Call every tick from main loop — refreshes Unit Explorer labels
  tick() {
    if (this._explorer && this._objMgr) {
      this._explorer.refresh(this._objMgr);
    }
  }

  isEnabled(id) {
    const p = this._plugins.get(id);
    return p ? p.state.enabled : false;
  }

  get panel() { return this._panel; }

  _updateStatus() {
    let active = 0;
    for (const [, p] of this._plugins) if (p.state.enabled) active++;
    this._statusText.text = `Plugins: ${this._plugins.size} | Active: ${active}`;
  }

  destroy() {
    for (const [, p] of this._plugins) {
      if (p.state.enabled) try { p.onDisable(); } catch (e) {}
    }
    if (this._explorer) this._explorer.destroy();
    this._panel.destroy();
  }
}

export { PluginManager };
