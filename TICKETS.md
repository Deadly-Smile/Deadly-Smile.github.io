# FPS game: tickets

Source: TASK.md ("First Player Shooting"). Feasibility study: 2026-11-05.

## Decisions
- Lives in this repo under `App/src/Pages/games/FPS/`, lazy-loaded.
- Single-player: survival waves.
- Multiplayer: Team Deathmatch, host-authoritative P2P (PeerJS), bots fill empty slots, max 8 players including bots.
- Comms: text chat only (team / all). No voice.
- Loadout: 4 slots: 1 = primary (SMG / AR / sniper / shotgun), 2 = handgun, 3 = knife (always), 4 = grenades (limited). Guns dropped by enemies can be picked up.
- Desktop only in v1 (pointer lock + keyboard). Touch devices see a "desktop required" message.
- Rendering: plain `three` (pinned version), no react-three-fiber, no physics library (box maps, custom collision + raycasts).
- No downloaded assets: primitive meshes, Web Audio synthesised sounds (like `Poker/sounds.js`), original map designs.

## Ground rules (apply to every ticket)
- **Isolation:** FPS code imports nothing from the rest of the app except the networking helpers in `src/Pages/tools/tk-shared.jsx` and `src/Utils/usePersistentState.js`. Its one hook into the app is the `GAMES` entry in `Games.jsx`. This keeps a later move to its own repo cheap.
- **Pure vs render:** game rules live in `engine/` and `net/protocol.js` with no three.js or DOM imports, so they can be tested in Node. Rendering lives in `render/`.
- **Game loop outside React:** React draws only the HUD and menus, updated through refs or at a throttled rate, never re-rendered every frame.
- **Tests:** plain Node `*.test.js` scripts with a `check()` helper, like the existing ones. Imports between pure modules use the `.js` extension.
- **Verification per ticket:** `cd App && npm run lint && npm run build`, run the new test scripts, and play by hand in `npm run dev`.

## Folder layout
```
App/src/Pages/games/FPS/
  FPS.jsx            shell: menus, HUD, canvas mount (lazy-loaded)
  engine/            pure: world, collision, player, weapons, damage, ai, waves, pickups
  maps/              map data (boxes, spawns, hidden enemy spawns, waypoints)
  render/            three.js scene, view model, effects
  net/               protocol.js (pure), room.js (PeerJS)
  sounds.js
  *.test.js
```

---

## Phase 1: Single-player

### FPS-1: Scaffold and lazy loading
**Depends on:** none

- Add `three` to `App/package.json`, pinned to an exact version.
- In `Games.jsx`, add the `fps` entry to `GAMES` and load the component with `React.lazy(() => import("./games/FPS/FPS"))` inside `<Suspense>` with a loading fallback.
- `FPS.jsx` mounts a WebGL canvas and runs a fixed-timestep loop (simulation at e.g. 60 Hz, rendering on `requestAnimationFrame`). The loop pauses when the tab is hidden.
- Full teardown on unmount: stop the loop, remove listeners, dispose geometries, materials and textures, call `renderer.dispose()` and `renderer.forceContextLoss()`.
- Detect touch-only devices and show a "desktop required" message instead of starting the game.
- Show a clear error when WebGL is unavailable.

**Acceptance**
- `npm run build` outputs a separate chunk for FPS/three. Opening `/games` or other games doesn't download it (check the Network tab).
- Opening and leaving the game 10+ times gives no "too many WebGL contexts" warnings and no growth in memory.

### FPS-2: Map format and maps
**Depends on:** FPS-1

- Map data format: axis-aligned boxes (position, size, colour/material), player spawn points, hidden enemy spawn points, team spawns, map bounds.
- Waypoint graph: **generated from the boxes at load time** (1 m nav grid, `engine/nav.js`) instead of hand-placed, so it can't drift from the geometry. Cover nodes are detected automatically.
- Two to three original maps of simple structures and obstacles: for example a warehouse yard, a small town block, and an arena with ramps and cover.
- `render/` builds the scene from map data (instanced or merged boxes, simple lighting, no real-time shadows by default).
- A pure validator: spawns aren't inside boxes or floating, every spawn can be walked to, enemy spawns can't be seen from any player spawn.

**Acceptance:** each map renders, and `maps.test.js` passes the validator for every map.

### FPS-3: Movement and collision
**Depends on:** FPS-2

