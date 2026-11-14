// ─── In-game text chat: the rules the host enforces ─────────────────────────
// Guests send { t: "chat", text, team } on the reliable channel; the host
// cleans the text, applies a per-player rate limit and relays it (see
// hostSim.js's chat()), all-chat to everyone, team chat to the sender's
// team only. Who said it comes from the host's roster, never the message.
// Clients render chat as plain text only, never as HTML.
// Pure: no PeerJS/DOM.

export const CHAT_MAX = 200;          // characters per message
export const CHAT_BURST = 4;          // messages that can be sent at once…
export const CHAT_REFILL_S = 2;       // …then one more every this many seconds
export const TEAM_NAMES = { a: "Blue", b: "Orange" };

// Control characters and invisible "format" ones: zero-width characters and
// bidi overrides, which can make a line read as if someone else wrote it.
const INVISIBLE = /[\p{Cc}\p{Cf}\u2028\u2029]/gu;

// The text as it may be shown, or "" if nothing is left / it isn't text.
export function cleanChat(text) {
  if (typeof text !== "string") return "";
  const clean = text.slice(0, CHAT_MAX * 4).replace(/\s+/g, " ").replace(INVISIBLE, "").replace(/ {2,}/g, " ").trim();
  // By code point, so an emoji is never cut in half.
  return [...clean].slice(0, CHAT_MAX).join("");
}

// A token bucket per player: allow(id, nowMs) says whether a message may go.
export function createRateLimiter({ burst = CHAT_BURST, refillMs = CHAT_REFILL_S * 1000 } = {}) {
  const buckets = new Map(); // id → { tokens, at }
  return {
    allow(id, now) {
      let b = buckets.get(id);
      if (!b) buckets.set(id, b = { tokens: burst, at: now });
      b.tokens = Math.min(burst, b.tokens + Math.max(0, now - b.at) / refillMs);
      b.at = now;
      if (b.tokens < 1) return false;
      b.tokens -= 1;
      return true;
    },
    forget: (id) => buckets.delete(id),
  };
}
