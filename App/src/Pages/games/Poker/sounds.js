// ─── Table sounds ────────────────────────────────────────────────────────────
// Synthesised with the Web Audio API — no audio files to ship or load. One
// shared AudioContext, created lazily on the first sound (by then the player
// has clicked into a table, which satisfies browser autoplay rules).
let ctx = null;
let noiseBuffer = null;

function audio() {
  if (!ctx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    ctx = new AudioContextClass();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function noise(ac) {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function envelope(ac, at, peak, attack, decay) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(ac.destination);
  return g;
}

// Filtered noise burst — card flicks, shuffles, swishes.
function burst(ac, at, { freq, q = 1, type = "bandpass", peak = 0.3, attack = 0.005, decay = 0.06, sweepTo }) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, at);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, at + attack + decay);
  filter.Q.value = q;
  src.connect(filter).connect(envelope(ac, at, peak, attack, decay));
  src.start(at, Math.random() * 0.5);
  src.stop(at + attack + decay + 0.02);
}

function tone(ac, at, { freq, type = "sine", peak = 0.2, attack = 0.005, decay = 0.15, slideTo }) {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + attack + decay);
  osc.connect(envelope(ac, at, peak, attack, decay));
  osc.start(at);
  osc.stop(at + attack + decay + 0.02);
}

function chipClicks(ac, at, count) {
  for (let i = 0; i < count; i++) {
    const t = at + i * 0.045 + Math.random() * 0.015;
    tone(ac, t, { freq: 2600 + Math.random() * 900, type: "triangle", peak: 0.09, attack: 0.002, decay: 0.035 });
    burst(ac, t, { freq: 5000, q: 4, peak: 0.08, attack: 0.001, decay: 0.025 });
  }
}

const SOUNDS = {
  shuffle: (ac, t) => { for (let i = 0; i < 7; i++) burst(ac, t + i * 0.05, { freq: 2500 + Math.random() * 1500, q: 0.8, peak: 0.18, decay: 0.04 }); },
  card: (ac, t) => burst(ac, t, { freq: 3000, type: "highpass", q: 0.7, peak: 0.25, decay: 0.07 }),
  chips: (ac, t) => chipClicks(ac, t, 3),
  check: (ac, t) => {
    tone(ac, t, { freq: 190, peak: 0.35, decay: 0.08, slideTo: 120 });
    tone(ac, t + 0.12, { freq: 190, peak: 0.3, decay: 0.08, slideTo: 120 });
  },
  fold: (ac, t) => burst(ac, t, { freq: 600, q: 1.2, peak: 0.2, attack: 0.03, decay: 0.22, sweepTo: 2400 }),
  allIn: (ac, t) => {
    tone(ac, t, { freq: 110, type: "sine", peak: 0.5, decay: 0.35, slideTo: 55 });
    chipClicks(ac, t + 0.08, 8);
  },
  myTurn: (ac, t) => {
    tone(ac, t, { freq: 880, peak: 0.15, decay: 0.18 });
    tone(ac, t + 0.12, { freq: 1320, peak: 0.13, decay: 0.3 });
  },
  win: (ac, t) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, t + i * 0.1, { freq: f, type: "triangle", peak: 0.18, decay: 0.3 }));
    chipClicks(ac, t + 0.45, 6);
  },
  lose: (ac, t) => {
    tone(ac, t, { freq: 392, type: "triangle", peak: 0.16, decay: 0.25 });
    tone(ac, t + 0.2, { freq: 311.13, type: "triangle", peak: 0.16, decay: 0.45 });
  },
  pot: (ac, t) => chipClicks(ac, t, 5),
};

// Plays a list of events from soundEvents.diffEvents, staggered slightly so
// simultaneous ones (a card plus your turn) stay distinguishable.
export function playEvents(events) {
  if (!events.length) return;
  try {
    const ac = audio();
    if (!ac) return;
    let t = ac.currentTime + 0.01;
    for (const name of events) {
      SOUNDS[name]?.(ac, t);
      t += 0.12;
    }
  } catch {
    // Sound is decoration — never let it break the table.
  }
}
