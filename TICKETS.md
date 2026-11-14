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

#### FPS-8e: Tactical maps and textures (done 2026-11-12)
Asked for maps "like CS:GO or deadshot.io": more realistic and less open. The layouts are original; no existing game's map is copied.

- **ASCII map format** (`maps/ascii.js`, tested): a map is drawn as a text grid, 2 m per cell, with a legend of heights and materials. Neighbouring cells of the same kind merge into as few boxes as possible, and spawns are letters in the grid.
- **Old Quarter:** a three-lane town map. Two walled courtyards, a long west lane, a middle street with a choke doorway and side connectors, a tight east alley, and buildings everywhere else.
- **Warehouse:** a roofed hall with shelf aisles and a cross aisle, an office block with rooms and doorways, three loading doors, and a truck yard with a raised dock. The roof is visual only (`decor`), so it doesn't affect movement, bots or bullets.
- **Procedural textures** (`render/textures.js`): plaster, stone, brick, concrete, wood, corrugated metal, paving and shelving, drawn on canvases at runtime with no downloads. They are mapped in world space, so they keep their real size on every box and line up across boxes, and wall bases are darkened slightly. The older maps get textures too, chosen from their material names.
- Both new maps come first in the map list. The menu's map buttons were narrowed so five fit in one row.

#### FPS-8d: Sound (done 2026-11-07)
- **All synthesised with Web Audio** (`audio.js`), with no audio files. There's one AudioContext per session, created on the first sound after Play and closed on exit.
- **Your weapon:**
  - A gunshot per weapon (crack, body thump and tail).
  - Knife and grenade swish, two reload clicks timed to the reload, a dry-fire click and a draw clack.
- **Feedback:**
  - A hit tick (higher for headshots, double for kills), a hurt thud and a falling tone on death.
  - Pickup blips, and wave start and wave cleared cues.
- **Footsteps** once per stride: longer when sprinting, quieter when crouched. Bots' footsteps are heard within 25 m.
- **Positioned sounds** (bot gunfire and footsteps, explosions) are panned by direction, quieter with distance and duller far away or behind (`engine/sound.js`, tested). Nothing plays past 70 m.
- **Volume slider and Mute** in the pause menu. Muted plays nothing (verified by counting audio nodes in the browser).