- Pointer lock on click, mouse look with a sensitivity setting, Esc releases the lock and pauses the game.
- Hide the `← Back` button in `Games.jsx` while the pointer is locked (or while playing).
- WASD, sprint (Shift), jump with gravity, optional crouch (Ctrl/C).
- Capsule-vs-box collision with sliding along walls, stepping onto low ledges, landing on boxes.
- Raycast helper against boxes (used later for shooting and line of sight).
- Arrow keys look around (←/→ turn, ↑/↓ pitch) with their own turn-speed setting: laptop touchpads are usually silenced while a key is held, so mouse look alone fails while moving.

**Acceptance:** you can't pass through walls or fall through floors, you can jump onto low cover, and `collision.test.js` covers sliding, landing and raycasts.

### FPS-4: Weapons core
**Depends on:** FPS-3

- A data table for every weapon: damage, fire rate, magazine size, reserve, reload time, spread, recoil, range/falloff, pellets, automatic or not.
  - Primaries: SMG, assault rifle, sniper rifle, shotgun.
  - Handgun, knife, grenade.
- Use generic weapon names, not real brand or model names.
- Hitscan firing with spread and recoil. The shotgun fires several pellets. The sniper has a scope (FOV zoom plus overlay).
- Aim down sights with right-click (less spread, lower FOV).
- Magazine plus reserve ammo, reload (R, and automatically when the magazine is empty), you can't fire while reloading.
- Slot switching with 1–4 and the scroll wheel, with a short switch delay.
- Simple first-person weapon model made of boxes, muzzle flash, bullet-hole decals.
- Also done here: grenade flight (arc, bounces, fuse, explosion effect) and the knife swing, so slots 3–4 do something. **Damage from all weapons is FPS-5** (nothing to hit yet).

**Acceptance:** all values come from the table, and `weapons.test.js` covers fire-rate gating, ammo bookkeeping, reloads and switching.

### FPS-5: Health and damage
**Depends on:** FPS-4

- HP (100). Damage falls off with distance. Headshots get a multiplier (head hitbox separate from the body).
- Auto-heal: after N seconds without taking damage, regenerate at a set rate up to max HP.
- Death, then respawn (single-player: the wave run ends; respawn is used in multiplayer).
- Grenade: thrown with an arc, bounces off boxes, fuse timer, damage within a radius that falls off with distance, blocked by walls (line-of-sight check).
- Knife: short-range melee, quick attack, high damage from behind (optional).
- Also done here: **training dummies** (static targets at walkable spots in view of the start, respawning after death) so damage can be played with before FPS-6's bots; they share the actor/health/hitbox code bots will use. The **hit marker** (white hit / yellow headshot / red kill) and the hurt flash moved up from FPS-8, since damage can't be judged without them.

**Acceptance:** `damage.test.js` covers falloff, headshots, regen timing, the grenade radius and line-of-sight blocking.

### FPS-6: AI enemies
**Depends on:** FPS-2, FPS-5

