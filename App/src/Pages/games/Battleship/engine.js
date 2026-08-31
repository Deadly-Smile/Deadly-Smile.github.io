// ─── Battleship grid/ship logic ──────────────────────────────────────────────
// Pure functions, no React/PeerJS. A player's "fleet" is just an array of
// ships (each `{ len, cells: [{x,y}], hitCells: number[] }`) plus the board
// size it was built for. Nothing here ever needs to cross the wire — only
// fire coordinates and their hit/miss/sunk results do (see Battleship.jsx).

export const MIN_BOARD_SIZE = 6;
export const MAX_BOARD_SIZE = 12;
export const DEFAULT_BOARD_SIZE = 10;
export const MIN_SHIP_LEN = 2;
export const MAX_SHIP_LEN = 6;
export const MIN_SHIP_COUNT = 1;
export const MAX_SHIP_COUNT = 8;

// Sane defaults per board size — the classic 10x10/5-ship fleet, scaled down
// or up. Editable from there within the limits above.
const DEFAULT_FLEETS = {
  6: [2, 2, 3],
  7: [2, 2, 3, 3],
  8: [2, 3, 3, 4],
  9: [2, 3, 3, 4, 4],
  10: [2, 3, 3, 4, 5],
  11: [2, 2, 3, 3, 4, 5],
  12: [2, 2, 3, 3, 4, 4, 5],
};

export function defaultFleetFor(boardSize) {
  return DEFAULT_FLEETS[boardSize] || DEFAULT_FLEETS[DEFAULT_BOARD_SIZE];
}

export function clampBoardSize(n) {
  return Math.min(MAX_BOARD_SIZE, Math.max(MIN_BOARD_SIZE, Math.round(n)));
}

export function clampShipLen(n, boardSize) {
  return Math.min(Math.min(MAX_SHIP_LEN, boardSize), Math.max(MIN_SHIP_LEN, Math.round(n)));
}

export function cellsFor(x, y, len, horizontal) {
  return Array.from({ length: len }, (_, i) => (horizontal ? { x: x + i, y } : { x, y: y + i }));
}

function inBounds(cell, boardSize) {
  return cell.x >= 0 && cell.x < boardSize && cell.y >= 0 && cell.y < boardSize;
}

// Ships may not touch, even diagonally — keeps placement visually
// unambiguous and matches the common "no adjacent ships" house rule.
function isFree(cells, placedShips, boardSize) {
  for (const cell of cells) {
    if (!inBounds(cell, boardSize)) return false;
    for (const ship of placedShips) {
      for (const c of ship.cells) {
        if (Math.abs(c.x - cell.x) <= 1 && Math.abs(c.y - cell.y) <= 1) return false;
      }
    }
  }
  return true;
}

export function canPlaceShip(x, y, len, horizontal, placedShips, boardSize) {
  return isFree(cellsFor(x, y, len, horizontal), placedShips, boardSize);
}

export function placeShip(x, y, len, horizontal, placedShips, boardSize) {
  const cells = cellsFor(x, y, len, horizontal);
  if (!isFree(cells, placedShips, boardSize)) return null;
  return { len, cells, hitCells: [] };
}

// Randomly places every ship in `fleetLens`, retrying the whole layout on a
// rare dead-end (a dense board can greedy-paint itself into a corner).
export function randomizeFleet(fleetLens, boardSize, maxAttempts = 200) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ships = [];
    let ok = true;
    for (const len of fleetLens) {
      let placed = null;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const horizontal = Math.random() < 0.5;
        const maxX = horizontal ? boardSize - len : boardSize - 1;
        const maxY = horizontal ? boardSize - 1 : boardSize - len;
        if (maxX < 0 || maxY < 0) break; // ship literally doesn't fit this board
        const x = Math.floor(Math.random() * (maxX + 1));
        const y = Math.floor(Math.random() * (maxY + 1));
        placed = placeShip(x, y, len, horizontal, ships, boardSize);
      }
      if (!placed) { ok = false; break; }
      ships.push(placed);
    }
    if (ok) return ships;
  }
  return null; // caller falls back to "couldn't auto-place — try Reset then Random again" / smaller fleet
}

// Fires at (x,y) against the defender's own fleet. Pure — returns a new
// ships array rather than mutating, so it's safe to feed straight into
// React state.
export function fireAt(ships, x, y) {
  let hitShipIdx = -1;
  const nextShips = ships.map((ship, i) => {
    const hitIdx = ship.cells.findIndex(c => c.x === x && c.y === y);
    if (hitIdx === -1 || ship.hitCells.includes(hitIdx)) return ship;
    hitShipIdx = i;
    return { ...ship, hitCells: [...ship.hitCells, hitIdx] };
  });
  const hit = hitShipIdx !== -1;
  const sunk = hit && nextShips[hitShipIdx].hitCells.length === nextShips[hitShipIdx].len;
  const gameOver = hit && nextShips.every(s => s.hitCells.length === s.len);
  return { ships: nextShips, hit, sunk, shipLen: sunk ? nextShips[hitShipIdx].len : undefined, gameOver };
}

export function totalFleetCells(fleetLens) {
  return fleetLens.reduce((a, b) => a + b, 0);
}

// A rough feasibility check for the config editor — not exact (the
// no-touching rule packs tighter than raw area), just enough to warn against
// a wildly over-stuffed board before someone wastes time on placement.
export function fleetFitsBoard(fleetLens, boardSize) {
  return totalFleetCells(fleetLens) <= Math.floor(boardSize * boardSize * 0.5);
}
