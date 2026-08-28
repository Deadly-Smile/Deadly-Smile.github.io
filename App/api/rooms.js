// Directory of currently-open P2P rooms, for tools that let a host opt in to
// being discoverable without sharing a code or QR. Backed by Upstash Redis
// (Vercel's "Upstash for Redis" storage integration sets these env vars
// automatically) so it degrades gracefully — same pattern as turn-credentials.js.
const TTL_MS = 45 * 1000;
const KEY = "p2p:open-rooms";
const ROOM_ID_RE = /^[A-Z0-9]{4,10}$/;

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

async function upstash(...command) {
  const res = await fetch(`${UPSTASH_URL}/${command.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) throw new Error("Upstash request failed");
  const { result } = await res.json();
  return result;
}

export default async function handler(req, res) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(200).json({ rooms: [], available: false });
  }

  try {
    if (req.method === "GET") {
      const toolFilter = req.query.tool;
      const raw = (await upstash("HGETALL", KEY)) || [];
      const now = Date.now();
      const rooms = [];
      const stale = [];

      for (let i = 0; i < raw.length; i += 2) {
        const roomId = raw[i];
        let entry;
        try { entry = JSON.parse(raw[i + 1]); } catch { entry = null; }
        if (!entry || now - entry.ts > TTL_MS) { stale.push(roomId); continue; }
        if (toolFilter && entry.tool !== toolFilter) continue;
        rooms.push({ roomId, tool: entry.tool, createdAt: entry.ts });
      }
      if (stale.length) await upstash("HDEL", KEY, ...stale);
      rooms.sort((a, b) => b.createdAt - a.createdAt);
      return res.status(200).json({ rooms, available: true });
    }

    if (req.method === "POST") {
      const { roomId, tool } = req.body || {};
      if (!ROOM_ID_RE.test(roomId)) return res.status(400).json({ error: "invalid roomId" });
      await upstash("HSET", KEY, roomId, JSON.stringify({ tool: tool || "chat", ts: Date.now() }));
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { roomId } = req.body || {};
      if (!ROOM_ID_RE.test(roomId)) return res.status(400).json({ error: "invalid roomId" });
      await upstash("HDEL", KEY, roomId);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: "method not allowed" });
  } catch {
    res.status(200).json({ rooms: [], available: false });
  }
}