- State machine: idle/patrol → alert (heard a shot or saw a target) → chase/attack → search (lost sight) → patrol.
- Line of sight with a view cone and range. Hearing radius for gunshots.
- Pathfinding with A* over the map's waypoint graph, then steering towards the next node.
- Uses cover: prefers waypoints marked as cover while attacking (simple).
- Difficulty settings: reaction time, accuracy spread, damage.
- **Team-aware from the start:** every unit has a `team`; AI picks the nearest visible enemy of another team, never a hardcoded "player". Multiplayer (FPS-11) depends on this.
- AI fires the same weapons from the FPS-4 table.
- As built: the training dummies are gone; 4 bots start at hidden enemy spawns and respawn there (out of the player's sight, ≥ 15 m away) until FPS-7's waves take over. Bot difficulty (easy/normal/hard: reaction, aim error and sway, turn speed, damage, weapon mix; snipers only on hard) is picked in the menu now rather than in FPS-8. Bot headshots are capped at 1.5×. The player respawns at the safest spawn (any player/team spawn no bot can see, farthest from bots) with 2 s of spawn protection; single-player respawning itself goes away in FPS-7 (death ends the run).

**Acceptance:** bots patrol, notice you, chase, shoot and search after losing sight. `ai.test.js` covers state transitions and A*.

### FPS-7: Survival waves and drops
**Depends on:** FPS-6

- Wave system: enemy count, health, accuracy and weapons scale up each wave. Short break between waves.
- Enemies spawn only at hidden spawn points that are **out of the player's view** and at least a minimum distance away. If none qualifies, the spawn waits.
- Cap on enemies alive at once (performance).
- Drops on kill: an ammo pack always or most of the time, sometimes the enemy's gun. Drops despawn after a while.
- Pickups: walk over ammo to pick it up. Press E to swap guns.
- Score (kills, headshots, waves survived). Best score per map saved with `usePersistentState` (`game:fps:best`).
- As built: death ends the run (no more respawning or spawn protection) and shows a game-over screen with the stats, best score, Play again and Quit; the menu shows the map's best. New bots come looking for the player as soon as they spawn. Ammo packs top up the primary and pistol by a magazine each (reserve capped at 2× the starting reserve); a dropped gun comes with a full magazine plus one spare, and swapping leaves the old primary (with its ammo) on the ground.

**Acceptance:** nothing spawns in view, and drops can be picked up. `waves.test.js` covers scaling, spawn-point selection and drop rules.

### FPS-8: HUD, menus, sound and polish
**Depends on:** FPS-4 to FPS-7

- HUD: crosshair (spreads with movement and firing), HP, ammo (magazine / reserve), grenade count, current wave and enemies left, kill feed, hit markers, damage-direction indicator, low-HP vignette.
- Menus: main menu (map, difficulty, primary choice), pause menu, game-over screen with stats.
- Settings via `usePersistentState`: sensitivity, FOV, quality (resolution scale, effects), volume, invert Y.
- Synthesised sound effects for each weapon, reload, footsteps, hits, explosions and pickups.
- Performance pass: target 60 fps on a mid-range laptop. Check draw calls and garbage created each frame.

**Acceptance:** a complete single-player run plays from menu to game over without errors.

#### FPS-8b: Graphics settings and performance (done 2026-11-06)
- **Graphics: Low / Medium / High** (`engine/quality.js`, tested), in the main menu and the pause menu. It controls:
  - **Render scale:** Low draws at 0.6×.
  - **Device pixel ratio cap:** 1× on Low and Medium, 2× on High. On a 2× laptop screen, High draws 4× the pixels of Medium, which was by far the biggest cost in measurements.
  - **Anti-aliasing:** off on Low. It's fixed when the game opens, and the menu says so.
  - **Lighting:** Lambert on Low and Medium, physically based on High. The flat-coloured boxes look the same either way.
  - **Muzzle and explosion flash lights:** off on Low.
  - **View distance and fog:** 60 / 140 / 400 m.
  - **Character models:** box figures on Low, chosen per run.
- **Frame limit:** 30 / 60 / unlimited, 60 by default. The menu, pause and game-over screens are capped at 30. Skipped frames let time build up, so the simulation stays real-time (tested in `loop.test.js`).
- **"Show performance":** an fps, frame time, draw calls, triangles and resolution readout.
- **Measured (software renderer, 800×450 at 2× DPR):** Low 15 fps, Medium 8, High 2. Draw calls are about 11 and triangles about 3–4k without characters, so pixel count dominates.

#### FPS-8a: Character and weapon models (added 2026-11-06)
Replace the box figures and box guns with open-source models. This overrides the original "no downloaded assets" decision, at the user's request.

- **Assets** (all from Poly Pizza; authors and licences in `App/public/fps/models/CREDITS.md`):
  - **SWAT** by Quaternius (CC0) for the bots.
  - **Soldier** by Quaternius (**CC BY 3.0**, so attribution is required; it's shown in the game's menu) for the player and the player's team.
  - Both share one 62-bone rig and its clips: idle with a gun, idle shooting, walk, run, run backwards, run left/right, run shooting, hit reaction and death. There is no crouch clip.
  - Weapons, all CC0: Quaternius's realistic low-poly Assault Rifle, Submachine Gun, Sniper Rifle, Shotgun, Pistol and Knife, plus CreativeTrio's Hand Grenade.
  - A first attempt with Quaternius's cartoon *Toon Shooter* kit was dropped as "too goofy". The user also asked about CS:GO models; that was declined, because those are Valve's copyrighted assets, the site is served publicly, and the game shouldn't look like CS:GO.
- **Pipeline:**
  - `App/scripts/fps-models/optimize.mjs` keeps and renames the clips the game uses, then prunes, dedups and meshopt-compresses each model. The README lists exact download links.
  - Total size is about 1.3 MB (characters about 0.55 MB each, weapons 12–55 KB each).
  - The models are fetched only when the game is opened.
- **Loading:**
  - GLTFLoader + MeshoptDecoder.
  - Play shows "Loading models…" until the models are ready.
  - If loading fails, the game falls back to the box figures and guns.
- **Characters (`render/characters.js`):**
  - Each actor gets a skeleton clone with its own animation mixer and materials.
  - The pure `engine/anim.js` (tested) chooses the clip: strafes by movement direction relative to facing, Run_Shoot for armed running, Walk, Idle or Idle_Shoot, HitReact, and Death played once.
  - **Crouching** has no clip: the body is lowered and each leg solves two-bone IK so the knees bend forward over the planted feet. The rig's feet hang off the root. Crouch-walking uses the walk clip.
  - **The weapon follows the hand's position but points along the aim.** Some clips are unarmed and swing the wrists. In swinging-arm clips it's held at the chest instead.
  - The chest leans with the aim pitch, and the gun is hidden on death.
- **Hitboxes follow the realistic proportions:** the head runs from 81% of the height to the top and is 0.26 m wide; the body is 0.52 m wide. Bots aim at mid-chest.
- **First person, drops and grenades:** first-person weapons, dropped guns and grenades (in hand, thrown and dropped) use the weapon models, levelled with barrel forward and the sight line at the top edge.
- **Death camera:** pulls out to a third-person view of the player's own Soldier body.

**Acceptance:** bots and the dead player's body are animated soldiers holding the right gun; first-person, dropped and thrown weapons use the models; hitboxes match the visible head and body; the game still works (box fallback) if the models fail to load; the models download only when the game opens; the CC BY attribution is shown.

---

## Phase 2: Multiplayer (Team Deathmatch)

### FPS-9: Netcode foundation
**Depends on:** FPS-3. FPS-8 must be done before release.

- `net/room.js`: PeerJS host/join in a star around the host, max 8 players. Reuse `getIceServers` and `generateRoomId` from `tk-shared.jsx` and follow the shape of `Poker/multiplayer.js`.
- Two data channels per guest: unreliable/unordered for snapshots (verify how PeerJS 1.5 handles `reliable: false`), reliable for events (join/leave, kills, chat).
- `net/protocol.js` (pure): compact snapshot encode/decode (quantised positions and angles, entity ids), sequence numbers, sending only what changed.
- Host simulates at a fixed tick and sends snapshots at 20–30 Hz.
- Guests predict their own movement locally and reconcile with the host. Other players are interpolated about 100 ms behind.
- Lobby: room code + QR (`buildQrUrl`, `QrScanner`, `CopyBtn`), share link `/games/fps?room=XXXXXX`, open rooms listed via `registerOpenRoom` / `fetchOpenRooms` / `unregisterOpenRoom`.
- When the host disconnects, guests see "host left" and go back to the menu (no host migration).

**Acceptance:** two browsers on different networks see each other move smoothly. `protocol.test.js` covers encode/decode round trips and interpolation.

### FPS-10: Authoritative combat over the network
**Depends on:** FPS-9, FPS-5

- Guests send inputs and shot intents (time, origin, direction, weapon). They never send "I hit X".
- Host validates fire rate and ammo, then rewinds other players to their positions at the shooter's time (keeping about 200–300 ms of history) and raycasts.
- The host owns HP, deaths, respawns, ammo, drops and pickups, and broadcasts them as reliable events.
- Grenades are simulated on the host. Guests render them from snapshots.

**Acceptance:** shots that land on screen count (within tolerance on ~100 ms ping), and a guest sending forged or too-frequent shots is ignored. Hit validation has tests.

### FPS-11: Team Deathmatch and bots
**Depends on:** FPS-10, FPS-6

- Lobby: two teams, pick or auto-balance, host chooses the map, kill limit, time limit and bot count/difficulty.
- Bots fill empty slots and run on the host using the FPS-6 AI, targeting the other team.
- Team spawns with spawn protection (a few seconds, or until you fire).
- Respawn delay. Your loadout is chosen at respawn.
- Scoreboard held with Tab (kills, deaths, ping). Match end screen with the winning team.
- No friendly fire by default (host option).

**Acceptance:** a 2v2 match with two bots on each side plays to the kill or time limit with correct scores on every client.

### FPS-12: In-game text chat
**Depends on:** FPS-9

- Enter opens all-chat and Y opens team chat. Typing releases movement keys but keeps the game running. Esc cancels.
- Messages go over the reliable channel. The host relays them, sending team messages only to that team.
- Host limits: max length (e.g. 200 characters), rate limit per player, plain-text rendering only (no HTML).
- Chat overlay fades after a few seconds and shows in full while typing. System messages (joined, left, team change) appear in the same feed.

**Acceptance:** messages arrive in real time across browsers, and team messages never reach the other team (check the host relay logic in a test).

---

## Out of scope (possible follow-ups)
- Team voice chat (push-to-talk mesh per team).
- Host migration.
- Mobile/touch controls.
- Co-op waves in multiplayer.

## Known risks
- **Network feel depends on the host's connection.** The host has zero ping, and a slow host makes the match bad for everyone.
- **Relay data limits:** players who can't connect directly go through Metered's TURN relay, and shooter traffic could use up its allowance. Keep snapshots small and cap rooms at 8 players.
- **Performance on low-end laptops and integrated GPUs:** depends on the quality settings and keeping draw calls low.
