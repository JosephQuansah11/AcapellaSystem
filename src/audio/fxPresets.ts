import type { FxPresetId, Track } from '../types/studio';

export interface FxPresetConfig {
  id: FxPresetId;
  label: string;
  description: string;
  patch: Partial<
    Pick<
      Track,
      | 'fxEnabled'
      | 'reverbSend'
      | 'delayMix'
      | 'delayTimeMs'
      | 'delayFeedback'
      | 'chorusDepth'
      | 'compThreshold'
      | 'compRatio'
      | 'eqLow'
      | 'eqMid'
      | 'eqHigh'
    >
  >;
}

export const FX_PRESETS: FxPresetConfig[] = [
  {
    id: 'clean',
    label: 'Clean Studio',
    description: 'Transparent vocal clarity with gentle compression',
    patch: {
      fxEnabled: true,
      reverbSend: 0.18,
      delayMix: 0,
      delayTimeMs: 140,
      delayFeedback: 0.2,
      chorusDepth: 0,
      compThreshold: -18,
      compRatio: 3,
      eqLow: 0,
      eqMid: 1,
      eqHigh: 2,
    },
  },
  {
    id: 'warm-pop',
    label: 'Warm Pop Vocal',
    description: 'Present midrange, airy top end, polished hall',
    patch: {
      fxEnabled: true,
      reverbSend: 0.34,
      delayMix: 0.16,
      delayTimeMs: 220,
      delayFeedback: 0.28,
      chorusDepth: 0.15,
      compThreshold: -24,
      compRatio: 4.5,
      eqLow: 2,
      eqMid: 3,
      eqHigh: 4,
    },
  },
  {
    id: 'cathedral-choir',
    label: 'Cathedral Choir',
    description: 'Lush ensemble reverb and wide vocal chorus',
    patch: {
      fxEnabled: true,
      reverbSend: 0.68,
      delayMix: 0.2,
      delayTimeMs: 310,
      delayFeedback: 0.35,
      chorusDepth: 0.45,
      compThreshold: -20,
      compRatio: 3.5,
      eqLow: 1,
      eqMid: 0,
      eqHigh: 3,
    },
  },
  {
    id: 'slapback-studio',
    label: 'Slapback Doubler',
    description: 'Tight retro slapback echo for lead harmonies',
    patch: {
      fxEnabled: true,
      reverbSend: 0.22,
      delayMix: 0.38,
      delayTimeMs: 115,
      delayFeedback: 0.18,
      chorusDepth: 0.2,
      compThreshold: -22,
      compRatio: 5,
      eqLow: -1,
      eqMid: 4,
      eqHigh: 3,
    },
  },
  {
    id: 'radio-lofi',
    label: 'Lo-Fi Radio',
    description: 'Focused telephone bandpass warmth with grit',
    patch: {
      fxEnabled: true,
      reverbSend: 0.12,
      delayMix: 0.15,
      delayTimeMs: 165,
      delayFeedback: 0.25,
      chorusDepth: 0.1,
      compThreshold: -28,
      compRatio: 8,
      eqLow: -10,
      eqMid: 7,
      eqHigh: -8,
    },
  },
  {
    id: 'tight-bass',
    label: 'Tight Vocal Bass',
    description: 'Punchy low-end weight with controlled dynamics',
    patch: {
      fxEnabled: true,
      reverbSend: 0.1,
      delayMix: 0,
      delayTimeMs: 120,
      delayFeedback: 0.15,
      chorusDepth: 0,
      compThreshold: -26,
      compRatio: 6,
      eqLow: 6,
      eqMid: 1,
      eqHigh: -3,
    },
  },
];
