// ─── Player identities ───────────────────────────────────────────────────────
// Avatar + name pairs handed to bots and offered to humans as a ready-made
// identity (so typing a name is optional). Emoji, not images — nothing to load
// over the network and they render the same on every peer.

export const IDENTITIES = [
  { avatar: "🦊", name: "Sly Fox" },
  { avatar: "🐼", name: "Lazy Panda" },
  { avatar: "🦉", name: "Wise Owl" },
  { avatar: "🐺", name: "Lone Wolf" },
  { avatar: "🦈", name: "Card Shark" },
  { avatar: "🐻", name: "Big Bear" },
  { avatar: "🐯", name: "Tiger" },
  { avatar: "🦁", name: "Lion Heart" },
  { avatar: "🐸", name: "Lucky Frog" },
  { avatar: "🐙", name: "Octo" },
  { avatar: "🦝", name: "Bandit" },
  { avatar: "🐧", name: "Cool Penguin" },
  { avatar: "🦅", name: "Eagle Eye" },
  { avatar: "🐍", name: "Snake Eyes" },
  { avatar: "🦄", name: "Unicorn" },
  { avatar: "🐲", name: "Dragon" },
  { avatar: "🤠", name: "Cowboy" },
  { avatar: "🧙", name: "Wizard" },
  { avatar: "🥷", name: "Ninja" },
  { avatar: "🤖", name: "Robo" },
  { avatar: "👽", name: "Alien" },
  { avatar: "🧛", name: "Count" },
  { avatar: "🐢", name: "Slow Turtle" },
  { avatar: "🐝", name: "Busy Bee" },
];

export const AVATARS = IDENTITIES.map(i => i.avatar);

// A random identity, avoiding any avatar or name already in `taken`
// (an array of { avatar, name }). Falls back to the full pool once exhausted.
export function randomIdentity(taken = [], rng = Math.random) {
  const usedAvatars = new Set(taken.map(t => t.avatar));
  const usedNames = new Set(taken.map(t => t.name));
  const free = IDENTITIES.filter(i => !usedAvatars.has(i.avatar) && !usedNames.has(i.name));
  const pool = free.length ? free : IDENTITIES;
  return { ...pool[Math.floor(rng() * pool.length)] };
}
