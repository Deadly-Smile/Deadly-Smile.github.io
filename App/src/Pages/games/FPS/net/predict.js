// ─── Guest-side prediction ──────────────────────────────────────────────────
// Waiting for the host to move you (or fire your gun) would make every key
// press feel as late as your ping. Instead the guest acts straight away with
// the same runCommand() the host runs, and remembers each command it sent.
// When a snapshot arrives saying "after your command N this was your state",
// the guest rewinds to that state and replays the commands the host hasn't
// seen yet. Normally the result equals what it had already predicted; when
// it doesn't (a lost packet, being shot, a pickup) the position difference
// is returned so the view can ease into the corrected place.
// Pure: no PeerJS/DOM.
import { createPlayer } from "../engine/player.js";
import { CMD_REDUNDANCY } from "./protocol.js";
import { runCommand, setBody, setLoadout, createLoadout } from "./command.js";

const PENDING_MAX = 120; // 2 s of unacknowledged commands; beyond that the link is gone

export function createPredictor(id, spawn, primary) {
  const me = { id, body: createPlayer(spawn), loadout: createLoadout(primary), dead: false };
  let seq = 0;
  let pending = [];  // commands the host hasn't acknowledged yet
  let recent = [];   // the last few sent, for packet redundancy

  return {
    body: me.body,
    loadout: me.loadout,
    // One local tick: act now. `c` is { input, weapon, use, yaw, pitch, view }.
    // Returns the packet of commands to send and what the weapon did.
    step(c, boxes) {
      // Angles as the host will read them (float32), so both sides move alike.
      const cmd = { ...c, seq: ++seq, yaw: Math.fround(c.yaw), pitch: Math.fround(c.pitch) };
      const { yaw, pitch } = c;
      const out = runCommand(me, cmd, boxes);
      me.body.yaw = yaw;
      me.body.pitch = pitch;
      pending.push(cmd);
      if (pending.length > PENDING_MAX) pending.shift();
      recent = [...recent, cmd].slice(-CMD_REDUNDANCY);
      return { packet: recent, events: out.events, kick: out.kick };
    },
    // Apply a snapshot's view of this player. Returns how far (m) the
    // predicted position moved as a result: [dx, dy, dz].
    reconcile(self, ack, boxes) {
      const before = [...me.body.pos];
      const { yaw, pitch } = me.body;
      pending = pending.filter(c => c.seq > ack);
      setBody(me.body, self);
      setLoadout(me.loadout, self.loadout);
      me.dead = self.dead;
      for (const c of pending) runCommand(me, c, boxes);
      me.body.yaw = yaw;
      me.body.pitch = pitch;
      return [me.body.pos[0] - before[0], me.body.pos[1] - before[1], me.body.pos[2] - before[2]];
    },
    pendingCount: () => pending.length,
  };
}
