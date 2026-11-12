// ─── Guest-side prediction ──────────────────────────────────────────────────
// Waiting for the host to move you would make every key press feel as late
// as your ping. Instead the guest moves its own player straight away with
// the same stepPlayer() the host runs, and remembers each command it sent.
// When a snapshot arrives saying "after your command N you were here", the
// guest rewinds to that state and replays the commands the host hasn't seen
// yet. Normally the result equals what it had already predicted; when it
// doesn't (a lost packet, a collision the host saw differently) the
// difference is returned so the view can ease into the corrected position.
// Pure: no PeerJS/DOM.
import { createPlayer, stepPlayer } from "../engine/player.js";
import { STEP } from "../engine/loop.js";
import { CMD_REDUNDANCY } from "./protocol.js";
import { setBody } from "./hostSim.js";

const PENDING_MAX = 120; // 2 s of unacknowledged commands; beyond that the link is gone

export function createPredictor(spawn) {
  const body = createPlayer(spawn);
  let seq = 0;
  let pending = [];  // commands the host hasn't acknowledged yet
  let recent = [];   // the last few sent, for packet redundancy

  return {
    body,
    // One local tick: move now, and return the packet of commands to send.
    step(input, yaw, pitch, boxes) {
      const cmd = { seq: ++seq, input, yaw, pitch };
      body.yaw = yaw;
      body.pitch = pitch;
      stepPlayer(body, input, STEP, boxes);
      pending.push(cmd);
      if (pending.length > PENDING_MAX) pending.shift();
      recent = [...recent, cmd].slice(-CMD_REDUNDANCY);
      return recent;
    },
    // Apply a snapshot's view of this player. Returns how far (m) the
    // predicted position moved as a result: [dx, dy, dz].
    reconcile(self, ack, boxes) {
      const before = [...body.pos];
      const { yaw, pitch } = body;
      pending = pending.filter(c => c.seq > ack);
      setBody(body, self);
      for (const c of pending) {
        body.yaw = c.yaw;
        stepPlayer(body, c.input, STEP, boxes);
      }
      body.yaw = yaw;
      body.pitch = pitch;
      return [body.pos[0] - before[0], body.pos[1] - before[1], body.pos[2] - before[2]];
    },
    pendingCount: () => pending.length,
  };
}
