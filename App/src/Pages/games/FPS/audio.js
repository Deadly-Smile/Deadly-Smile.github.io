// ─── Game sounds ────────────────────────────────────────────────────────────
// Everything is synthesised with the Web Audio API (filtered noise bursts and
// tones through envelopes) — no audio files to download. One AudioContext
// per game session, created on the first sound (after the Play click, so
// browsers' autoplay rules are satisfied) and closed on dispose().
//
// Sounds with a position (bot gunfire, explosions, footsteps) go through a
// low-pass filter and a stereo panner set by engine/sound.js from where the
// listener (the player) stands and faces; the player's own sounds play
// centred and unfiltered.
import { spatial } from "./engine/sound.js";

// Per weapon: the sharp crack, the body's thump (a falling sine), and the
// tail (low-passed noise ringing off the surroundings).
const GUNS = {
  rifle: { crack: [2200, 0.09, 0.5], thump: [110, 55, 0.12, 0.35], tail: [900, 0.25, 0.16] },
  smg: { crack: [2600, 0.06, 0.4], thump: [140, 70, 0.08, 0.25], tail: [1000, 0.14, 0.1] },
  sniper: { crack: [1800, 0.12, 0.6], thump: [70, 35, 0.35, 0.6], tail: [700, 0.7, 0.28] },
  shotgun: { crack: [1500, 0.1, 0.55], thump: [80, 40, 0.25, 0.5], tail: [600, 0.45, 0.3] },
  pistol: { crack: [3000, 0.05, 0.45], thump: [160, 80, 0.07, 0.25], tail: [1100, 0.1, 0.1] },
};
const STEP_GAIN = { player: 0.22, bot: 0.5 };

