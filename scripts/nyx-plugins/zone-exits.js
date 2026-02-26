'use strict';

/**
 * Zone Exits v16
 *
 * Key fix: Instead of relying on unitAdded events (which may not fire for
 * static Object/Tile types), we now directly scan d2r.clientSideUnits and
 * d2r.serverSideUnits every few seconds — exactly how the friend's project
 * reads all units.
 *
 * Coordinate pipeline (confirmed from friend's CoordinateTransform.js):
 *   subtile (x,y)  →  gameSubtileToClientCoords  →  worldToAutomap  →  screen
 *   clientX = 16 * (sx - sy)
 *   clientY =  8 * (sx + sy)
 *
 * For Objects: position comes from staticPath.gameCoords.posX/Y (subtile coords)
 * For Tiles:   posX/posY on unit are tile coords → multiply by 5 for subtiles
 */

import { background } from 'gui';

const d2rBinding = internalBinding('d2r');

// ─── Coordinate conversion ────────────────────────────────────────────────────

function gameSubtileToClientCoords(sx, sy) {
  return {
    x: 16 * (sx - sy),
    y:  8 * (sx + sy),
  };
}

function toAutomap(clientX, clientY) {
  try {
    const p = d2rBinding.worldToAutomap(clientX, clientY);
    if (!p || p.x == null || p.y == null) return null;
    if (Math.abs(p.x) > 20000 || Math.abs(p.y) > 20000) return null;
    return p;
  } catch (e) { return null; }
}

// ─── Object entrance class IDs ────────────────────────────────────────────────

const ENTRANCE_IDS = new Set([
  59, 60, 100, 152, 176, 298, 340, 449,
  // Extra common ones
  119, 193, 194, 232, 315, 316, 399, 402,
]);

const ENTRANCE_NAMES = {
  59:  'Staircase Down',
  60:  'Staircase Up',
  100: 'Cave Entrance',
  152: 'Trapdoor',
  176: 'Trapdoor',
  193: 'Dungeon Entrance',
  194: 'Dungeon Entrance',
  232: 'Dungeon Entrance',
  298: 'Dungeon Entrance',
  315: 'Dungeon Entrance',
  316: 'Dungeon Entrance',
  340: 'Dungeon Entrance',
  399: 'Dungeon Entrance',
  402: 'Dungeon Entrance',
  449: 'Dungeon Entrance',
};

