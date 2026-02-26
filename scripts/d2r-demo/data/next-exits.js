'use strict';

/**
 * next-exits.js — progression-relevant exits per level.
 * Only these get lines drawn from the player; all exits still get markers.
 * Key = current level ID, value = array of progression-relevant dest level IDs.
 */
export const NEXT_EXITS = {
  2:  [8, 3],        // Blood Moor → Den of Evil, Cold Plains
  3:  [4, 17],       // Cold Plains → Stony Field, Burial Grounds
  4:  [10],          // Stony Field → Underground Passage L1
  5:  [6],           // Dark Wood → Black Marsh
  6:  [7, 20],       // Black Marsh → Tamoe Highland, Forgotten Tower
  7:  [12],          // Tamoe Highland → Pit L1
  8:  [2],           // Den of Evil → Blood Moor
  9:  [13],          // Cave L1 → Cave L2
  10: [5],           // Underground Passage L1 → Dark Wood
  11: [15],          // Hole L1 → Hole L2
  12: [16],          // Pit L1 → Pit L2
  21: [22], 22: [23], 23: [24], 24: [25],
  27: [28],          // Outer Cloister → Barracks
  28: [29],          // Barracks → Jail L1
  29: [30], 30: [31],
  31: [32],          // Jail L3 → Inner Cloister
  32: [33],          // Inner Cloister → Cathedral
  33: [34],          // Cathedral → Catacombs L1
  34: [35], 35: [36], 36: [37],
  41: [42],          // Rocky Waste → Dry Hills
  42: [43, 56],      // Dry Hills → Far Oasis, Halls of Dead L1
  43: [44, 62],      // Far Oasis → Lost City, Maggot Lair L1
  44: [45, 65],      // Lost City → Valley of Snakes, Ancient Tunnels
  45: [58],          // Valley of Snakes → Claw Viper Temple L1
  47: [48], 48: [49],
  55: [59],          // Stony Tomb L1 → L2
  56: [57],          // Halls of Dead L1 → L2
  57: [60],          // Halls of Dead L2 → L3
  58: [61],          // Claw Viper Temple L1 → L2
  62: [63], 63: [64],
  76: [85],          // Spider Forest → Spider Cavern
  78: [88],          // Flayer Jungle → Flayer Dungeon L1
  79: [80],          // Lower Kurast → Kurast Bazaar
  80: [81],          // Kurast Bazaar → Upper Kurast
  81: [82],          // Upper Kurast → Kurast Causeway
  83: [100],         // Travincal → Durance of Hate L1
  86: [87], 87: [90],
  88: [89], 89: [91],
  92: [93],
  100: [101], 101: [102],
  104: [105],        // Outer Steppes → Plains of Despair
  105: [106],        // Plains of Despair → City of the Damned
  106: [107],        // City of the Damned → River of Flame
  107: [108],        // River of Flame → Chaos Sanctuary
  113: [114],        // Crystalline Passage → Frozen River
  115: [117],        // Glacial Trail → Frozen Tundra
  118: [120],        // Ancients' Way → Arreat Summit
  122: [123], 123: [124],
  128: [129], 129: [130], 130: [131],
};
