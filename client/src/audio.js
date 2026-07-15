// Rest-alarm sounds. Beep is synthesized with the Web Audio API; spoken
// phrases use the browser's text-to-speech. Browsers only allow sound
// after a user gesture, so unlockAudio() must be called from a tap/click
// handler before either can make noise from a timer.

let ctx;
let speechUnlocked = false;

// iOS loads voices lazily; ask early and cache when they arrive
let voices = [];
function loadVoices() {
  if ("speechSynthesis" in window) voices = speechSynthesis.getVoices();
}
if ("speechSynthesis" in window) {
  loadVoices();
  speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === "suspended") ctx.resume();

  // iOS also gates text-to-speech behind a user gesture: speaking an
  // empty utterance during a tap unlocks it for timer-fired alarms.
  // (Full volume — iOS can leak a muted first utterance's volume into
  // later ones.)
  if (!speechUnlocked && "speechSynthesis" in window) {
    speechSynthesis.resume();
    speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    speechUnlocked = true;
    loadVoices();
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
// Defensive against iOS quirks: resume a possibly-paused engine, pick an
// English voice explicitly, and beep instead if speech never starts.
export function speak(phrase) {
  if (!("speechSynthesis" in window)) return beep();

  speechSynthesis.resume();
  const u = new SpeechSynthesisUtterance(phrase);
  u.lang = "en-US";
  u.rate = 1;
  u.volume = 1;
  const en =
    voices.find((v) => v.lang?.startsWith("en") && v.default) ||
    voices.find((v) => v.lang?.startsWith("en")) ||
    voices[0];
  if (en) u.voice = en;

  let started = false;
  u.onstart = () => { started = true; };
  u.onerror = () => { if (!started) beep(); };
  setTimeout(() => { if (!started) beep(); }, 1200);

  speechSynthesis.speak(u);
}

// sound = "beep" or a phrase to say out loud
export function playAlarm(sound) {
  navigator.vibrate?.([200, 100, 200, 100, 200]);
  if (!sound || sound === "beep") beep();
  else speak(sound);
}
