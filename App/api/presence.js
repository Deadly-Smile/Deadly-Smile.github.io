// Device presence for P2P Chat: which devices are online, and which share
// the caller's network. "Same network" means the same public IP (an IPv6
// /64 counts as one network, since each LAN device gets its own address in
// it). The IP itself is never stored or returned — only a salted hash used
// as the group key. Same Upstash setup as rooms.js, and like it this
// self-disables (available: false) when the env vars aren't set.
import { createHash } from "node:crypto";

const TTL_MS = 45 * 1000;
const MAC_RE = /^[0-9a-f]{12}$/;
const MAX_CONTACTS = 200;
const NAME_MAX = 32;

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
const SALT = process.env.PRESENCE_SALT || UPSTASH_TOKEN || "";

const devKey = (mac) => `chat:dev:${mac}`;
const netKey = (net) => `chat:net:${net}`;

// Commands go in the POST body rather than the URL path, since device names
// are user-chosen text.
async function pipeline(commands) {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error("Upstash request failed");
  return (await res.json()).map(r => r.result);
}

function expandIPv6(ip) {
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...h, ...Array(8 - h.length - t.length).fill("0"), ...t] : h;
  return groups.map(g => g.padStart(4, "0").toLowerCase());
}

function networkOf(req) {
  const raw = req.headers["x-real-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0] || req.socket?.remoteAddress || "";
  let ip = raw.trim().replace(/^::ffff:/i, "");
  if (!ip) return null;
  if (ip.includes(":")) ip = expandIPv6(ip.split("%")[0]).slice(0, 4).join(":");
  return createHash("sha256").update(`${SALT}|${ip}`).digest("hex").slice(0, 32);
}

const cleanName = (name) => (typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX) : "");

function parseEntry(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

export default async function handler(req, res) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(200).json({ available: false });
  }

  try {
    const net = networkOf(req);

    if (req.method === "POST") {
      const { mac, name, contacts, visible = true } = req.body || {};
      if (!MAC_RE.test(mac)) return res.status(400).json({ error: "invalid mac" });
      const wanted = [...new Set(Array.isArray(contacts) ? contacts : [])]
        .filter(c => MAC_RE.test(c) && c !== mac)
        .slice(0, MAX_CONTACTS);

      const now = Date.now();
      const entry = JSON.stringify({ name: cleanName(name), ts: now });
      const commands = [["SET", devKey(mac), entry, "PX", String(TTL_MS)]];
      if (net) {
        commands.push(visible ? ["HSET", netKey(net), mac, entry] : ["HDEL", netKey(net), mac]);
        commands.push(["PEXPIRE", netKey(net), String(TTL_MS)]);
        commands.push(["HGETALL", netKey(net)]);
      }
      if (wanted.length) commands.push(["MGET", ...wanted.map(devKey)]);

      const results = await pipeline(commands);
      const netAll = net ? results[3] || [] : [];
      const contactVals = wanted.length ? results[results.length - 1] || [] : [];

      const nearby = [];
      const stale = [];
      for (let i = 0; i < netAll.length; i += 2) {
        const other = netAll[i];
        const e = parseEntry(netAll[i + 1]);
        if (!e || now - e.ts > TTL_MS) { stale.push(other); continue; }
        if (other !== mac) nearby.push({ mac: other, name: e.name, lastSeen: e.ts });
      }
      if (stale.length) await pipeline([["HDEL", netKey(net), ...stale]]);

      const online = [];
      wanted.forEach((other, i) => {
        const e = parseEntry(contactVals[i]);
        if (e) online.push({ mac: other, name: e.name, lastSeen: e.ts });
      });

      return res.status(200).json({ available: true, nearby, online });
    }

    if (req.method === "DELETE") {
      const { mac } = req.body || {};
      if (!MAC_RE.test(mac)) return res.status(400).json({ error: "invalid mac" });
      const commands = [["DEL", devKey(mac)]];
      if (net) commands.push(["HDEL", netKey(net), mac]);
      await pipeline(commands);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: "method not allowed" });
  } catch {
    res.status(200).json({ available: false });
  }
}
