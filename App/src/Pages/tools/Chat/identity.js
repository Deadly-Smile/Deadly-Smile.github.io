// Device identity — pure helpers, no browser APIs (see auth.js for the keys).
//
// Browsers can't read the real MAC address, so each device gets a stable
// 48-bit id shown in MAC notation. It is derived from the device's public key
// (auth.js `macFromPublicKey`), which lets a peer prove it owns the id it
// connects with. Internally the id is 12 lowercase hex chars ("a43f9c127ed0");
// PeerJS ids can't contain ":", so the colon form is display-only.

const MAC_RE = /^[0-9a-f]{12}$/;
const PEER_PREFIX = "dsc-";

export function isMac(value) {
  return typeof value === "string" && MAC_RE.test(value);
}

// Accepts "A4:3F:9C:12:7E:D0", "a4-3f-…", "a43f9c127ed0" or a peer id.
export function parseMac(input) {
  if (typeof input !== "string") return null;
  let s = input.trim().toLowerCase();
  if (s.startsWith(PEER_PREFIX)) s = s.slice(PEER_PREFIX.length);
  s = s.replace(/[:\-\s.]/g, "");
  return isMac(s) ? s : null;
}

export function formatMac(mac) {
  return isMac(mac) ? mac.toUpperCase().match(/../g).join(":") : "??:??:??:??:??:??";
}

export const peerIdFor = (mac) => PEER_PREFIX + mac;

export function macFromPeerId(peerId) {
  return typeof peerId === "string" && peerId.startsWith(PEER_PREFIX) ? parseMac(peerId) : null;
}

// Real random MACs set the "locally administered" bit and clear the
// multicast bit in the first byte — done here too so the id reads as one.
export function macFromBytes(bytes) {
  const b = Array.from(bytes.slice(0, 6));
  b[0] = (b[0] & 0xfc) | 0x02;
  return b.map(x => x.toString(16).padStart(2, "0")).join("");
}

const ADJECTIVES = [
  "Sleepy", "Brave", "Quiet", "Swift", "Lucky", "Clever", "Fuzzy", "Mellow",
  "Rusty", "Sunny", "Witty", "Bold", "Calm", "Daring", "Gentle", "Jolly",
];
const ANIMALS = [
  "Otter", "Falcon", "Panda", "Fox", "Koala", "Lynx", "Heron", "Badger",
  "Gecko", "Moose", "Raven", "Tiger", "Walrus", "Yak", "Bison", "Puffin",
];

export function randomName(rand = Math.random) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  return `${pick(ADJECTIVES)}-${pick(ANIMALS)}`;
}

export const NAME_MAX = 32;

export function cleanName(name) {
  return typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX) : "";
}
