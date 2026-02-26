'use strict';

import {
  Text, TextColored, SeparatorText, Spacing, Separator,
  Checkbox, InputInt, ColorEdit3, ColorEditFlags,
  TreeNode, TreeNodeFlags, Button, SameLine,
  background
} from 'gui';
import { UnitTypes } from 'nyx:d2r';
import { ZoneExits } from './zone-exits.js';

const memBinding = internalBinding('memory');

function rgbToABGR(c) {
  const ri = Math.round(c.r * 255) & 0xFF;
  const gi = Math.round(c.g * 255) & 0xFF;
  const bi = Math.round(c.b * 255) & 0xFF;
  return ((0xFF << 24) | (bi << 16) | (gi << 8) | ri) >>> 0;
}

function C(r, g, b) { return { r, g, b, a: 1.0 }; }

const MFLAGS = { CHAMP: 0x02, UNIQUE: 0x04, MINION: 0x08, SUPER: 0x10 };
const MARKER_TYPES = new Set([UnitTypes.Player, UnitTypes.Monster, UnitTypes.Missile]);

// ─── Markers ──────────────────────────────────────────────────────────────────

class Markers {
  constructor(objMgr, cfg) {
    this._om  = objMgr;
    this._cfg = cfg;
    this._keys = new Set();
    this._onAdd = (u, t) => this._add(u, t);
    this._onRem = (u, t) => this._rem(u, t);
    objMgr.on('unitAdded',   this._onAdd);
    objMgr.on('unitRemoved', this._onRem);
  }

  _k(t, id, s) { return `em${t}-${id}${s || ''}`; }

  _mtype(u) {
    try {
      if (u.data && u.data !== 0n) {
        const buf = memBinding.readMemory(u.data + 0x18n, 2);
        const f   = new DataView(buf.buffer, buf.byteOffset, 2).getUint16(0, true);
        if (f & MFLAGS.SUPER)  return 'super';
        if (f & MFLAGS.UNIQUE) return 'unique';
        if (f & MFLAGS.CHAMP)  return 'champ';
        if (f & MFLAGS.MINION) return 'minion';
      }
    } catch (e) {}
    return 'normal';
  }

  _mcol(mt) {
    const c = this._cfg.colors;
    switch (mt) {
      case 'super':  return c.monsterSuper;
      case 'unique': return c.monsterUnique;
      case 'champ':  return c.monsterChamp;
      case 'minion': return c.monsterMinion;
      default:       return c.monsterNormal;
    }
  }

  _mrad(mt) {
    const b = this._cfg.monsterDotSize;
    switch (mt) {
      case 'super':  return b + 3;
      case 'unique': return b + 2;
      case 'champ':  return b + 1;
      default:       return b;
    }
  }

  _add(unit, type) {
    if (!MARKER_TYPES.has(type)) return;
    const dk = this._k(type, unit.id);
    const nk = this._k(type, unit.id, 'n');
    this._keys.add(dk);
    this._keys.add(nk);

    unit.on('update', () => {
      if (!this._cfg.markersEnabled) {
        background.remove(dk); background.remove(nk); return;
      }
      if (unit.automapX < 0) {
        background.remove(dk); background.remove(nk); return;
      }
      const x = unit.automapX, y = unit.automapY;

      if (type === UnitTypes.Player) {
        const isMe  = (unit === this._om.me);
        const col   = isMe ? this._cfg.colors.playerMe : this._cfg.colors.playerParty;
        const abgr  = rgbToABGR(col);
        background.addCircleFilled(dk, [x, y], this._cfg.playerDotSize, abgr);
        if (this._cfg.showPlayerNames && !isMe) {
          background.addText(nk, [x - 10, y - this._cfg.playerDotSize - 12], abgr, `P#${unit.id}`);
        } else { background.remove(nk); }

      } else if (type === UnitTypes.Monster) {
        if (!unit.isAlive) { background.remove(dk); background.remove(nk); return; }
        const mt   = this._mtype(unit);
        const col  = this._mcol(mt);
        const abgr = rgbToABGR(col);
        background.addCircleFilled(dk, [x, y], this._mrad(mt), abgr);
        if (this._cfg.showMonsterNames && mt !== 'normal') {
          const tag = mt==='super'?'[BOSS]':mt==='unique'?'[U]':mt==='champ'?'[C]':'[M]';
          background.addText(nk, [x - 15, y - this._mrad(mt) - 12], abgr, `${tag} cls:${unit.classId}`);
        } else { background.remove(nk); }

      } else if (type === UnitTypes.Missile) {
        if (this._cfg.showMissiles) {
          background.addCircleFilled(dk, [x, y], 2, rgbToABGR(this._cfg.colors.missile));
        } else { background.remove(dk); }
        background.remove(nk);
      }
    });
  }

