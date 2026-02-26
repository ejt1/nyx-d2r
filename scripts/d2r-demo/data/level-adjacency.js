'use strict';

/**
 * level-adjacency.js — level connectivity tables.
 *
 * LEVEL_ADJACENCY: full graph of all level connections (dungeon + outdoor).
 *   Used for Tal Rasha tomb detection and general adjacency checks.
 *
 * MAP_EDGE_ADJACENCY: outdoor/stitched walk-across connections only.
 *   Used to assign destination labels to center warps that represent
 *   seamless map-edge transitions (no tile unit).
 */

// Full level adjacency: level ID → array of ALL adjacent level IDs
// (includes both outdoor walk-across and dungeon sub-level entrances).
export const LEVEL_ADJACENCY = {
  // === Act 1 ===
  1:  [2],            // Rogue Encampment → Blood Moor
  2:  [1, 3, 8],      // Blood Moor → Rogue Enc, Cold Plains, Den of Evil
  3:  [2, 4, 9, 17],  // Cold Plains → Blood Moor, Stony Field, Cave L1, Burial Grounds
  4:  [3, 5, 10, 38], // Stony Field → Cold Plains, Dark Wood, Underground Passage L1, Tristram
  5:  [4, 6],         // Dark Wood → Stony Field, Black Marsh
  6:  [5, 7, 11, 20], // Black Marsh → Dark Wood, Tamoe Highland, Hole L1, Forgotten Tower
  7:  [6, 12, 26],    // Tamoe Highland → Black Marsh, Pit L1, Monastery Gate
  8:  [2],            // Den of Evil → Blood Moor
  9:  [3, 13],        // Cave L1 → Cold Plains, Cave L2
  10: [4, 14],        // Underground Passage L1 → Stony Field, L2
  11: [6, 15],        // Hole L1 → Black Marsh, Hole L2
  12: [7, 16],        // Pit L1 → Tamoe Highland, Pit L2
  13: [9],            // Cave L2
  14: [10],           // Underground Passage L2
  15: [11],           // Hole L2
  16: [12],           // Pit L2
  17: [3, 18, 19],    // Burial Grounds → Cold Plains, Crypt, Mausoleum
  18: [17],           // Crypt
  19: [17],           // Mausoleum
  20: [6, 21],        // Forgotten Tower → Black Marsh, Tower Cellar L1
  21: [20, 22], 22: [21, 23], 23: [22, 24], 24: [23, 25], 25: [24],
  26: [7, 27],        // Monastery Gate → Tamoe Highland, Outer Cloister
  27: [26, 28],       // Outer Cloister → Monastery Gate, Barracks
  28: [27, 29],       // Barracks → Outer Cloister, Jail L1
  29: [28, 30], 30: [29, 31], 31: [30, 32],
  32: [31, 33],       // Inner Cloister → Jail L3, Cathedral
  33: [32, 34],       // Cathedral → Inner Cloister, Catacombs L1
  34: [33, 35], 35: [34, 36], 36: [35, 37], 37: [36],
  38: [4],            // Tristram

  // === Act 2 ===
  40: [41, 47, 50],   // Lut Gholein → Rocky Waste, Sewers L1, Harem L1
  41: [40, 42, 55],   // Rocky Waste → Lut Gholein, Dry Hills, Stony Tomb L1
  42: [41, 43, 56],   // Dry Hills → Rocky Waste, Far Oasis, Halls of Dead L1
  43: [42, 44, 62],   // Far Oasis → Dry Hills, Lost City, Maggot Lair L1
  44: [43, 45, 65],   // Lost City → Far Oasis, Valley of Snakes, Ancient Tunnels
  45: [44, 58],       // Valley of Snakes → Lost City, Claw Viper Temple L1
  46: [66,67,68,69,70,71,72], // Canyon of the Magi → Tal Rasha Tombs
  47: [40, 48], 48: [47, 49], 49: [48],
  50: [40, 51], 51: [50, 52],
  52: [51, 53], 53: [52, 54], 54: [53, 74],
  55: [41, 59], 56: [42, 57], 57: [56, 60],
  58: [45, 61], 59: [55], 60: [57], 61: [58],
  62: [43, 63], 63: [62, 64], 64: [63],
  65: [44],           // Ancient Tunnels
  66: [46, 73], 67: [46], 68: [46], 69: [46], 70: [46], 71: [46], 72: [46],
  73: [66],           // Duriel's Lair
  74: [54, 46],       // Arcane Sanctuary → Palace Cellar L3, Canyon of Magi

  // === Act 3 ===
  75: [76],           // Kurast Docks
  76: [75, 77, 78, 84, 85], // Spider Forest
  77: [76, 78],       // Great Marsh
  78: [76, 77, 79, 86, 88], // Flayer Jungle
  79: [78, 80, 92],   // Lower Kurast
  80: [79, 81, 94, 95, 96], // Kurast Bazaar
  81: [80, 82, 97, 98, 99], // Upper Kurast
  82: [81, 83],       // Kurast Causeway
  83: [82, 100],      // Travincal → Causeway, Durance L1
  84: [76], 85: [76], // Arachnid Lair, Spider Cavern
  86: [78, 87], 87: [86, 90], 90: [87],
  88: [78, 89], 89: [88, 91], 91: [89],
  92: [79, 93], 93: [92],
  94: [80], 95: [80], 96: [80], 97: [81], 98: [81], 99: [81],
  100: [83, 101], 101: [100, 102], 102: [101],

  // === Act 4 ===
  103: [104],         // Pandemonium Fortress
  104: [103, 105],    // Outer Steppes
  105: [104, 106],    // Plains of Despair
  106: [105, 107],    // City of the Damned
  107: [106, 108],    // River of Flame → City of Damned, Chaos Sanctuary
  108: [107],         // Chaos Sanctuary

  // === Act 5 ===
  109: [110],         // Harrogath
  110: [109, 111],    // Bloody Foothills
  111: [110, 112, 125], // Frigid Highlands → BF, Arreat Plateau, Abaddon
  112: [111, 113, 117, 126], // Arreat Plateau
  113: [112, 114, 115], // Crystalline Passage
  114: [113],         // Frozen River
  115: [113, 116, 117], // Glacial Trail
  116: [115],         // Drifter Cavern
  117: [112, 115, 118, 127], // Frozen Tundra
  118: [117, 119, 120], // Ancients' Way
  119: [118],         // Icy Cellar
  120: [118, 128],    // Arreat Summit → Ancients' Way, WSK L1
  121: [109, 122],    // Nihlathak's Temple
  122: [121, 123], 123: [122, 124], 124: [123],
  125: [111], 126: [112], 127: [117],
  128: [120, 129], 129: [128, 130], 130: [129, 131],
  131: [130, 132], 132: [131],
};

