// Rest-alarm beep, synthesized with the Web Audio API (no audio files).
// Browsers only allow sound after a user gesture, so unlockAudio() must
// be called from a tap/click handler before beep() can make noise.

let ctx;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
}

export function beep() {
  navigator.vibrate?.([200, 100, 200, 100, 200]);
  if (!ctx || ctx.state !== "running") return;
  const t0 = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const start = t0 + i * 0.35;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.3);
  }
}