  _rem(unit, type) {
    if (!MARKER_TYPES.has(type)) return;
    const dk = this._k(type, unit.id);
    const nk = this._k(type, unit.id, 'n');
    this._keys.delete(dk); this._keys.delete(nk);
    background.remove(dk); background.remove(nk);
  }

  destroy() {
    this._om.off('unitAdded',   this._onAdd);
    this._om.off('unitRemoved', this._onRem);
    for (const k of this._keys) background.remove(k);
    this._keys.clear();
  }
}

// ─── Color definitions ────────────────────────────────────────────────────────

const COLOR_DEFS = [
  { label: 'Normal Monster',     key: 'monsterNormal' },
  { label: 'Minion',             key: 'monsterMinion' },
  { label: 'Champion',           key: 'monsterChamp'  },
  { label: 'Unique',             key: 'monsterUnique' },
  { label: 'Boss / Super Unique',key: 'monsterSuper'  },
  { label: 'You',                key: 'playerMe'      },
  { label: 'Party',              key: 'playerParty'   },
  { label: 'Missile',            key: 'missile'       },
];

const DEFAULT_COLORS = {
  playerMe:      C(1, 1, 0),
  playerParty:   C(0, 1, 0),
  monsterNormal: C(0.8, 0.8, 0.8),
  monsterMinion: C(0.4, 0.6, 1),
  monsterChamp:  C(0.2, 0.4, 1),
  monsterUnique: C(1, 0.8, 0),
  monsterSuper:  C(1, 0, 0),
  missile:       C(1, 1, 1),
};

// ─── Registration function ────────────────────────────────────────────────────

