type AudioContextConstructor = typeof AudioContext;

interface MusicState {
  context: AudioContext;
  master: GainNode;
  pad: OscillatorNode[];
  interval: number;
  stopped: boolean;
}

let state: MusicState | null = null;

const CHORDS = [
  [110, 164.81, 220],
  [98, 146.83, 196],
  [130.81, 196, 261.63],
  [123.47, 185, 246.94],
];

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  return AudioCtx ? new AudioCtx() : null;
}

function setChord(oscillators: OscillatorNode[], chord: number[], at: number) {
  oscillators.forEach((osc, i) => {
    osc.frequency.cancelScheduledValues(at);
    osc.frequency.exponentialRampToValueAtTime(chord[i], at + 0.7);
  });
}

function playBell(context: AudioContext, destination: AudioNode, frequency: number) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const now = context.currentTime;

  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, now);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2200, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.035, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  osc.start(now);
  osc.stop(now + 1.9);
}

export async function startBackgroundMusic() {
  if (state && !state.stopped) {
    if (state.context.state === "suspended") await state.context.resume();
    return;
  }

  const context = getAudioContext();
  if (!context) return;

  const master = context.createGain();
  const padGain = context.createGain();
  const filter = context.createBiquadFilter();
  const delay = context.createDelay();
  const feedback = context.createGain();
  const now = context.currentTime;

  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.055, now + 1.4);
  padGain.gain.setValueAtTime(0.11, now);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(760, now);
  delay.delayTime.setValueAtTime(0.42, now);
  feedback.gain.setValueAtTime(0.28, now);

  padGain.connect(filter);
  filter.connect(master);
  filter.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(master);
  master.connect(context.destination);

  const pad = CHORDS[0].map((frequency, i) => {
    const osc = context.createOscillator();
    osc.type = i === 1 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(frequency, now);
    osc.detune.setValueAtTime((i - 1) * 5, now);
    osc.connect(padGain);
    osc.start(now);
    return osc;
  });

  let step = 0;
  const interval = window.setInterval(() => {
    if (!state || state.stopped) return;
    const chord = CHORDS[step % CHORDS.length];
    setChord(pad, chord, context.currentTime);
    if (step % 2 === 0) {
      playBell(context, master, chord[2] * 2);
    }
    step += 1;
  }, 2600);

  state = { context, master, pad, interval, stopped: false };
  if (context.state === "suspended") await context.resume();
}

export function stopBackgroundMusic() {
  if (!state || state.stopped) return;

  const current = state;
  const now = current.context.currentTime;
  current.stopped = true;
  window.clearInterval(current.interval);
  current.master.gain.cancelScheduledValues(now);
  current.master.gain.setValueAtTime(Math.max(current.master.gain.value, 0.0001), now);
  current.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

  window.setTimeout(() => {
    current.pad.forEach((osc) => {
      osc.stop();
    });
    void current.context.close();
    if (state === current) state = null;
  }, 520);
}
