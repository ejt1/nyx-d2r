'use strict';

/**
 * border-detector.js — finds seamless walk-across exits between outdoor levels
 * by detecting shared tile borders between Room2 bounding boxes.
 *
 * Algorithm:
 *   For each outdoor-adjacent level (from MAP_EDGE_ADJACENCY):
 *     If we have bounding-box data for that level (from room2-walker),
 *     compare its edges against the current level's bounding box.
 *     A shared edge (within tolerance) means there is a walk-across exit.
 *     The exit marker is placed at the center of the shared edge.
 *
 * @param {Object} curLevelBounds   Current level bounding box in SUBTILE coords
 *   { minX, minY, maxX, maxY }  (already multiplied by 5 from tile coords)
 * @param {Map}    adjLevelCoords   Map from level ID → { backX, backY, sizeX, sizeY }
 *   (backX/backY/sizeX/sizeY are in TILE coords, not subtile)
 * @param {number[]} mapEdgeAdjIds  Array of outdoor-adjacent level IDs
 *   (MAP_EDGE_ADJACENCY[currentLevelId] || [])
 * @returns {Array<{subX, subY, destLevelId}>}  One exit per matched border
 */
export function detectBorderExits(curLevelBounds, adjLevelCoords, mapEdgeAdjIds) {
  if (!curLevelBounds || !mapEdgeAdjIds || mapEdgeAdjIds.length === 0) return [];

  // Convert subtile bounds back to tile coords for border comparisons
  // (adjLevelCoords stores tile-space coords from Room2.tRoomCoords)
  const tMinX = curLevelBounds.minX / 5;
  const tMinY = curLevelBounds.minY / 5;
  const tMaxX = curLevelBounds.maxX / 5;
  const tMaxY = curLevelBounds.maxY / 5;

  const TOL = 2; // tolerance in tiles for border alignment
  const exits = [];

  for (const adjId of mapEdgeAdjIds) {
    const coords = adjLevelCoords.get(adjId);
    if (!coords) continue;

    const aBX = coords.backX;
    const aBY = coords.backY;
    const aEX = aBX + coords.sizeX;
    const aEY = aBY + coords.sizeY;

    let exitSubX = 0, exitSubY = 0;
    let found = false;

    // East border: adj starts where current ends in X
    if (Math.abs(aBX - tMaxX) <= TOL) {
      const oMinY = Math.max(aBY, tMinY);
      const oMaxY = Math.min(aEY, tMaxY);
      if (oMinY < oMaxY) {
        exitSubX = tMaxX * 5;
        exitSubY = Math.round((oMinY + oMaxY) / 2) * 5;
        found = true;
      }
    }
    // West border: adj ends where current starts in X
    if (!found && Math.abs(aEX - tMinX) <= TOL) {
      const oMinY = Math.max(aBY, tMinY);
      const oMaxY = Math.min(aEY, tMaxY);
      if (oMinY < oMaxY) {
        exitSubX = tMinX * 5;
        exitSubY = Math.round((oMinY + oMaxY) / 2) * 5;
        found = true;
      }
    }
    // South border: adj starts where current ends in Y
    if (!found && Math.abs(aBY - tMaxY) <= TOL) {
      const oMinX = Math.max(aBX, tMinX);
      const oMaxX = Math.min(aEX, tMaxX);
      if (oMinX < oMaxX) {
        exitSubX = Math.round((oMinX + oMaxX) / 2) * 5;
        exitSubY = tMaxY * 5;
        found = true;
      }
    }
    // North border: adj ends where current starts in Y
    if (!found && Math.abs(aEY - tMinY) <= TOL) {
      const oMinX = Math.max(aBX, tMinX);
      const oMaxX = Math.min(aEX, tMaxX);
      if (oMinX < oMaxX) {
        exitSubX = Math.round((oMinX + oMaxX) / 2) * 5;
        exitSubY = tMinY * 5;
        found = true;
      }
    }

    if (found) {
      exits.push({ subX: exitSubX, subY: exitSubY, destLevelId: adjId });
    }
  }

  return exits;
}