function registerMaphack(manager, objMgr, binding) {
  let markers   = null;
  let zoneExits = null;

  const config = {
    enabled:          false,
    revealEnabled:    true,
    // Markers
    markersEnabled:   true,
    showMonsterNames: true,
    showPlayerNames:  true,
    showMissiles:     true,
    monsterDotSize:   3,
    playerDotSize:    4,
    colors: { ...DEFAULT_COLORS },
    // Zone exits
    showExits:        true,
    exitLineColor:    C(0.0, 1.0, 0.4),
  };

  // Deep-copy colors so we don't alias DEFAULT_COLORS
  for (const k of Object.keys(DEFAULT_COLORS)) {
    config.colors[k] = { ...DEFAULT_COLORS[k] };
  }

  const colorWidgets = {};
  let legendNode  = null;
  let legendItems = [];

  function applyColors() {
    for (const def of COLOR_DEFS) {
      const ce = colorWidgets[def.key];
      if (!ce) continue;
      try {
        const wc = ce.color;
        const t  = config.colors[def.key];
        if (wc) {
          if (wc.x !== undefined) { t.r = wc.x; t.g = wc.y; t.b = wc.z; }
          else if (wc.r !== undefined) { t.r = wc.r; t.g = wc.g; t.b = wc.b; }
        }
      } catch (e) {}
    }
    const ceExit = colorWidgets['exitDot'];
    if (ceExit) {
      try {
        const wc = ceExit.color;
        const t  = config.exitLineColor;
        if (wc) {
          if (wc.x !== undefined) { t.r = wc.x; t.g = wc.y; t.b = wc.z; }
          else if (wc.r !== undefined) { t.r = wc.r; t.g = wc.g; t.b = wc.b; }
        }
      } catch (e) {}
    }
    rebuildLegend();
    console.log('[Maphack] Colors applied');
  }

  function resetColors() {
    for (const def of COLOR_DEFS) {
      const d = DEFAULT_COLORS[def.key];
      const t = config.colors[def.key];
      t.r = d.r; t.g = d.g; t.b = d.b;
      const ce = colorWidgets[def.key];
      if (ce) {
        try { ce.color = { x: d.r, y: d.g, z: d.b, w: 1 }; } catch (e) {}
        try { ce.color = { r: d.r, g: d.g, b: d.b, a: 1 }; } catch (e) {}
      }
    }
    config.exitLineColor = C(0, 1, 0.4);
    rebuildLegend();
    console.log('[Maphack] Colors reset');
  }

  function rebuildLegend() {
    if (!legendNode) return;
    for (const lw of legendItems) { try { legendNode.remove(lw); } catch (e) {} }
    legendItems = [];
    for (const def of COLOR_DEFS) {
      const c  = config.colors[def.key];
      const tw = new TextColored(`>>>  ${def.label}`, c.r, c.g, c.b, 1);
      legendNode.add(tw);
      legendItems.push(tw);
    }
    const elc = config.exitLineColor;
    const tl  = new TextColored('---  Dungeon Entrance', elc.r, elc.g, elc.b, 1);
    legendNode.add(tl);
    legendItems.push(tl);
  }

  manager.register('maphack', {
    name:             'Maphack',
    description:      '',
    enabledByDefault: true,
    defaultOpen:      true,

    onEnable() {
      config.enabled = true;
      if (!markers)   markers   = new Markers(objMgr, config);
      if (!zoneExits) zoneExits = new ZoneExits(objMgr, config);
    },

    onDisable() {
      config.enabled = false;
      if (markers)   { markers.destroy();   markers   = null; }
      if (zoneExits) { zoneExits.destroy(); zoneExits = null; }
    },

    buildUI(container) {
      // ── Map reveal ──────────────────────────────────────────────────────
      container.add(new Checkbox('Auto Reveal New Levels###mhReveal', config, 'revealEnabled'));
      container.add(new TextColored('Reveals the full automap when entering a new area.', 0.5, 0.5, 0.5, 1));

      container.add(new Spacing());

      // ── Zone Exits ───────────────────────────────────────────────────────
      const exitsNode = new TreeNode('Zone Exits###mhExitsNode', TreeNodeFlags.None);
      container.add(exitsNode);

      exitsNode.add(new Checkbox('Show Dungeon Entrances###mhExits', config, 'showExits'));

      const ceDotCol = new ColorEdit3('Entrance Color###ceExitDot', config.exitLineColor, ColorEditFlags.NoInputs);
      exitsNode.add(ceDotCol);
      colorWidgets['exitDot'] = ceDotCol;

      exitsNode.add(new Spacing());
      exitsNode.add(new TextColored(
        'Green dots on stairs/trapdoors. Check console for coordinate\n' +
        'diagnostic output when you walk near an entrance.',
        0.5, 0.5, 0.5, 1
      ));

      // ── Markers ──────────────────────────────────────────────────────────
      const markersNode = new TreeNode('Markers###mhMarkersNode', TreeNodeFlags.None);
      container.add(markersNode);

      markersNode.add(new Checkbox('Show Markers###mhMarkers',         config, 'markersEnabled'));
      markersNode.add(new Checkbox('Monster Names (special)###mhMonN', config, 'showMonsterNames'));
      markersNode.add(new Checkbox('Player Names###mhPlrN',            config, 'showPlayerNames'));
      markersNode.add(new Checkbox('Missiles###mhMissiles',            config, 'showMissiles'));

      markersNode.add(new Spacing());
      markersNode.add(new SeparatorText('Dot Sizes'));

      const inMon = new InputInt('Monster###mhMonSz', config.monsterDotSize, 1, 1);
      markersNode.add(inMon);
      inMon.on('change', () => { config.monsterDotSize = Math.max(1, Math.min(15, inMon.value)); });

      const inPlr = new InputInt('Player###mhPlrSz', config.playerDotSize, 1, 1);
      markersNode.add(inPlr);
      inPlr.on('change', () => { config.playerDotSize = Math.max(1, Math.min(15, inPlr.value)); });

      // ── Colors ───────────────────────────────────────────────────────────
      const colorsNode = new TreeNode('Colors###mhColorsNode', TreeNodeFlags.None);
      container.add(colorsNode);

      for (const def of COLOR_DEFS) {
        const ce = new ColorEdit3(`${def.label}###ce_${def.key}`, config.colors[def.key], ColorEditFlags.NoInputs);
        colorsNode.add(ce);
        colorWidgets[def.key] = ce;
      }

      colorsNode.add(new Spacing());
      const btnApply = new Button('Apply Colors###mhApply');
      colorsNode.add(btnApply);
      btnApply.on('click', applyColors);

      colorsNode.add(new SameLine());
      const btnReset = new Button('Reset Defaults###mhReset');
      colorsNode.add(btnReset);
      btnReset.on('click', resetColors);

      colorsNode.add(new Spacing());
      colorsNode.add(new TextColored('Pick colors, then click Apply.', 0.5, 0.5, 0.5, 1));

      // ── Legend ───────────────────────────────────────────────────────────
      legendNode = new TreeNode('Legend###mhLegendNode', TreeNodeFlags.None);
      container.add(legendNode);
      rebuildLegend();
    },
  });

  // Return both the config AND a getter for the live zoneExits instance.
  // index.js uses getZoneExits() to call ze.update() each tick.
  config.getZoneExits = () => zoneExits;
  return config;
}

export { registerMaphack };
