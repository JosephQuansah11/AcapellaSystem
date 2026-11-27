import type { LivePitchReading, MusicalKey, ScaleType } from '../types/studio';

export const NOTE_NAMES: MusicalKey[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

export const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  Major: [0, 2, 4, 5, 7, 9, 11],
  'Natural Minor': [0, 2, 3, 5, 7, 8, 10],
  'Pentatonic Major': [0, 2, 4, 7, 9],
  'Pentatonic Minor': [0, 3, 5, 7, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
};

export function frequencyToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToNoteName(midiRounded: number): string {
  const noteIdx = ((midiRounded % 12) + 12) % 12;
  const octave = Math.floor(midiRounded / 12) - 1;
  return `${NOTE_NAMES[noteIdx]}${octave}`;
}

export function getScaleMidiNotes(key: MusicalKey, scale: ScaleType): Set<number> {
  const rootIndex = NOTE_NAMES.indexOf(key);
  const intervals = SCALE_INTERVALS[scale];
  return new Set(intervals.map((interval) => (rootIndex + interval) % 12));
}

export function snapFrequencyToScale(
  freq: number,
  key: MusicalKey,
  scale: ScaleType,
  retuneSpeed: number,
  humanize: number
): {
  targetFrequency: number;
  detectedNoteName: string;
  targetNoteName: string;
  cents: number;
  shiftRatio: number;
} {
  if (freq <= 0) {
    return {
      targetFrequency: 0,
      detectedNoteName: '—',
      targetNoteName: '—',
      cents: 0,
      shiftRatio: 1,
    };
  }

  const exactMidi = frequencyToMidi(freq);
  const nearestMidi = Math.round(exactMidi);
  const cents = Math.round((exactMidi - nearestMidi) * 100);
  const detectedNoteName = midiToNoteName(nearestMidi);

  const allowedPitchClasses = getScaleMidiNotes(key, scale);

  // Search nearest allowed MIDI note within +/- 6 semitones
  let bestMidi = nearestMidi;
  let minDistance = Infinity;
  for (let candidate = Math.floor(exactMidi) - 6; candidate <= Math.ceil(exactMidi) + 6; candidate++) {
    const pitchClass = ((candidate % 12) + 12) % 12;
    if (allowedPitchClasses.has(pitchClass)) {
      const dist = Math.abs(exactMidi - candidate);
      if (dist < minDistance) {
        minDistance = dist;
        bestMidi = candidate;
      }
    }
  }

  const idealFreq = midiToFrequency(bestMidi);
  const targetNoteName = midiToNoteName(bestMidi);

  // Apply retune speed and humanize blend
  const correctionStrength = Math.max(0, Math.min(1, (retuneSpeed / 100) * (1 - (humanize / 100) * 0.45)));
  const targetFrequency = freq + (idealFreq - freq) * correctionStrength;
  const shiftRatio = Math.max(0.5, Math.min(2.0, targetFrequency / freq));

  return {
    targetFrequency,
    detectedNoteName,
    targetNoteName,
    cents,
    shiftRatio,
  };
}

/**
 * YIN-inspired fundamental frequency detector tuned for human vocals (75Hz - 1050Hz).
 */
export function detectPitchYIN(
  buffer: Float32Array,
  sampleRate: number,
  key: MusicalKey,
  scale: ScaleType,
  retuneSpeed: number,
  humanize: number
): LivePitchReading {
  const n = buffer.length;
  // RMS gate to avoid noise jitter during silence
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    sumSq += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSq / n);
  if (rms < 0.012) {
    return {
      frequency: 0,
      targetFrequency: 0,
      noteName: '—',
      targetNoteName: '—',
      cents: 0,
      confidence: 0,
      shiftRatio: 1,
    };
  }

  const halfSize = Math.floor(n / 2);
  const minTau = Math.max(20, Math.floor(sampleRate / 1050));
  const maxTau = Math.min(halfSize - 2, Math.floor(sampleRate / 70));

  const diff = new Float32Array(maxTau + 1);
  for (let tau = minTau; tau <= maxTau; tau++) {
    let deltaSum = 0;
    for (let i = 0; i < halfSize; i++) {
      const d = buffer[i] - buffer[i + tau];
      deltaSum += d * d;
    }
    diff[tau] = deltaSum;
  }

  // Cumulative mean normalized difference
  const cmnd = new Float32Array(maxTau + 1);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
  }

  // Absolute threshold
  const threshold = 0.18;
  let tauEstimate = -1;
  for (let tau = minTau; tau < maxTau; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 < maxTau && cmnd[tau + 1] < cmnd[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  // Fallback to minimum if no threshold hit
  if (tauEstimate === -1) {
    let bestTau = minTau;
    let bestVal = cmnd[minTau];
    for (let tau = minTau + 1; tau < maxTau; tau++) {
      if (cmnd[tau] < bestVal) {
        bestVal = cmnd[tau];
        bestTau = tau;
      }
    }
    if (bestVal > 0.35) {
      return {
        frequency: 0,
        targetFrequency: 0,
        noteName: '—',
        targetNoteName: '—',
        cents: 0,
        confidence: 0,
        shiftRatio: 1,
      };
    }
    tauEstimate = bestTau;
  }

  // Parabolic interpolation for sub-sample precision
  const x0 = tauEstimate > minTau ? cmnd[tauEstimate - 1] : cmnd[tauEstimate];
  const x1 = cmnd[tauEstimate];
  const x2 = tauEstimate + 1 <= maxTau ? cmnd[tauEstimate + 1] : cmnd[tauEstimate];
  const denom = 2 * (2 * x1 - x2 - x0);
  const betterTau = denom !== 0 ? tauEstimate + (x2 - x0) / denom : tauEstimate;

  const frequency = sampleRate / betterTau;
  const confidence = Math.max(0, Math.min(1, 1 - x1));
  const snapped = snapFrequencyToScale(frequency, key, scale, retuneSpeed, humanize);

  return {
    frequency,
    targetFrequency: snapped.targetFrequency,
    noteName: snapped.detectedNoteName,
    targetNoteName: snapped.targetNoteName,
    cents: snapped.cents,
    confidence,
    shiftRatio: snapped.shiftRatio,
  };
}
