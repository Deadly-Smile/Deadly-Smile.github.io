// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising survival waves, spawn selection, drops and pickups.
// Run with:
//   node src/Pages/games/FPS/engine/waves.test.js
import {
  waveConfig, createWaves, stepWaves, waveKill, pickSpawnPoint, scoreOf,
  FIRST_BREAK, WAVE_BREAK, SPAWN_INTERVAL, SAFE_SPAWN_DIST, SCORE,
} from "./waves.js";
import {
  rollDrops, stepDrops, nearDrop, takeDrop, swapPrimary, addReserve,
  DROP_TTL, RESERVE_CAP, GUN_DROP_CHANCE,
} from "./pickups.js";
import { createLoadout, WEAPONS } from "./weapons.js";
import { DIFFICULTY } from "./ai.js";
import { box, spawn } from "../maps/build.js";
import { MAPS } from "../maps/index.js";
import { STEP } from "./loop.js";

let failures = 0;
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    failures++;
    console.error(`✗ ${name}`);
    console.error("  expected:", JSON.stringify(expected));
    console.error("  actual:  ", JSON.stringify(actual));
  } else {
    console.log(`✓ ${name}`);
  }
}

// ─── Wave scaling ────────────────────────────────────────────────────────────
{
  const w = [1, 2, 5, 10, 30].map(n => waveConfig(n, "normal"));
  const increasing = (f) => w.every((c, i) => i === 0 || f(c) >= f(w[i - 1]));
  check("wave 1 is small", [w[0].count, w[0].maxAlive, w[0].hp], [3, 3, 100]);
  check("more bots each wave", increasing(c => c.count) && w[4].count > w[0].count, true);
  check("more at once, up to a cap", [increasing(c => c.maxAlive), w[4].maxAlive], [true, 7]);
  check("tougher, up to double health", [increasing(c => c.hp), w[4].hp], [true, 200]);
  check("quicker reactions, with a floor", [w[1].skill.reaction < w[0].skill.reaction, w[4].skill.reaction], [true, DIFFICULTY.normal.reaction * 0.6]);
  check("harder hitting, with a ceiling", w[4].skill.damage, DIFFICULTY.normal.damage * 1.5);
  check("wave 1 uses the base skill", w[0].skill.reaction, DIFFICULTY.normal.reaction);
  check("snipers join from wave 5", [w[1].skill.primaries.includes("sniper"), w[2].skill.primaries.includes("sniper")], [false, true]);
  check("easy stays easier than hard", waveConfig(4, "easy").skill.reaction > waveConfig(4, "hard").skill.reaction, true);
}

// ─── The wave director ───────────────────────────────────────────────────────
// Simulates a wave with a fake world: bots are just a count (kept on the
// wave state between calls); every `killEvery` seconds one of them dies.
function simulate(w, seconds, { spawnReady = () => true, killEvery = Infinity, onEvent, until } = {}) {
  let alive = w.testAlive ?? 0;
  let sinceKill = 0;
  const events = [];
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    sinceKill += STEP;
    if (alive > 0 && sinceKill >= killEvery) {
      alive--;
      sinceKill = 0;
      waveKill(w);
    }
    for (const e of stepWaves(w, { alive, spawnReady: spawnReady() }, STEP)) {
      if (e.type === "spawn") alive++;
      events.push({ ...e, t: +(i * STEP).toFixed(2), alive });
      onEvent?.(e, alive);
    }
    if (until && events.some(until)) break;
  }
  w.testAlive = alive;
  return { events, alive };
}
{
  const w = createWaves("normal");
  let r = simulate(w, FIRST_BREAK - 0.1);
  check("quiet before the first wave", r.events.length, 0);
  r = simulate(w, 0.2);
  check("wave 1 starts after the first break", r.events.map(e => e.type).slice(0, 2), ["wave", "spawn"]);

  let maxAlive = 0;
  r = simulate(w, 10, { onEvent: (e, alive) => { maxAlive = Math.max(maxAlive, alive); } });
  const spawns = r.events.filter(e => e.type === "spawn");
  check("never more alive than the wave allows", maxAlive <= w.config.maxAlive, true);
  check("spawns are spaced out", spawns.every((e, i) => i === 0 || e.t - spawns[i - 1].t >= SPAWN_INTERVAL - 1e-9), true);
  check("no clear while bots are alive", r.events.some(e => e.type === "cleared"), false);

  r = simulate(w, 30, { killEvery: 0.5, until: e => e.type === "cleared" });
  check("all killed → wave cleared", r.events.some(e => e.type === "cleared"), true);
  check("cleared count", w.cleared, 1);
  check("then a break", [w.phase, w.breakLeft > 0], ["break", true]);
  r = simulate(w, WAVE_BREAK + 0.1);
  check("wave 2 after the break", r.events.find(e => e.type === "wave")?.wave, 2);
}
{
  const w = createWaves("normal");
  simulate(w, FIRST_BREAK + 0.1);
  const r = simulate(w, 5, { spawnReady: () => false });
  check("no free spawn point → spawning waits", r.events.filter(e => e.type === "spawn").length, 0);
  const r2 = simulate(w, 2);
  check("…and resumes once one is free", r2.events.some(e => e.type === "spawn"), true);
}