// Map-edge (walk-across) adjacency: ONLY outdoor/stitched level connections.
// Dungeon entrances are handled by tile exits (Type 5) which carry dest IDs.
// This table is used to assign destination labels to center warps that
// represent seamless map-edge transitions (no tile unit).
export const MAP_EDGE_ADJACENCY = {
  // Act 1 outdoor
  1:  [2],            // Rogue Encampment → Blood Moor
  2:  [1, 3],         // Blood Moor → Rogue Enc, Cold Plains
  3:  [2, 4, 17],     // Cold Plains → Blood Moor, Stony Field, Burial Grounds
  4:  [3, 5],         // Stony Field → Cold Plains, Dark Wood
  5:  [4, 6],         // Dark Wood → Stony Field, Black Marsh
  6:  [5, 7],         // Black Marsh → Dark Wood, Tamoe Highland
  7:  [6, 26],        // Tamoe Highland → Black Marsh, Monastery Gate
  17: [3],            // Burial Grounds → Cold Plains
  26: [7, 27],        // Monastery Gate → Tamoe Highland, Outer Cloister
  27: [26, 28],       // Outer Cloister → Monastery Gate, Barracks
  28: [27],           // Barracks → Outer Cloister
  // Act 2 outdoor
  40: [41],           // Lut Gholein → Rocky Waste
  41: [40, 42],       // Rocky Waste → Lut Gholein, Dry Hills
  42: [41, 43],       // Dry Hills → Rocky Waste, Far Oasis
  43: [42, 44],       // Far Oasis → Dry Hills, Lost City
  44: [43, 45],       // Lost City → Far Oasis, Valley of Snakes
  45: [44],           // Valley of Snakes → Lost City
  // Act 3 outdoor
  75: [76],           // Kurast Docks → Spider Forest
  76: [75, 77, 78],   // Spider Forest → Docks, Great Marsh, Flayer Jungle
  77: [76, 78],       // Great Marsh → Spider Forest, Flayer Jungle
  78: [76, 77, 79],   // Flayer Jungle → Spider Forest, Great Marsh, Lower Kurast
  79: [78, 80],       // Lower Kurast → Flayer Jungle, Kurast Bazaar
  80: [79, 81],       // Kurast Bazaar → Lower Kurast, Upper Kurast
  81: [80, 82],       // Upper Kurast → Bazaar, Causeway
  82: [81, 83],       // Kurast Causeway → Upper Kurast, Travincal
  83: [82],           // Travincal → Causeway
  // Act 4
  103: [104],         // Pandemonium Fortress → Outer Steppes
  104: [103, 105],    // Outer Steppes → Fortress, Plains of Despair
  105: [104, 106],    // Plains of Despair → Outer Steppes, City of Damned
  106: [105, 107],    // City of the Damned → Plains, River of Flame
  107: [106, 108],    // River of Flame → City of Damned, Chaos Sanctuary
  108: [107],         // Chaos Sanctuary → River of Flame
  // Act 5 outdoor
  109: [110],         // Harrogath → Bloody Foothills
  110: [109, 111],    // Bloody Foothills → Harrogath, Frigid Highlands
  111: [110, 112],    // Frigid Highlands → Bloody Foothills, Arreat Plateau
  112: [111, 113, 117], // Arreat Plateau → Frigid, Crystalline, Frozen Tundra
  113: [112, 115],    // Crystalline Passage → Arreat Plateau, Glacial Trail
  115: [113, 117],    // Glacial Trail → Crystalline, Frozen Tundra
  117: [112, 115, 118], // Frozen Tundra → Arreat, Glacial, Ancients' Way
  118: [117, 120],    // Ancients' Way → Frozen Tundra, Arreat Summit
  120: [118],         // Arreat Summit → Ancients' Way
};
