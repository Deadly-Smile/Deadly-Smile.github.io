// Client for /api/presence — who is online, and who shares this device's
// network (same public IP). Best-effort like the room directory: if the
// endpoint is missing or Upstash isn't configured, `available` is false and
// the chat falls back to connecting by ID/QR with status "unknown".

export const PRESENCE_INTERVAL_MS = 20000;

// One call both announces this device and returns what it can see.
// `visible: false` keeps it out of the same-network list (contacts asking
// for it by MAC still see it online).
export async function heartbeat({ mac, name, contacts, visible }) {
  try {
    const res = await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mac, name, contacts, visible }),
    });
    const body = await res.json();
    if (!body.available) return { available: false, nearby: [], online: [] };
    return { available: true, nearby: body.nearby ?? [], online: body.online ?? [] };
  } catch {
    return { available: false, nearby: [], online: [] };
  }
}

// keepalive lets this outlive the page on pagehide.
export function goOffline(mac) {
  try {
    fetch("/api/presence", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mac }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* best-effort */ }
}