#### FPS-8c: HUD polish (done 2026-11-06)
- **Crosshair:** a centre dot plus four arms. The gap is the weapon's real cone of fire on screen (`engine/hud.js`, tested), so it opens up when moving, jumping or in sustained fire and closes when you settle. It's updated every frame through a CSS variable, not React. Hidden while aiming down sights.
- **Kill feed:** top right, the last 4 kills for 5 s each. The killer, weapon, headshot mark and victim are coloured by side, and self-kills read "themselves".
- **Damage-direction arcs:** a red arc around the centre for each hit taken, pointing at its source (the attacker, or the grenade's position). It keeps tracking as you turn and fades over 1.2 s.
- **Low-HP vignette:** a pulsing red edge below 35 HP that gets stronger as health drops.

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

- **Movement rework (2026-11-12), for Medium and High graphics:**
  - **Blended locomotion:** `engine/anim.js` returns a weight per clip instead of picking one. Idle fades into moving with speed, and forward / back / strafe clips blend by direction of travel, so diagonals and turns no longer snap. Weights are eased, the blended clips share one stride phase, and the playback rate keeps the feet planted. In the air the stride freezes.
  - **Both hands on the weapon:** arms are no longer driven by the clips. The weapon is shouldered at a pivot near the right shoulder and swings with the aim; two-bone IK puts the right hand on the grip and the left on the fore-end (both on the grip for the pistol; knife and grenade are one-handed).
  - **Smaller touches:** a recoil kick on each shot, bots on patrol carry the weapon lowered, and the body's facing is eased.
  - Idle_Shoot and Run_Shoot are no longer used.

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

**As built (2026-11-12):**
- **Flow:** "Host on <map>" in the menu creates a room and drops the host into the map; guests join by code, invite link (`/games/fps?room=CODE`, which pre-fills the code) or the open-room list. Everyone walks the map together as a warm-up; weapons, damage and teams come with FPS-10 and FPS-11. The pause menu shows the room code and a copy-link button, and the game keeps running while it is open.
- **Files:** `net/protocol.js` (binary commands and snapshots), `net/hostSim.js` (the host's simulation), `net/predict.js` (guest prediction and reconciliation), `net/interp.js` (other players drawn 100 ms in the past), `net/room.js` (PeerJS), `net/session.js` (one interface for host and guest), `netGame.js` (the browser side). All but `room.js`, `session.js` and `netGame.js` are pure and covered by `net/net.test.js`, including a run over a simulated 80 ms, 10%-loss link.
- **Movement authority:** guests send one numbered command per tick (keys and view angles), repeating the last 3 in each packet. The host applies them with the same `stepPlayer()` and allows about one per tick per player, so sending more doesn't move you faster. Snapshots go out at 20 Hz.
- **Deviations from the ticket:**
  - *No truly unreliable channel.* PeerJS never sets `maxRetransmits`, so the state channel is unordered but still retransmitted. Late packets don't hold newer ones back; stale snapshots are dropped by tick number.
  - *No QR code or scanner.* The game is desktop-only, so a QR code to scan with a phone would lead nowhere. Code, link and room list cover it.
  - *The player's own position is sent as float64*, not quantised: with float32, a body resting against a wall was rounded into it and prediction diverged (26 corrections in 20 s in the lossy-link test, 0–1 after the change).
- **Known limits:** the host's game loop stops while its tab is hidden, which freezes the room for everyone. A guest whose tab is hidden just stands still. Host migration is still out of scope.

### FPS-10: Authoritative combat over the network
**Depends on:** FPS-9, FPS-5

- Guests send inputs and shot intents (time, origin, direction, weapon). They never send "I hit X".
- Host validates fire rate and ammo, then rewinds other players to their positions at the shooter's time (keeping about 200–300 ms of history) and raycasts.
- The host owns HP, deaths, respawns, ammo, drops and pickups, and broadcasts them as reliable events.
- Grenades are simulated on the host. Guests render them from snapshots.

**Acceptance:** shots that land on screen count (within tolerance on ~100 ms ping), and a guest sending forged or too-frequent shots is ignored. Hit validation has tests.

**As built (2026-11-13):**
- **Mode for now:** free-for-all deathmatch between the players in the room; teams and bots come with FPS-11. Scores (kills / deaths) show next to each name.
- **No shot messages at all.** Instead of "shot intents", guests send only their inputs: each command now also carries the weapon buttons (fire, aim, reload, slot, scroll, last weapon, pick up) and the host-clock moment the guest was looking at. The host runs the same weapon code on those inputs (`net/command.js`, shared with the guest's prediction), so fire rate, ammo, reloads and switch delays are enforced by construction. Bullet spread is seeded by the command number, so the host draws the same spread the guest saw.
- **Lag compensation:** the host keeps 600 ms of positions per player and checks each shot or stab against where the others were at the moment the shooter was looking at, capped at 400 ms back.
- **Host-owned state:** health and regeneration, deaths, a 3 s respawn at the spawn farthest from other players, 2 s of spawn protection, grenades (flight and blast), drops and pickups (walk-over ammo and grenades, E to swap guns). Guests get reliable events for hits, being hurt, kills, explosions, pickups and the drop list.
- **Snapshots** now carry the recipient's health, respawn timer and full weapon state (as float64 timers, so replayed predictions fire on the same tick), each other player's weapon, death flag and a shot counter, and the grenades in flight.
- **Guest side:** your own gun is predicted, so firing, ammo and reloads feel instant; hit markers, damage, kills and pickups only ever come from the host. Other players' shots are heard and drawn from the shot counter; their bullet holes and tracers are for show.
- **Tests** (`net/net.test.js`): hits, headshots and misses; fire rate and ammo under a flood of 600 fire commands; lag compensation (a shot at a 150 ms old position counts with it and misses without it; a 2 s old position can't be claimed); kills, scores, drops, pickups, respawns; grenades, including killing yourself; the knife's reach; and guest prediction matching the host shot for shot and round for round.

### FPS-11: Team Deathmatch and bots
**Depends on:** FPS-10, FPS-6

- Lobby: two teams, pick or auto-balance, host chooses the map, kill limit, time limit and bot count/difficulty.
- Bots fill empty slots and run on the host using the FPS-6 AI, targeting the other team.
- Team spawns with spawn protection (a few seconds, or until you fire).
- Respawn delay. Your loadout is chosen at respawn.
- Scoreboard held with Tab (kills, deaths, ping). Match end screen with the winning team.
- No friendly fire by default (host option).

**Acceptance:** a 2v2 match with two bots on each side plays to the kill or time limit with correct scores on every client.

**As built (2026-11-13):**
- **Teams:** Blue and Orange. Joining puts you on the team with fewer people; the pause menu has a "Switch team" button (you respawn on the new side). At most 4 people per team.
- **Bots:** the single-player bot brains run on the host and go through the same command path as players, so they obey the same weapon rules. They fill each team up to the chosen size, step aside when a person joins, and come back when one leaves. Bot damage is scaled by difficulty and their headshots are capped, as in single-player.
- **Host's match settings** (menu, remembered): team size 1v1 to 4v4, kill limit, time limit, bots on/off, friendly fire, and bot difficulty from the existing Easy/Normal/Hard buttons. The map is the one selected when hosting.
- **Match flow:** first team to the kill limit wins, or the team ahead when time runs out (level scores are a draw). Then a 10 s intermission where nobody can act, and a fresh match with scores reset.
- **Friendly fire off by default:** bullets, stabs and blasts pass teammates; your own grenade still hurts you. With it on, a team kill costs the killer a point and scores nothing.
- **Spawns:** your team's spawn farthest from living enemies and not already occupied, with the 2 s protection from FPS-10. The 3 s respawn delay is unchanged.
- **Loadout at respawn:** the pause menu's "Primary for your next life" picker takes effect when you next respawn.
- **HUD:** team scores and the clock at the top, your team named top left. Hold Tab for the scoreboard (kills, deaths, ping per player, bots marked); it also shows between matches with the result.
- **Looks:** teammates wear the Soldier model and enemies the SWAT gear; on Low graphics the box figures are blue and orange.
- **Not done:** the ticket's "host chooses the map" is only before hosting; there is no map change between matches without closing the room. Picked up in FPS-11b.

### FPS-11b: Change map between matches
**Depends on:** FPS-11

- **Host's menu** (multiplayer, host only): a "Next map" picker that applies when the next match starts (default: the current map), and "Change now", which ends the current match with no winner and goes to the intermission. The intermission scoreboard shows the next map.
- **Host sim** (`net/hostSim.js`, pure): the map becomes switchable. `setNextMap(map)`, `changeMapNow()`. `newMatch()` applies a waiting map: rebuild the nav graph (when bots are on), point the bots' world at the new boxes, bump a `mapGen` counter (u8, wraps), clear grenades and drops, reset bots' paths (they hold waypoints of the old nav graph), respawn everyone at the new team spawns. `matchState()` carries `mapId`, `nextMapId`, `mapGen`.
- **Snapshots carry `mapGen`** in the spare header byte (byte 3). Events and snapshots use different channels, so after a switch either can arrive first: a guest drops snapshots of a different generation than the map it has loaded, so prediction never replays against the old map's walls.
- **Guest session:** when the roster says the map changed, it loads the new map's boxes itself (`getMap(id).boxes`, replacing `setBoxes`) and clears the interpolation buffer so nobody slides across the map from their old position.
- **`FPS.jsx`:** the active map comes from the network HUD data (which re-renders when it changes), not from the session object (which never changes identity), so the map scene and the net game rebuild.

**Acceptance:** in a 2v2 with bots the host switches Old Quarter → Warehouse; at the next match every guest's scene, collision and bots switch without leaving the room. Tests: the next map applies only at the new match; everyone respawns at the new team spawns, not inside boxes; drops and grenades are cleared; bots keep playing on the new map; `mapGen` round-trips; a guest ignores old-generation snapshots; "Change now" gives no team a win.

**As built (2026-11-14):**
- **Host's menu:** a "Next map" dropdown (the current map is marked) and a button that reads "End match and go to <map>" or, with the same map picked, "End match and restart". During the intermission it says when the next map starts instead. Picking a map without pressing the button changes it when the match ends normally.
- **Ending early** shows "Match ended by the host" instead of a win, loss or draw. The intermission scoreboard says "Next match on <map> in N…" when the map is changing.
- **Same map picked again** is not a change: `mapGen` stays put and nothing reloads.
- **Guest gate:** `snapshotWanted(snap, gen, latestTick)` in `net/protocol.js` (pure, tested) decides whether a snapshot is used. The guest session loads the new map's boxes itself when the roster's `mapGen` changes and clears the interpolator (`interp.clear()`); `setBoxes` is gone.
- **Verified in the browser** (two headless Chromium contexts, host and guest over PeerJS): the host switched Old Quarter → Warehouse with "End match and go to Warehouse"; after the intermission both the host and the guest were playing in the Warehouse, with no console errors.
- **Not done:** automatic map rotation (a possible follow-up; one option and a line in `newMatch()`).

### FPS-12: In-game text chat
**Depends on:** FPS-9

- Enter opens all-chat and Y opens team chat. Typing releases movement keys but keeps the game running. Esc cancels.
- Messages go over the reliable channel. The host relays them, sending team messages only to that team.
- Host limits: max length (e.g. 200 characters), rate limit per player, plain-text rendering only (no HTML).
- Chat overlay fades after a few seconds and shows in full while typing. System messages (joined, left, team change) appear in the same feed.

**Plan (2026-11-13):**
- **`net/chat.js` (pure):** `cleanChat(text)` strips control, zero-width and bidi-override characters (they can fake who said what), collapses whitespace, trims, cuts to 200 characters; non-strings and empty results are dropped. A per-player token bucket: a burst of 4, then one every 2 s; over the limit the sender alone gets "You're sending messages too fast."
- **Host relay (`hostSim.js`):** `sim.chat(id, text, teamOnly)` takes the sender's name and team from the host's roster, never from the message. All-chat goes to everyone; team chat as one private event per human on the sender's team (the host included when on it), through the existing `{ to, msg }` queue. System messages (joined, left, switched team, match won, next map) go in the same feed; bots don't announce themselves.
- **Sessions:** `sendChat(text, teamOnly)` on both: a guest sends `{ t: "chat", text, team }` over the reliable channel, the host calls the sim directly.
- **Input and HUD:** multiplayer only, while playing. Opening chat clears held keys and queued presses; while typing, game keys and mouse buttons are ignored but mouse look and the match keep running. A React `<input maxLength={200}>`: Enter sends (empty Enter just closes). Esc always releases the pointer (the browser's rule), so it cancels the message and opens the menu like any Esc. If typing into a focused input under pointer lock turns out unreliable, release the lock while typing and relock on Enter (a key press counts as a user gesture). `netGame.js` keeps ~30 messages; the HUD shows the last ~6, each fading after ~8 s, all while typing. Names coloured by team, `[TEAM]` tag, rendered as React text only. Enter and Y added to the controls list.

**Acceptance:** messages arrive in real time across browsers, and team messages never reach the other team (check the host relay logic in a test). Tests also cover: the sender's name comes from the host; 201 characters are cut to 200; control and bidi characters are stripped; spam is rate-limited; malformed messages are ignored; system messages on join, leave and team change.

**As built (2026-11-14):**
- **Files:** `net/chat.js` (pure: `cleanChat`, `createRateLimiter`, limits, team names), `sim.chat()` and the system lines in `net/hostSim.js`, `sendChat` in both sessions, the chat keys and typing mode in `input.js`, the lines in `netGame.js`, `ChatBox` in `FPS.jsx`.
- **Messages:** `{ t: "chat", from, name, team, scope: "all" | "team", text }`, or `{ t: "chat", system: true, text }`. A guest's `team` flag counts only if it is exactly `true`.
- **System lines:** "<name> joined Blue.", "<name> left.", "<name> switched to Orange.", "Blue wins the match." / "The match is a draw." / "The host ended the match.", "Next map: Warehouse." / "Staying on Arena.", "Now playing Warehouse.". Bots filling or leaving a team say nothing. The rate-limit warning goes to the sender only.
- **Keys:** Enter (and keypad Enter) for all, Y for team. The key that opens the box is swallowed, so it never lands in the text. While typing, the game ignores keys and clicks (a click also can't take the focus from the box), mouse look carries on, and the pointer stays locked. Enter sends, an empty Enter or Esc closes; Esc also releases the mouse and opens the menu (the browser's rule). Leaving the box (losing focus) cancels it.
- **Display:** bottom left above the health, the last 8 lines, each fading after 8 s; all of them while typing. Your own name is green, others are coloured by team, team lines are tagged `[TEAM]`, system lines amber. The lines are kept per room outside the net game, so a map change doesn't wipe them.
- **Verified in the browser** (headless Chromium, host on Blue and guest on Orange over PeerJS): all-chat reached both; the guest's team line reached only the guest and the host's only the host; `hello <b>all</b>` showed literally; Y didn't land in the box; the pointer stayed locked; lines faded; no console errors.

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
