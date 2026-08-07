// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the pure sync-merge logic. Run manually with:
//   node src/Pages/tools/MusicPlayer/sync.test.js
import { planTrackSync, mergeNamedCollections } from "./sync.js";

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

// ── planTrackSync: duplicate (by hash) is remapped, new track keeps its id ──
{
  const manifest = [
    { id: "remote-1", hash: "hashA" }, // duplicate of local track
    { id: "remote-2", hash: "hashB" }, // new to this device
  ];
  const local = [{ id: "local-1", hash: "hashA" }];
  const { needed, idMap } = planTrackSync(manifest, local);
  check("dup track: not in needed list", needed.map((t) => t.id), ["remote-2"]);
  check("dup track: remapped to local id", idMap.get("remote-1"), "local-1");
  check("new track: keeps its own id", idMap.get("remote-2"), "remote-2");
}

// ── mergeNamedCollections: name match unions trackIds, remapped through idMap ──
{
  const trackIdMap = new Map([["r-1", "local-1"], ["r-2", "r-2"]]);
  const remoteAlbums = [{ id: "remote-album", name: "Favorites", trackIds: ["r-1", "r-2"] }];
  const localAlbums = [{ id: "local-album", name: "favorites", trackIds: ["local-1", "existing-3"] }];
  const { toCreate, toUpdate, idMap } = mergeNamedCollections(remoteAlbums, localAlbums, trackIdMap);
  check("name match: no new album created", toCreate.length, 0);
  check("name match: existing album updated with union", toUpdate[0]?.trackIds.sort(), ["existing-3", "local-1", "r-2"].sort());
  check("name match: remote id maps to local album id", idMap.get("remote-album"), "local-album");
}

// ── mergeNamedCollections: no name match creates a new collection ──
{
  const trackIdMap = new Map([["r-3", "r-3"]]);
  const remoteAlbums = [{ id: "remote-album-2", name: "Road Trip", trackIds: ["r-3"] }];
  const { toCreate, toUpdate, idMap } = mergeNamedCollections(remoteAlbums, [], trackIdMap);
  check("no match: staged for creation", toCreate, [{ id: "remote-album-2", name: "Road Trip", trackIds: ["r-3"] }]);
  check("no match: nothing to update", toUpdate.length, 0);
  check("no match: id maps to itself", idMap.get("remote-album-2"), "remote-album-2");
}

// ── mergeNamedCollections: exact match, no new trackIds -> no update needed ──
{
  const trackIdMap = new Map([["r-1", "local-1"]]);
  const remoteAlbums = [{ id: "remote-album", name: "Chill", trackIds: ["r-1"] }];
  const localAlbums = [{ id: "local-album", name: "Chill", trackIds: ["local-1"] }];
  const { toUpdate } = mergeNamedCollections(remoteAlbums, localAlbums, trackIdMap);
  check("already-covered trackIds: skipped, no redundant update", toUpdate.length, 0);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll sync-merge checks passed.");
}