const LEVEL_NAMES = {
  1:'Rogue Encampment',2:'Blood Moor',3:'Cold Plains',4:'Stony Field',
  5:'Dark Wood',6:'Black Marsh',7:'Tamoe Highland',8:'Den of Evil',
  9:'Cave Lv1',10:'Underground Passage Lv1',11:'Hole Lv1',12:'Pit Lv1',
  13:'Cave Lv2',14:'Underground Passage Lv2',15:'Hole Lv2',16:'Pit Lv2',
  17:'Burial Grounds',18:'Crypt',19:'Mausoleum',20:'Forgotten Tower',
  21:'Tower Cellar 1',22:'Tower Cellar 2',23:'Tower Cellar 3',
  24:'Tower Cellar 4',25:'Tower Cellar 5',26:'Monastery Gate',
  27:'Outer Cloister',28:'Barracks',29:'Jail Lv1',30:'Jail Lv2',
  31:'Jail Lv3',32:'Inner Cloister',33:'Cathedral',34:'Catacombs Lv1',
  35:'Catacombs Lv2',36:'Catacombs Lv3',37:'Catacombs Lv4',
  38:'Tristram',39:'Moo Moo Farm',
  40:'Lut Gholein',41:'Rocky Waste',42:'Dry Hills',43:'Far Oasis',
  44:'Lost City',45:'Valley of Snakes',46:'Canyon of the Magi',
  47:'Sewers Lv1',48:'Sewers Lv2',49:'Sewers Lv3',
  50:'Harem Lv1',51:'Harem Lv2',52:'Palace Cellar 1',
  53:'Palace Cellar 2',54:'Palace Cellar 3',55:'Stony Tomb 1',
  56:'Halls of Dead 1',57:'Halls of Dead 2',58:'Claw Viper 1',
  59:'Stony Tomb 2',60:'Halls of Dead 3',61:'Claw Viper 2',
  62:'Maggot Lair 1',63:'Maggot Lair 2',64:'Maggot Lair 3',
  65:'Ancient Tunnels',66:"Tal Rasha's Tomb 1",67:"Tal Rasha's Tomb 2",
  68:"Tal Rasha's Tomb 3",69:"Tal Rasha's Tomb 4",
  70:"Tal Rasha's Tomb 5",71:"Tal Rasha's Tomb 6",
  72:"Tal Rasha's Tomb 7",73:"Duriel's Lair",74:'Arcane Sanctuary',
  75:'Kurast Docks',76:'Spider Forest',77:'Great Marsh',
  78:'Flayer Jungle',79:'Lower Kurast',80:'Kurast Bazaar',
  81:'Upper Kurast',82:'Kurast Causeway',83:'Travincal',
  84:'Spider Cave',85:'Spider Cavern',86:'Swampy Pit 1',
  87:'Swampy Pit 2',88:'Flayer Dungeon 1',89:'Flayer Dungeon 2',
  90:'Swampy Pit 3',91:'Flayer Dungeon 3',92:'Sewers 1',93:'Sewers 2',
  94:'Ruined Temple',95:'Disused Fane',96:'Forgotten Reliquary',
  97:'Forgotten Temple',98:'Ruined Fane',99:'Disused Reliquary',
  100:'Durance of Hate 1',101:'Durance of Hate 2',102:'Durance of Hate 3',
  103:'Pandemonium Fortress',104:'Outer Steppes',
  105:'Plains of Despair',106:'City of the Damned',
  107:'River of Flame',108:'Chaos Sanctuary',
  109:'Harrogath',110:'Bloody Foothills',111:'Frigid Highlands',
  112:'Arreat Plateau',113:'Crystalline Passage',114:'Frozen River',
  115:'Glacial Trail',116:'Drifter Cavern',117:'Frozen Tundra',
  118:"Ancients' Way",119:'Icy Cellar',120:'Arreat Summit',
  121:"Nihlathak's Temple",122:'Halls of Anguish',
  123:'Halls of Pain',124:'Halls of Vaught',
  125:'Abaddon',126:'Pit of Acheron',127:'Infernal Pit',
  128:'Worldstone Keep 1',129:'Worldstone Keep 2',
  130:'Worldstone Keep 3',131:'Throne of Destruction',
  132:'Worldstone Chamber',
};

// ─── Main class ───────────────────────────────────────────────────────────────

class ZoneExits {
  constructor(objMgr, config) {
    this._om       = objMgr;
    this._cfg      = config;
    this._cache    = new Map(); // key → { sx, sy, label }
    this._drawKeys = new Set();
    this._lastScan = 0;
    this._scanInterval = 2000; // ms between full unit scans

    console.log('[ZoneExits] v16 ready');
  }

  // ── Scan all units from d2r globals ────────────────────────────────────────

  _scanAllUnits() {
    let found = 0;

    const scan = (unitsList) => {
      if (!unitsList) return;
      try {
        unitsList.forEach((list, type) => {
          if (!list) return;
          list.forEach((id) => {
            try {
              this._tryUnit(id, type);
              found++;
            } catch (e) {}
          });
        });
      } catch (e) {}
    };

    try { scan(d2r.clientSideUnits); } catch (e) {}
    try { scan(d2r.serverSideUnits); } catch (e) {}

    return found;
  }

  _tryUnit(id, type) {
    // type 2 = Object, type 5 = Tile
    if (type !== 2 && type !== 5) return;

    // Create unit object to read properties
    let unit;
    try {
      unit = new d2r.Unit(id, type);
      if (!unit) return;
    } catch (e) { return; }

    if (type === 2) {
      this._tryObject(unit);
    } else if (type === 5) {
      this._tryTile(unit);
    }
  }

