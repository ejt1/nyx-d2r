'use strict';

/**
 * poi-constants.js — POI type identifiers and class-ID lookup tables.
 */

// POI type strings used by both detection and rendering layers.
export const POI_EXIT      = 'exit';
export const POI_GOOD_EXIT = 'good_exit';  // real Tal Rasha's tomb / Tristram portal
export const POI_WAYPOINT  = 'waypoint';
export const POI_QUEST     = 'quest';
export const POI_NPC       = 'npc';

// Waypoint object classIds (from objects.txt)
export const WAYPOINT_CLASS_IDS = new Set([
  119,  // WaypointPortal
  145,  // InnerHellWaypoint
  156,  // Act2Waypoint
  157,  // Act1WildernessWaypoint
  237,  // Act3TownWaypoint
  238,  // WaypointH
  288,  // Act2CellerWaypoint
  323,  // Act2SewerWaypoint
  324,  // Act3TravincalWaypoint
  398,  // PandamoniumFortressWaypoint
  402,  // ValleyWaypoint
  429,  // ExpansionWaypoint
  494,  // WorldstoneWaypoint
  496,  // ExpansionWildernessWaypoint
  511,  // IceCaveWaypoint
  539,  // TempleWaypoint
]);

// Quest-relevant object classIds → display name
export const QUEST_OBJECT_IDS = new Map([
  [8,   'Tome'],              // Tower Tome
  [21,  'Cairn Stones'],      // StoneLambda (Tristram portal)
  [30,  'Inifuss Tree'],      // Tree of Inifuss
  [149, 'Tainted Sun Altar'], // taintedsunaltar
  [152, 'Horadric Orifice'],  // orifice (staff socket)
  [193, "Lam Esen's Tome"],   // LamTome
  [251, 'Gidbinn Altar'],     // gidbinn altar
  [376, 'Hellforge'],         // Hellforge
  [473, 'Caged Barbarians'],  // cagedwussie1
]);

// Cairn Stone object classIds (Stony Field → Tristram portal).
// Any of these presets marks the portal-to-Tristram location.
export const CAIRN_STONE_CLASS_IDS = new Set([17, 18, 19, 20, 21, 22]);

// Boss monsters to mark with a line per level.
// Key = levelId, value = Map(classId → label)
export const BOSS_MONSTERS = {
  74: new Map([[250, 'The Summoner']]),   // Arcane Sanctuary
  124: new Map([[526, 'Nihlathak']]),     // Halls of Vaught
};

// Nihlathak position flip table: the preset NPC in level 124 spawns on the
// OPPOSITE side of the map from Nihlathak. Key = "presetX,presetY"
// (level-relative subtiles), value = [nihlX, nihlY] (level-relative subtiles).
// Source: PrimeMH pois.rs
export const NIHLATHAK_FLIP = {
  '30,208':  [395, 210],   // bottom right → top left
  '206,32':  [210, 395],   // bottom left → top right
  '207,393': [210, 25],    // top right → bottom left
  '388,216': [25, 210],    // top left → bottom right
};
