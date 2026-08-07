import { useState, useRef, useCallback, useEffect } from "react";
import Peer from "peerjs";
import { getIceServers, QrScanner } from "../../tk-shared.jsx";
import { getAllTracks, getAllAlbums, getAllPlaylists, putTrack, putAlbum, putPlaylist, ensureTrackHash } from "../db/db";
import { trackToManifestEntry, planTrackSync, mergeNamedCollections } from "../sync";

const CHUNK_SIZE = 16 * 1024;
const generateRoomId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

function buildQrUrl(data, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

function buildSyncLink(roomId) {
  return `${window.location.origin}/toolz?tool=music_player&sync=${roomId}`;
}

function extractRoomId(scanned) {
  try {
    const url = new URL(scanned);
    const fromQuery = url.searchParams.get("sync");
    if (fromQuery) return fromQuery.toUpperCase();
  } catch {
    // not a URL — fall through and treat the raw text as the room id
  }
  return scanned.trim().toUpperCase();
}

function concatArrayBuffers(buffers) {
  const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return result.buffer;
}

async function sendTrackChunked(conn, track, onProgress) {
  const blob = track.fileBlob;
  const totalChunks = Math.max(1, Math.ceil(blob.size / CHUNK_SIZE));
  conn.send({ type: "track-start", id: track.id, totalChunks });
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const buf = await blob.slice(start, start + CHUNK_SIZE).arrayBuffer();
    conn.send({ type: "track-chunk", id: track.id, index: i, data: buf });
    onProgress?.((i + 1) / totalChunks);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// One-way push: the scanning device requests only the tracks it doesn't
// already have (by content hash), the host streams just those over the data
// channel, and albums/playlists are merged additively by name — same
// "never auto-overwrite" principle as QuestionBank's SyncPanel/importBank.
// Cover images aren't part of the sync payload (kept out to avoid a second
// binary-transfer path for what's a cosmetic, easily-redone-locally field).
export default function SyncPanel({ onSynced, autoJoinRoomId }) {
  const [role, setRole] = useState(autoJoinRoomId ? "scan" : null);
  const [status, setStatus] = useState("");
  const [roomId, setRoomId] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [summary, setSummary] = useState(null);
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const autoJoinedRef = useRef(false);
  const incomingRef = useRef(new Map());
  const pendingRef = useRef(null);

  useEffect(() => () => { connRef.current?.close(); peerRef.current?.destroy(); }, []);

  const startHost = async () => {
    setRole("host");
    setStatus("Starting…");
    const iceServers = await getIceServers();
    const peer = new Peer(generateRoomId(), { config: { iceServers } });
    peerRef.current = peer;
    peer.on("open", (id) => { setRoomId(id); setStatus(""); });
    peer.on("connection", (conn) => {
      connRef.current = conn;
      setStatus("Device connected — preparing library…");

      conn.on("open", async () => {
        const [tracks, albums, playlists] = await Promise.all([getAllTracks(), getAllAlbums(), getAllPlaylists()]);
        const manifestTracks = [];
        for (const track of tracks) {
          const hash = await ensureTrackHash(track);
          manifestTracks.push(trackToManifestEntry({ ...track, hash }));
        }
        conn.send({
          type: "library-manifest",
          tracks: manifestTracks,
          albums: albums.map((a) => ({ id: a.id, name: a.name, trackIds: a.trackIds })),
          playlists: playlists.map((p) => ({ id: p.id, name: p.name, trackIds: p.trackIds })),
        });
        setStatus(`Sent manifest for ${manifestTracks.length} track(s) — waiting to hear what's new to them…`);
      });

      conn.on("data", async (data) => {
        if (data.type !== "track-request") return;
        const [tracks] = await Promise.all([getAllTracks()]);
        const wanted = tracks.filter((t) => data.ids.includes(t.id));
        let sent = 0;
        for (const track of wanted) {
          setStatus(`Sending "${track.title}"… (${sent + 1}/${wanted.length})`);
          await sendTrackChunked(conn, track, () => {});
          sent += 1;
        }
        conn.send({ type: "tracks-complete" });
        setStatus(
          wanted.length === 0
            ? "Done — the other device already had every track. You can close this."
            : `Done — sent ${wanted.length} new track(s). You can close this once the other device confirms.`
        );
      });
    });
    peer.on("error", (e) => setStatus("Error: " + e.message));
  };

  const finishReceiving = useCallback((conn, peer) => {
    const p = pendingRef.current;
    setSummary({
      addedTracks: p.receivedCount,
      skippedTracks: p.skippedCount,
      addedAlbums: p.addedAlbums,
      addedPlaylists: p.addedPlaylists,
    });
    setStatus("Done.");
    onSynced();
    conn.close();
    peer.destroy();
  }, [onSynced]);

  const connectToRoom = useCallback(async (targetRoomId) => {
    setConnecting(true);
    setStatus(`Connecting to ${targetRoomId}…`);
    const iceServers = await getIceServers();
    const peer = new Peer(undefined, { config: { iceServers } });
    peerRef.current = peer;
    peer.on("open", () => {
      const conn = peer.connect(targetRoomId, { reliable: true });
      connRef.current = conn;
      conn.on("open", () => setStatus("Connected — waiting for the other device's library…"));

      conn.on("data", async (data) => {
        if (data.type === "library-manifest") {
          setStatus("Merging…");
          const [localTracks, localAlbums, localPlaylists] = await Promise.all([
            getAllTracks(), getAllAlbums(), getAllPlaylists(),
          ]);
          const localTracksWithHash = [];
          for (const track of localTracks) {
            localTracksWithHash.push({ id: track.id, hash: await ensureTrackHash(track) });
          }
          const { needed, idMap } = planTrackSync(data.tracks, localTracksWithHash);
          const albumMerge = mergeNamedCollections(data.albums, localAlbums, idMap);
          const playlistMerge = mergeNamedCollections(data.playlists, localPlaylists, idMap);

          for (const album of albumMerge.toCreate) await putAlbum({ ...album, coverImageBlob: null });
          for (const album of albumMerge.toUpdate) await putAlbum(album);
          for (const playlist of playlistMerge.toCreate) await putPlaylist(playlist);
          for (const playlist of playlistMerge.toUpdate) await putPlaylist(playlist);

          pendingRef.current = {
            manifestById: new Map(data.tracks.map((t) => [t.id, t])),
            albumIdMap: albumMerge.idMap,
            receivedCount: 0,
            skippedCount: data.tracks.length - needed.length,
            addedAlbums: albumMerge.toCreate.length,
            addedPlaylists: playlistMerge.toCreate.length,
          };
          onSynced();

          if (needed.length === 0) {
            finishReceiving(conn, peer);
          } else {
            setStatus(`Requesting ${needed.length} new track(s)…`);
            conn.send({ type: "track-request", ids: needed.map((t) => t.id) });
          }
          return;
        }

        if (data.type === "track-start") {
          incomingRef.current.set(data.id, { chunks: new Array(data.totalChunks), received: 0, totalChunks: data.totalChunks });
          return;
        }

        if (data.type === "track-chunk") {
          const transfer = incomingRef.current.get(data.id);
          if (!transfer) return;
          transfer.chunks[data.index] = data.data;
          transfer.received += 1;
          setStatus(`Receiving track… (${Math.round((transfer.received / transfer.totalChunks) * 100)}%)`);

          if (transfer.received === transfer.totalChunks) {
            incomingRef.current.delete(data.id);
            const manifestEntry = pendingRef.current.manifestById.get(data.id);
            const buffer = concatArrayBuffers(transfer.chunks);
            const track = {
              id: data.id,
              fileBlob: new Blob([buffer], { type: manifestEntry.mime }),
              fileName: manifestEntry.fileName,
              title: manifestEntry.title,
              artist: manifestEntry.artist,
              duration: manifestEntry.duration,
              dateAdded: manifestEntry.dateAdded,
              albumId: pendingRef.current.albumIdMap.get(manifestEntry.albumId) ?? null,
              hash: manifestEntry.hash,
            };
            await putTrack(track);
            pendingRef.current.receivedCount += 1;
            onSynced();
          }
          return;
        }

        if (data.type === "tracks-complete") {
          finishReceiving(conn, peer);
        }
      });
      conn.on("error", (e) => setStatus("Error: " + e.message));
    });
    peer.on("error", (e) => setStatus("Error: " + e.message));
  }, [onSynced, finishReceiving]);

  useEffect(() => {
    if (autoJoinRoomId && !autoJoinedRef.current) {
      autoJoinedRef.current = true;
      setRole("scan");
      connectToRoom(autoJoinRoomId);
    }
  }, [autoJoinRoomId, connectToRoom]);

  const handleDecode = useCallback((scanned) => connectToRoom(extractRoomId(scanned)), [connectToRoom]);

  const reset = () => {
    connRef.current?.close();
    peerRef.current?.destroy();
    connRef.current = null; peerRef.current = null;
    incomingRef.current.clear();
    pendingRef.current = null;
    setRole(null); setStatus(""); setRoomId(""); setSummary(null); setManualInput(""); setConnecting(false);
  };

  if (role === null) {
    return (
      <div className="tk-sync-panel">
        <p className="tk-sync-status">
          Sync your music library directly to another device over a peer-to-peer connection —
          audio files transfer straight over WebRTC, duplicates are skipped by content hash.
        </p>
        <div className="tk-sync-row">
          <button className="tk-action-btn" onClick={startHost}>Show my library as QR</button>
          <button className="tk-action-btn" onClick={() => setRole("scan")}>Scan a library</button>
        </div>
      </div>
    );
  }

  if (role === "host") {
    return (
      <div className="tk-sync-panel">
        {roomId ? (
          <>
            <div className="tk-qr-wrap">
              <img src={buildQrUrl(buildSyncLink(roomId))} alt="Scan to receive this library" width={200} height={200} />
            </div>
            <p className="tk-sync-status">Room code: {roomId}</p>
          </>
        ) : (
          <p className="tk-sync-status">Starting…</p>
        )}
        {status && <p className="tk-sync-status">{status}</p>}
        <button className="tk-action-btn" onClick={reset}>Done</button>
      </div>
    );
  }

  return (
    <div className="tk-sync-panel">
      {!connecting && !summary && <QrScanner onDecode={handleDecode} onCancel={reset} />}
      {status && <p className="tk-sync-status">{status}</p>}
      {summary && (
        <p className="tk-sync-status">
          Added {summary.addedTracks} track(s), skipped {summary.skippedTracks} duplicate(s),
          {" "}{summary.addedAlbums} new album(s), {summary.addedPlaylists} new playlist(s).
        </p>
      )}
      {!connecting && !summary && (
        <div className="tk-sync-row">
          <input
            className="tk-input-field"
            placeholder="Or type the room code…"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && manualInput.trim() && connectToRoom(manualInput.trim())}
          />
          <button className="tk-action-btn" onClick={() => manualInput.trim() && connectToRoom(manualInput.trim())}>Connect</button>
        </div>
      )}
      <button className="tk-action-btn" onClick={reset}>{summary ? "Done" : "Cancel"}</button>
    </div>
  );
}
