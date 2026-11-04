import yard from "./yard.js";
import arena from "./arena.js";
import blocks from "./blocks.js";

export const MAPS = [yard, arena, blocks];

export const getMap = (id) => MAPS.find(m => m.id === id) ?? MAPS[0];
