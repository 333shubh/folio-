/**
 * Synthesised UI click, in the spirit of the macOS trackpad/keyboard tick.
 *
 * Generated with Web Audio rather than shipped as a file: it is a few bytes
 * of code instead of an asset, there is nothing to license, and it costs no
 * network request.
 *
 * The tick is a very short filtered noise burst with a fast exponential
 * decay, plus a faint sine "body" an octave down - that combination is what
 * reads as a physical click rather than a beep.
 */

type Variant = "down" | "up";

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let enabled = true;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }

  // Browsers start the context suspended until a gesture resumes it.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function getNoise(context: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === context.sampleRate) {
    return noiseBuffer;
  }
  const length = Math.floor(context.sampleRate * 0.03);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

export function setClickSoundEnabled(on: boolean) {
  enabled = on;
}

export function isClickSoundEnabled() {
  return enabled;
}

/**
 * Press and release are deliberately not identical - the release is quieter
 * and slightly brighter, which is what makes a click feel like one event
 * with two halves rather than two separate noises.
 */
export function playClick(variant: Variant = "down") {
  if (!enabled) return;

  const context = getContext();
  if (!context) return;

  const now = context.currentTime;
  const isDown = variant === "down";

  const gain = context.createGain();
  const peak = isDown ? 0.16 : 0.09;
  const decay = isDown ? 0.028 : 0.02;
  gain.gain.setValueAtTime(peak, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
  gain.connect(context.destination);

  // Filtered noise - the transient.
  const noise = context.createBufferSource();
  noise.buffer = getNoise(context);

  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(isDown ? 2400 : 3200, now);
  band.Q.setValueAtTime(0.9, now);

  const highpass = context.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(900, now);

  noise.connect(band);
  band.connect(highpass);
  highpass.connect(gain);

  // A faint low sine gives the tick some body.
  const body = context.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(isDown ? 620 : 780, now);

  const bodyGain = context.createGain();
  bodyGain.gain.setValueAtTime(peak * 0.35, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + decay * 0.8);
  body.connect(bodyGain);
  bodyGain.connect(context.destination);

  noise.start(now);
  noise.stop(now + decay + 0.01);
  body.start(now);
  body.stop(now + decay + 0.01);
}
