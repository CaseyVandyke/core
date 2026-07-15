// Rest-alarm beep, synthesized with the Web Audio API (no audio files).
// Browsers only allow sound after a user gesture, so unlockAudio() must
// be called from a tap/click handler before beep() can make noise.

let ctx;

let speechUnlocked = false;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === "suspended") ctx.resume();

  // iOS also gates text-to-speech behind a user gesture: speaking a
  // silent utterance during a tap unlocks it for later timer-fired alarms
  if (!speechUnlocked && "speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
    speechUnlocked = true;
  }
}

export function beep() {
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

// Spoken alarms via the browser's built-in text-to-speech.
// Note: no speechSynthesis.cancel() before speak — a Safari bug can
// leave the engine permanently silent after cancel().
export function speak(phrase) {
  if (!("speechSynthesis" in window)) return beep();
  const u = new SpeechSynthesisUtterance(phrase);
  u.rate = 1;
  u.volume = 1;
  u.onerror = () => beep(); // fall back if speech is blocked
  speechSynthesis.speak(u);
}

// sound = "beep" or a phrase to say out loud
export function playAlarm(sound) {
  navigator.vibrate?.([200, 100, 200, 100, 200]);
  if (!sound || sound === "beep") beep();
  else speak(sound);
}