export function createAudio(getVolume) {
  let ac = null;
  let master = null;
  let noiseBuffer = null;
  let listener = { pos: [0, 0, 0], yaw: 0 };

  function ctx() {
    if (!ac) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ac = new Ctx();
      master = ac.createGain();
      master.connect(ac.destination);
      noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    master.gain.value = getVolume();
    return ac;
  }

  // Output for one sound: straight to the master bus, or (with `pos`)
  // through a low-pass and panner placed relative to the listener. Returns
  // null when the sound is too far away (or muted) to bother playing.
  function output(pos, level = 1) {
    if (!ctx() || master.gain.value <= 0) return null;
    const gain = ac.createGain();
    if (!pos) {
      gain.gain.value = level;
      gain.connect(master);
      return gain;
    }
    const s = spatial(listener.pos, listener.yaw, pos);
    if (s.gain <= 0.01) return null;
    gain.gain.value = level * s.gain;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = s.cutoff;
    const pan = ac.createStereoPanner();
    pan.pan.value = s.pan;
    gain.connect(filter).connect(pan).connect(master);
    return gain;
  }

  function envelope(dest, at, peak, attack, decay) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    g.connect(dest);
    return g;
  }

  function burst(dest, at, { freq, q = 1, type = "bandpass", peak = 0.3, attack = 0.003, decay = 0.08, sweepTo }) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, at);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, at + attack + decay);
    filter.Q.value = q;
    src.connect(filter).connect(envelope(dest, at, peak, attack, decay));
    src.start(at, Math.random() * 0.5);
    src.stop(at + attack + decay + 0.02);
  }

  function tone(dest, at, { freq, type = "sine", peak = 0.2, attack = 0.004, decay = 0.12, slideTo }) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + attack + decay);
    osc.connect(envelope(dest, at, peak, attack, decay));
    osc.start(at);
    osc.stop(at + attack + decay + 0.02);
  }

  const now = () => ac.currentTime;

  return {
    setListener(pos, yaw) {
      listener = { pos, yaw };
    },

    // A gunshot; `pos` for someone else's (positioned), none for the player's.
    shot(weaponId, pos = null) {
      const g = GUNS[weaponId];
      const out = g && output(pos, pos ? 1 : 0.8);
      if (!out) return;
      const t = now();
      const [cf, cd, cp] = g.crack;
      const [tf, tt, td, tp] = g.thump;
      const [lf, ld, lp] = g.tail;
      burst(out, t, { freq: cf, q: 0.8, peak: cp, decay: cd });
      tone(out, t, { freq: tf, slideTo: tt, peak: tp, decay: td });
      burst(out, t + 0.01, { freq: lf, type: "lowpass", peak: lp, decay: ld });
    },
    // Knife swing and grenade throw: a swish.
    swish() {
      const out = output(null, 0.6);
      if (out) burst(out, now(), { freq: 600, sweepTo: 2400, q: 1.5, peak: 0.25, attack: 0.02, decay: 0.15 });
    },
    // Magazine out shortly after starting, in shortly before the end.
    reload(duration) {
      const out = output(null, 0.7);
      if (!out) return;
      const t = now();
      burst(out, t + 0.12, { freq: 1800, q: 3, peak: 0.25, decay: 0.04 });
      burst(out, t + Math.max(0.3, duration - 0.3), { freq: 1400, q: 3, peak: 0.3, decay: 0.05 });
      burst(out, t + Math.max(0.35, duration - 0.15), { freq: 2400, q: 4, peak: 0.25, decay: 0.03 });
    },
    empty() {
      const out = output(null, 0.6);
      if (out) burst(out, now(), { freq: 3200, q: 5, peak: 0.25, decay: 0.025 });
    },
    draw() {
      const out = output(null, 0.5);
      if (out) burst(out, now(), { freq: 1200, q: 2, peak: 0.2, decay: 0.05 });
    },
    // A footstep; `pos` for a bot's, none for the player's.
    step(pos = null, quiet = false) {
      const out = output(pos, (pos ? STEP_GAIN.bot : STEP_GAIN.player) * (quiet ? 0.4 : 1));
      if (out) burst(out, now(), { freq: 260 + Math.random() * 120, type: "lowpass", peak: 0.5, decay: 0.07 });
    },
    // The player's shot landed: tick, higher for a headshot, double for a kill.
    hit(kind) {
      const out = output(null, 0.5);
      if (!out) return;
      const t = now();
      tone(out, t, { freq: kind === "head" ? 1900 : 1300, type: "triangle", peak: 0.25, decay: 0.05 });
      if (kind === "kill") tone(out, t + 0.07, { freq: 900, type: "triangle", peak: 0.3, decay: 0.12 });
    },
    hurt() {
      const out = output(null, 0.7);
      if (!out) return;
      const t = now();
      tone(out, t, { freq: 140, slideTo: 60, peak: 0.4, decay: 0.15 });
      burst(out, t, { freq: 500, type: "lowpass", peak: 0.25, decay: 0.08 });
    },
    explosion(pos) {
      const out = output(pos, 1.4);
      if (!out) return;
      const t = now();
      burst(out, t, { freq: 1600, sweepTo: 150, type: "lowpass", peak: 0.8, attack: 0.005, decay: 1.1 });
      tone(out, t, { freq: 60, slideTo: 28, peak: 0.7, decay: 0.6 });
    },
    pickup() {
      const out = output(null, 0.5);
      if (!out) return;
      const t = now();
      tone(out, t, { freq: 660, type: "triangle", peak: 0.2, decay: 0.07 });
      tone(out, t + 0.07, { freq: 990, type: "triangle", peak: 0.2, decay: 0.1 });
    },
    waveStart() {
      const out = output(null, 0.6);
      if (!out) return;
      const t = now();
      for (const [i, f] of [220, 220, 330].entries()) tone(out, t + i * 0.18, { freq: f, type: "sawtooth", peak: 0.12, decay: 0.16 });
    },
    waveCleared() {
      const out = output(null, 0.6);
      if (!out) return;
      const t = now();
      for (const [i, f] of [523, 659, 784].entries()) tone(out, t + i * 0.1, { freq: f, type: "triangle", peak: 0.18, decay: 0.25 });
    },
    death() {
      const out = output(null, 0.7);
      if (out) tone(out, now(), { freq: 300, slideTo: 60, type: "sawtooth", peak: 0.18, decay: 1.1 });
    },
    dispose() {
      ac?.close().catch(() => {});
      ac = null;
    },
  };
}