  _tryObject(unit) {
    try {
      const classId = unit.classId;
      if (!ENTRANCE_IDS.has(classId)) return;

      // Get position from staticPath.gameCoords (confirmed from friend's ObjectManager.js)
      let sx = null, sy = null;

      // Method 1: staticPath.gameCoords
      try {
        const gc = unit.staticPath?.gameCoords;
        if (gc && (gc.posX || gc.posY)) {
          sx = gc.posX; sy = gc.posY;
        }
      } catch (e) {}

      // Method 2: staticPath directly  
      if (sx == null) {
        try {
          const sp = unit.staticPath;
          if (sp && (sp.posX || sp.posY)) {
            sx = sp.posX; sy = sp.posY;
          }
        } catch (e) {}
      }

      // Method 3: posX/posY directly on unit
      if (sx == null) {
        try {
          if (unit.posX || unit.posY) {
            sx = unit.posX; sy = unit.posY;
          }
        } catch (e) {}
      }

      // Method 4: path.posX/posY
      if (sx == null) {
        try {
          const p = unit.path;
          if (p && (p.posX || p.posY)) {
            sx = p.posX; sy = p.posY;
          }
        } catch (e) {}
      }

      if (sx == null || sy == null || (sx === 0 && sy === 0)) return;

      const key = `o_${classId}_${sx}_${sy}`;
      if (this._cache.has(key)) return;

      const label = ENTRANCE_NAMES[classId] ?? 'Entrance';
      this._cache.set(key, { sx, sy, label });
      this._logEntry('OBJECT', classId, sx, sy, label);
    } catch (e) {}
  }

  _tryTile(unit) {
    try {
      // Tile classId = destination level ID
      const classId = unit.classId;
      if (!classId || classId === 0) return;

      // Tile posX/posY are in TILE coords, multiply by 5 for subtile
      let tx = null, ty = null;

      try {
        if (unit.posX != null) { tx = unit.posX; ty = unit.posY; }
      } catch (e) {}

      if (tx == null || (tx === 0 && ty === 0)) return;

      const sx = tx * 5;
      const sy = ty * 5;

      const key = `t_${classId}_${sx}_${sy}`;
      if (this._cache.has(key)) return;

      const label = LEVEL_NAMES[classId] ?? `→Level ${classId}`;
      this._cache.set(key, { sx, sy, label });
      this._logEntry('TILE', classId, sx, sy, label);
    } catch (e) {}
  }

  _logEntry(kind, classId, sx, sy, label) {
    const client = gameSubtileToClientCoords(sx, sy);
    const screen = toAutomap(client.x, client.y);
    console.log(
      `[ZoneExits] ${kind} cls=${classId} "${label}"\n` +
      `  subtile=(${sx},${sy})  client=(${client.x},${client.y})` +
      `  screen=${screen ? `(${Math.round(screen.x)},${Math.round(screen.y)}) ✓` : 'null ✗'}`
    );
  }

  // ── Called every tick from index.js ────────────────────────────────────────

  update() {
    const me = this._om.me;
    if (!me || !me.isValid) {
      this._clear();
      this._cache.clear();
      return;
    }

    // Periodically re-scan for new units
    const now = Date.now();
    if (now - this._lastScan > this._scanInterval) {
      this._lastScan = now;
      this._scanAllUnits();
    }

    if (!this._cfg.showExits || this._cache.size === 0) {
      this._clear();
      return;
    }

    // Draw all cached exits
    const dotCol = this._abgr(this._cfg.exitLineColor);
    const txtCol = 0xFF00FFFF;
    const used   = new Set();
    let i = 0;

    for (const [, w] of this._cache) {
      const dk = `ze-d-${i}`;
      const tk = `ze-t-${i}`;
      i++;

      const client = gameSubtileToClientCoords(w.sx, w.sy);
      const p      = toAutomap(client.x, client.y);
      if (!p) continue;

      used.add(dk); used.add(tk);
      background.addCircleFilled(dk, [p.x, p.y], 6, dotCol);
      background.addText(tk, [p.x - (w.label.length * 3), p.y - 16], txtCol, w.label);
    }

    for (const k of this._drawKeys) {
      if (!used.has(k)) background.remove(k);
    }
    this._drawKeys = used;
  }

  _abgr(c) {
    const r = Math.round(c.r * 255) & 0xFF;
    const g = Math.round(c.g * 255) & 0xFF;
    const b = Math.round(c.b * 255) & 0xFF;
    return ((0xFF << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }

  _clear() {
    for (const k of this._drawKeys) background.remove(k);
    this._drawKeys = new Set();
  }

  destroy() {
    this._clear();
    this._cache.clear();
  }
}

export { ZoneExits };
