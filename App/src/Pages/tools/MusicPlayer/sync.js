// Pure merge helpers for P2P library sync — hash-based track dedup, name-based
// album/playlist dedup. Additive only: never overwrites existing local data,
// mirroring the merge philosophy of QuestionBank's dedupe.js/importBank.

export function trackToManifestEntry(track) {
  return {
    id: track.id,
    hash: track.hash,
    title: track.title,
    artist: track.artist,
    fileName: track.fileName,
    duration: track.duration,
    dateAdded: track.dateAdded,
    albumId: track.albumId,
    size: track.fileBlob.size,
    mime: track.fileBlob.type,
  };
}

// Track ids are crypto.randomUUID() on every device, so a track that's new to
// this device can keep its remote id as-is — only duplicates (matched by
// content hash, never by id) need remapping to the id already used locally.
export function planTrackSync(manifestTracks, localTracksWithHash) {
  const localByHash = new Map(localTracksWithHash.map((t) => [t.hash, t.id]));
  const needed = [];
  const idMap = new Map();
  for (const remote of manifestTracks) {
    const localId = localByHash.get(remote.hash);
    if (localId) {
      idMap.set(remote.id, localId);
    } else {
      needed.push(remote);
      idMap.set(remote.id, remote.id);
    }
  }
  return { needed, idMap };
}

function remapIds(ids, idMap) {
  return [...new Set(ids.map((id) => idMap.get(id)).filter(Boolean))];
}

// Shared by albums and playlists (both are { id, name, trackIds }) — matches
// by case-insensitive name and unions trackIds (remapped through trackIdMap)
// into the existing local record, or stages a new one under the remote's id.
// Returns an idMap too, so callers can remap anything else that references
// these collection ids (e.g. a track's albumId).
export function mergeNamedCollections(remoteItems, localItems, trackIdMap) {
  const toCreate = [];
  const toUpdate = [];
  const idMap = new Map();
  for (const remote of remoteItems) {
    const remappedTrackIds = remapIds(remote.trackIds, trackIdMap);
    const match = localItems.find(
      (l) => l.name.trim().toLowerCase() === remote.name.trim().toLowerCase()
    );
    if (match) {
      idMap.set(remote.id, match.id);
      const mergedIds = [...new Set([...match.trackIds, ...remappedTrackIds])];
      if (mergedIds.length !== match.trackIds.length) {
        toUpdate.push({ ...match, trackIds: mergedIds });
      }
    } else {
      idMap.set(remote.id, remote.id);
      toCreate.push({ id: remote.id, name: remote.name, trackIds: remappedTrackIds });
    }
  }
  return { toCreate, toUpdate, idMap };
}