// ─── Spawn points ────────────────────────────────────────────────────────────
{
  const wall = box(0, -10, 10, 1, 3);             // x -5..5 at z -10
  const spawns = [spawn(0, 0, -20), spawn(0, 0, 20), spawn(30, 0, 0), spawn(3, 0, 3)];
  const ok = new Set();
  for (let i = 0; i < 50; i++) ok.add(pickSpawnPoint(spawns, [0, 0, 0], 1.6, [wall])?.pos.join(","));
  check("only hidden and far enough", [...ok].sort(), ["0,0,-20"]);
  check("none qualify → null", pickSpawnPoint([spawn(0, 0, 20)], [0, 0, 0], 1.6, [wall]), null);
  check("distance rule", pickSpawnPoint([spawn(0, 0, -14)], [0, 0, 0], 1.6, [box(0, -10, 10, 1, 3)]), null);

  // On every real map, from every player start, at least one enemy spawn is
  // usable straight away (wave 1 can begin).
  for (const map of MAPS) {
    const usable = map.playerSpawns.every(s => pickSpawnPoint(map.enemySpawns, s.pos, 1.6, map.boxes));
    check(`${map.id}: a usable enemy spawn from every start`, usable, true);
  }
  check("safe distance constant", SAFE_SPAWN_DIST, 15);
}

// ─── Drops ───────────────────────────────────────────────────────────────────
{
  const always = () => 0;     // every roll succeeds
  const never = () => 0.999;  // every roll fails
  check("ammo always drops", rollDrops([1, 0, 1], "smg", never).map(d => d.kind), ["ammo"]);
  const lucky = rollDrops([1, 0, 1], "smg", always);
  check("sometimes the gun and a grenade too", lucky.map(d => d.kind), ["ammo", "gun", "grenade"]);
  check("the gun comes with a full magazine and one spare", [lucky[1].weapon, lucky[1].mag, lucky[1].reserve], ["smg", WEAPONS.smg.mag, WEAPONS.smg.mag]);
  check("gun drop chance", GUN_DROP_CHANCE > 0 && GUN_DROP_CHANCE < 1, true);

  let drops = rollDrops([0, 0, 0], "rifle", never);
  drops = stepDrops(drops, DROP_TTL - 1);
  check("still there before its time", drops.length, 1);
  drops = stepDrops(drops, 1.5);
  check("despawns after DROP_TTL", drops.length, 0);

  const d = rollDrops([0, 0, 0], "rifle", never)[0];
  check("walk-over range", [nearDrop(d, [1, 0, 0]), nearDrop(d, [2, 0, 0]), nearDrop(d, [0, 3, 0])], [true, false, false]);
}

// ─── Pickups ─────────────────────────────────────────────────────────────────
{
  const l = createLoadout("rifle");
  l.ammo.rifle.reserve = 0;
  l.ammo.pistol.reserve = 0;
  const ammo = { kind: "ammo" };
  check("ammo pack: a magazine for the primary and the pistol", [takeDrop(l, ammo), l.ammo.rifle.reserve, l.ammo.pistol.reserve],
    [`+${WEAPONS.rifle.mag + WEAPONS.pistol.mag} ammo`, WEAPONS.rifle.mag, WEAPONS.pistol.mag]);
  l.ammo.rifle.reserve = WEAPONS.rifle.reserve * RESERVE_CAP;
  l.ammo.pistol.reserve = WEAPONS.pistol.reserve * RESERVE_CAP;
  check("full up → the pack stays on the ground", takeDrop(l, ammo), null);
  check("reserve is capped", addReserve(l, "rifle", 999), 0);

  const g = { kind: "grenade" };
  check("grenade pickup", [takeDrop(l, g), l.ammo.grenade.mag], ["+1 grenade", 3]);
  check("grenades cap at the max", takeDrop(l, g), null);
}
{
  const l = createLoadout("rifle");
  l.ammo.rifle = { mag: 7, reserve: 20 };
  const left = swapPrimary(l, { kind: "gun", weapon: "shotgun", mag: 6, reserve: 6 }, [2, 0, 2]);
  check("swap: new primary in slot 1", [l.slots[0], l.ammo.shotgun], ["shotgun", { mag: 6, reserve: 6 }]);
  check("swap: old gun left behind with its ammo", [left.kind, left.weapon, left.mag, left.reserve, left.pos], ["gun", "rifle", 7, 20, [2, 0, 2]]);
  check("swap: the old gun's ammo is gone from the loadout", "rifle" in l.ammo, false);
  check("swap while holding it: draws the new gun", l.switching, WEAPONS.shotgun.draw);
  const same = swapPrimary(l, { kind: "gun", weapon: "shotgun", mag: 6, reserve: 6 }, [0, 0, 0]);
  check("same gun: its rounds become ammo instead", [same, l.ammo.shotgun.reserve], [null, 18]);
}

// ─── Score ───────────────────────────────────────────────────────────────────
check("score", scoreOf({ kills: 10, headshots: 3, waves: 2 }), 10 * SCORE.kill + 3 * SCORE.headshot + 2 * SCORE.wave);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll wave checks passed");
