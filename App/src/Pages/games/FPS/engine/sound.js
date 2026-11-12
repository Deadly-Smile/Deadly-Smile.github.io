// ─── Where a sound seems to come from ───────────────────────────────────────
// Turns a sound source's position, relative to the listener (the player's
// position and facing), into the three things the synthesiser varies:
//   gain    quieter with distance (inverse-distance, past REF_DISTANCE)
//   pan     -1 hard left … 1 hard right, by direction
//   cutoff  low-pass frequency (Hz): far and behind sounds are duller,
//           which is most of what tells "behind" from "ahead" on headphones
// Pure: no Web Audio here (that's audio.js).
import { relativeAngle } from "./hud.js";

export const REF_DISTANCE = 4;      // m within which a sound plays at full level
export const MAX_DISTANCE = 70;     // m beyond which it isn't played at all
const OPEN_CUTOFF = 18000;          // Hz: no filtering
const FAR_CUTOFF = 1800;            // Hz at MAX_DISTANCE
const BEHIND_CUTOFF = 0.45;         // fraction of the cutoff left for a sound right behind

export function spatial(listenerPos, listenerYaw, sourcePos) {
  const d = Math.hypot(sourcePos[0] - listenerPos[0], sourcePos[1] - listenerPos[1], sourcePos[2] - listenerPos[2]);
  if (d > MAX_DISTANCE) return { gain: 0, pan: 0, cutoff: FAR_CUTOFF, distance: d };
  const angle = relativeAngle(listenerPos, listenerYaw, sourcePos);
  const gain = d <= REF_DISTANCE ? 1 : REF_DISTANCE / d;
  // Close sounds aren't hard-panned (they'd sound like they're in one ear).
  const pan = Math.sin(angle) * Math.min(1, d / REF_DISTANCE) * 0.85;
  const far = Math.min(1, d / MAX_DISTANCE);
  const behind = (1 - Math.cos(angle)) / 2; // 0 ahead … 1 behind
  const cutoff = (OPEN_CUTOFF * (1 - far) + FAR_CUTOFF * far) * (1 - behind * (1 - BEHIND_CUTOFF));
  return { gain, pan, cutoff, distance: d };
}
