/**
 * AudioWorklet processor source for real-time low-latency vocal pitch shifting.
 * Uses dual crossfaded circular delay taps modulated by opposing sawtooth phases
 * (classical SOLA/phase-preserving delay-line pitch shifter) so vocalists hear
 * smooth, glitch-free pitch correction in real time.
 */
export const PITCH_WORKLET_CODE = `
class VoxPitchCorrectorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'pitchRatio', defaultValue: 1.0, minValue: 0.5, maxValue: 2.0, automationRate: 'k-rate' },
      { name: 'wetMix', defaultValue: 1.0, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    this.bufferSize = 8192;
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.phase = 0;
    this.windowSamples = 2048; // ~42ms grain window at 48kHz for warm vocal tone
    this.smoothedRatio = 1.0;
  }

  readInterpolated(delaySamples) {
    let readPos = this.writeIndex - delaySamples;
    while (readPos < 0) readPos += this.bufferSize;
    while (readPos >= this.bufferSize) readPos -= this.bufferSize;

    const idx0 = Math.floor(readPos);
    const idx1 = (idx0 + 1) % this.bufferSize;
    const frac = readPos - idx0;
    return this.buffer[idx0] * (1 - frac) + this.buffer[idx1] * frac;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) {
      return true;
    }

    const inCh = input[0];
    const outCh0 = output[0];
    const outCh1 = output[1];
    const targetRatio = parameters.pitchRatio[0];
    const wetMix = parameters.wetMix[0];

    for (let i = 0; i < inCh.length; i++) {
      const sample = inCh[i];
      this.buffer[this.writeIndex] = sample;

      // Smooth pitch ratio transitions to eliminate zipper noise
      this.smoothedRatio += (targetRatio - this.smoothedRatio) * 0.008;

      const ratioDiff = 1.0 - this.smoothedRatio;
      const phaseInc = ratioDiff / this.windowSamples;
      this.phase += phaseInc;
      if (this.phase >= 1.0) this.phase -= 1.0;
      if (this.phase < 0.0) this.phase += 1.0;

      const phaseA = this.phase;
      const phaseB = (this.phase + 0.5) % 1.0;

      // Raised cosine (Hann) crossfade weights
      const gainA = 0.5 - 0.5 * Math.cos(2 * Math.PI * phaseA);
      const gainB = 0.5 - 0.5 * Math.cos(2 * Math.PI * phaseB);

      const delayA = 64 + phaseA * this.windowSamples;
      const delayB = 64 + phaseB * this.windowSamples;

      const shifted =
        this.readInterpolated(delayA) * gainA +
        this.readInterpolated(delayB) * gainB;

      const outSample = sample * (1.0 - wetMix) + shifted * wetMix;
      outCh0[i] = outSample;
      if (outCh1) {
        outCh1[i] = outSample;
      }

      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    }

    return true;
  }
}

registerProcessor('vox-pitch-corrector', VoxPitchCorrectorProcessor);
`;

export function createPitchWorkletUrl(): string {
  const blob = new Blob([PITCH_WORKLET_CODE], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}
