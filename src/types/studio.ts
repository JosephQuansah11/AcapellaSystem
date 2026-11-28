export type MusicalKey =
  | 'C'
  | 'C#'
  | 'D'
  | 'D#'
  | 'E'
  | 'F'
  | 'F#'
  | 'G'
  | 'G#'
  | 'A'
  | 'A#'
  | 'B';

export type ScaleType =
  | 'Chromatic'
  | 'Major'
  | 'Natural Minor'
  | 'Pentatonic Major'
  | 'Pentatonic Minor'
  | 'Harmonic Minor';

export type CollageLayout = 'grid-2x2' | 'spotlight' | 'columns' | 'cinema-strip' | 'duet';

export type AspectRatio = '16:9' | '9:16' | '1:1';

export type ExportFormat = 'video-webm' | 'video-mp4' | 'audio-wav';

export type ExportResolution = '1080p' | '720p';

export type FxPresetId =
  | 'clean'
  | 'warm-pop'
  | 'cathedral-choir'
  | 'slapback-studio'
  | 'radio-lofi'
  | 'tight-bass'
  | 'custom';

export interface PitchSettings {
  enabled: boolean;
  key: MusicalKey;
  scale: ScaleType;
  retuneSpeed: number; // 0 (gentle/natural) to 100 (hard snap)
  humanize: number; // 0 to 100
  monitorCorrected: boolean;
}

export interface LivePitchReading {
  frequency: number; // Hz, 0 if unvoiced
  targetFrequency: number; // Hz snapped to scale
  noteName: string; // e.g. "C4" or "—"
  targetNoteName: string;
  cents: number; // -50 to +50
  confidence: number; // 0 to 1
  shiftRatio: number; // target / detected
}

export interface Track {
  id: string;
  name: string;
  singerName: string;
  role: 'Lead' | 'Harmony High' | 'Harmony Mid' | 'Bass' | 'Beatbox' | 'Layer';
  color: string;
  muted: boolean;
  solo: boolean;
  armed: boolean;
  volume: number; // 0 to 1.5
  pan: number; // -1 to 1

  // Editable Vocal FX Chain (BandLab-style)
  fxPreset: FxPresetId;
  fxEnabled: boolean;
  reverbSend: number; // 0 to 1
  delayMix: number; // 0 to 0.8
  delayTimeMs: number; // 60 to 450
  delayFeedback: number; // 0 to 0.65
  chorusDepth: number; // 0 to 1
  compThreshold: number; // -40 to 0 dB
  compRatio: number; // 1 to 12
  eqLow: number; // -12 to +12 dB
  eqMid: number; // -12 to +12 dB
  eqHigh: number; // -12 to +12 dB

  // Editable Clip Audio Properties
  clipGainDb: number; // -12 to +12 dB
  semitoneShift: number; // -12 to +12
  centsDetune: number; // -50 to +50
  trimStartSec: number; // non-destructive start trim inside audioBuffer
  trimEndSec: number; // non-destructive end trim (0 = full duration)
  fadeInSec: number; // 0 to 3
  fadeOutSec: number; // 0 to 3
  reversed: boolean;

  pitchCorrectTake: boolean;
  offsetSec: number; // timeline placement offset in seconds
  durationSec: number; // full underlying audioBuffer duration
  audioBuffer: AudioBuffer | null;
  waveformPeaks: number[];
  videoUrl: string | null;
  videoBlob: Blob | null;
  isDemoSynthetic?: boolean;
  demoHue?: number;
  demoNotes?: { startBeat: number; durationBeats: number; midi: number; syllable: string }[];
  liveLevel: number; // 0 to 1 for UI meter
}

export interface LoopRegion {
  enabled: boolean;
  startSec: number;
  endSec: number;
}

export interface ExportResult {
  blob: Blob;
  url: string;
  filename: string;
  format: ExportFormat;
  durationSec: number;
  sizeBytes: number;
}

export interface ProjectMeta {
  id: string;
  title: string;
  bpm: number;
  timeSignatureNumerator: number;
  metronomeEnabled: boolean;
  countInBars: number;
  latencyOffsetMs: number;
}

export interface StudioSnapshot {
  tracks: Track[];
  project: ProjectMeta;
  pitchSettings: PitchSettings;
  loop: LoopRegion;
  layout: CollageLayout;
  aspectRatio: AspectRatio;
}

export interface SavedProjectSummary {
  id: string;
  title: string;
  bpm: number;
  musicalKey: MusicalKey;
  trackCount: number;
  updatedAt: number;
}
