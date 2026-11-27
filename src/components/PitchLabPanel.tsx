import React, { useState } from 'react';
import { Headphones, Mic, Sliders, Sparkles } from 'lucide-react';
import { getScaleMidiNotes, NOTE_NAMES } from '../audio/pitchUtils';
import type {
  LivePitchReading,
  MusicalKey,
  PitchSettings,
  ScaleType,
  Track,
} from '../types/studio';

interface PitchLabPanelProps {
  pitchSettings: PitchSettings;
  onUpdatePitchSettings: (patch: Partial<PitchSettings>) => void;
  livePitch: LivePitchReading;
  micLevel: number;
  selectedTrack: Track | undefined;
  onUpdateTrack: (id: string, patch: Partial<Track>) => void;
  latencyOffsetMs: number;
  onUpdateLatencyOffset: (ms: number) => void;
}

export const PitchLabPanel: React.FC<PitchLabPanelProps> = ({
  pitchSettings,
  onUpdatePitchSettings,
  livePitch,
  micLevel,
  selectedTrack,
  onUpdateTrack,
  latencyOffsetMs,
  onUpdateLatencyOffset,
}) => {
  const [tab, setTab] = useState<'pitch' | 'mix'>('pitch');
  const allowedNotes = getScaleMidiNotes(pitchSettings.key, pitchSettings.scale);

  const detectedPitchClass = livePitch.noteName !== '—' ? livePitch.noteName.replace(/\d+$/, '') : '';
  const targetPitchClass =
    livePitch.targetNoteName !== '—' ? livePitch.targetNoteName.replace(/\d+$/, '') : '';

  // Clamp cents meter between -50 and +50
  const centsClamped = Math.max(-50, Math.min(50, livePitch.cents));
  const meterPercent = 50 + centsClamped; // 0 to 100

  return (
    <aside className="w-full lg:w-[356px] shrink-0 bg-[#10151F] flex flex-col border-t lg:border-t-0 border-white/8">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-2 border-b border-white/8 bg-[#0D1119]">
        <button
          type="button"
          onClick={() => setTab('pitch')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            tab === 'pitch'
              ? 'bg-[#1D2535] text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>Pitch Correction</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('mix')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            tab === 'mix'
              ? 'bg-[#1D2535] text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-rose-400" />
          <span>Vocal Mix &amp; FX</span>
        </button>
      </div>

      {tab === 'pitch' ? (
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Master Real-Time Pitch Correction Switch */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Real-Time Pitch Correction</h2>
              <p className="text-xs text-slate-400">Live scale lock on armed mic input</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdatePitchSettings({ enabled: !pitchSettings.enabled })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                pitchSettings.enabled
                  ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                  : 'bg-[#1B2230] text-slate-300 border border-white/10 hover:text-white'
              }`}
            >
              {pitchSettings.enabled ? 'Active' : 'Bypassed'}
            </button>
          </div>

          {/* Live Pitch Tuner Readout */}
          <div className="p-3.5 rounded-xl bg-[#090C12] border border-white/8 space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[11px] text-slate-400">Detected Note</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-bold font-mono text-white tabular-nums">
                    {livePitch.noteName}
                  </span>
                  {pitchSettings.enabled && livePitch.targetNoteName !== '—' && (
                    <span className="text-xs font-mono text-sky-400 tabular-nums">
                      → {livePitch.targetNoteName}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-mono text-slate-300 tabular-nums">
                  {livePitch.frequency > 0 ? `${livePitch.frequency.toFixed(1)} Hz` : '0.0 Hz'}
                </div>
                <div
                  className={`text-xs font-mono tabular-nums ${
                    Math.abs(livePitch.cents) <= 10 && livePitch.frequency > 0
                      ? 'text-emerald-400'
                      : livePitch.frequency > 0
                        ? 'text-amber-400'
                        : 'text-slate-500'
                  }`}
                >
                  {livePitch.frequency > 0
                    ? `${livePitch.cents >= 0 ? '+' : ''}${livePitch.cents}¢`
                    : 'Waiting for voice'}
                </div>
              </div>
            </div>

            {/* Cents Deviation Precision Gauge */}
            <div className="relative h-2.5 bg-[#161C28] rounded-full overflow-hidden">
              {/* Center target marker */}
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/40 z-10 -translate-x-1/2" />
              {livePitch.frequency > 0 && (
                <div
                  className={`absolute top-0 bottom-0 w-2.5 rounded-full -translate-x-1/2 transition-all duration-75 ${
                    Math.abs(livePitch.cents) <= 10 ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                  style={{ left: `${meterPercent}%` }}
                />
              )}
            </div>

            {/* Mic Input Level */}
            <div className="flex items-center gap-2 pt-1">
              <Mic className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="flex-1 h-1.5 bg-[#161C28] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-slate-400 w-9 text-right tabular-nums">
                {Math.round(micLevel * 100)}%
              </span>
            </div>
          </div>

          {/* Key & Scale Selection */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Musical Key</span>
              <select
                value={pitchSettings.key}
                onChange={(e) => onUpdatePitchSettings({ key: e.target.value as MusicalKey })}
                className="w-full bg-[#161C28] text-slate-100 border border-white/10 rounded-lg px-2.5 py-2 text-xs outline-none cursor-pointer"
              >
                {NOTE_NAMES.map((k) => (
                  <option key={k} value={k}>
                    Key of {k}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Scale Lock</span>
              <select
                value={pitchSettings.scale}
                onChange={(e) => onUpdatePitchSettings({ scale: e.target.value as ScaleType })}
                className="w-full bg-[#161C28] text-slate-100 border border-white/10 rounded-lg px-2.5 py-2 text-xs outline-none cursor-pointer"
              >
                <option value="Major">Major</option>
                <option value="Natural Minor">Natural Minor</option>
                <option value="Chromatic">Chromatic</option>
                <option value="Pentatonic Major">Pentatonic Major</option>
                <option value="Pentatonic Minor">Pentatonic Minor</option>
                <option value="Harmonic Minor">Harmonic Minor</option>
              </select>
            </label>
          </div>

          {/* Interactive 12-Tone Scale Note Strip */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Active Scale Notes</span>
              <span className="text-slate-500 font-mono">
                {pitchSettings.key} {pitchSettings.scale}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {NOTE_NAMES.map((note, idx) => {
                const inScale = allowedNotes.has(idx);
                const isTarget = targetPitchClass === note;
                const isDetected = detectedPitchClass === note;
                return (
                  <div
                    key={note}
                    className={`py-1.5 text-center rounded text-xs font-mono font-medium border transition-colors ${
                      isTarget
                        ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                        : isDetected
                          ? 'bg-amber-500/25 text-amber-200 border-amber-400/50'
                          : inScale
                            ? 'bg-[#182030] text-slate-200 border-white/12'
                            : 'bg-[#0C1018] text-slate-600 border-white/5'
                    }`}
                  >
                    {note}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Retune Speed & Humanize Sliders */}
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Retune Speed</span>
                <span className="font-mono text-slate-400 tabular-nums">
                  {pitchSettings.retuneSpeed}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={pitchSettings.retuneSpeed}
                onChange={(e) => onUpdatePitchSettings({ retuneSpeed: Number(e.target.value) })}
                className="w-full studio-slider"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Natural Vibrato / Humanize</span>
                <span className="font-mono text-slate-400 tabular-nums">
                  {pitchSettings.humanize}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={pitchSettings.humanize}
                onChange={(e) => onUpdatePitchSettings({ humanize: Number(e.target.value) })}
                className="w-full studio-slider"
              />
            </div>
          </div>

          {/* Headphone Monitor Toggle */}
          <div className="pt-2 border-t border-white/8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Headphones className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-200 truncate">
                  Headphone Monitoring
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  Hear tuned voice while singing
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdatePitchSettings({ monitorCorrected: !pitchSettings.monitorCorrected })
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                pitchSettings.monitorCorrected
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-[#1B2230] text-slate-400 border border-white/10'
              }`}
            >
              {pitchSettings.monitorCorrected ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {selectedTrack ? (
            <>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: selectedTrack.color }}
                  />
                  <span className="text-xs font-semibold text-slate-300">
                    Selected Layer · {selectedTrack.role}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-[11px] text-slate-400">Singer Name</span>
                    <input
                      type="text"
                      value={selectedTrack.singerName}
                      onChange={(e) =>
                        onUpdateTrack(selectedTrack.id, { singerName: e.target.value })
                      }
                      className="w-full bg-[#161C28] text-slate-100 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-sky-400"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] text-slate-400">Part Label</span>
                    <input
                      type="text"
                      value={selectedTrack.name}
                      onChange={(e) => onUpdateTrack(selectedTrack.id, { name: e.target.value })}
                      className="w-full bg-[#161C28] text-slate-100 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-sky-400"
                    />
                  </label>
                </div>
              </div>

              {/* Channel Fader, Pan & Reverb */}
              <div className="space-y-3 pt-2 border-t border-white/8">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Vocal Gain</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {Math.round(selectedTrack.volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1.4}
                    step={0.02}
                    value={selectedTrack.volume}
                    onChange={(e) =>
                      onUpdateTrack(selectedTrack.id, { volume: Number(e.target.value) })
                    }
                    className="w-full studio-slider"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Stereo Pan</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {selectedTrack.pan === 0
                        ? 'Center'
                        : selectedTrack.pan < 0
                          ? `L ${Math.round(Math.abs(selectedTrack.pan) * 50)}`
                          : `R ${Math.round(selectedTrack.pan * 50)}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={selectedTrack.pan}
                    onChange={(e) =>
                      onUpdateTrack(selectedTrack.id, { pan: Number(e.target.value) })
                    }
                    className="w-full studio-slider"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Hall Reverb Send</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {Math.round(selectedTrack.reverbSend * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={selectedTrack.reverbSend}
                    onChange={(e) =>
                      onUpdateTrack(selectedTrack.id, { reverbSend: Number(e.target.value) })
                    }
                    className="w-full studio-slider"
                  />
                </div>
              </div>

              {/* 3-Band Vocal EQ */}
              <div className="space-y-3 pt-2 border-t border-white/8">
                <div className="text-xs font-semibold text-slate-300">3-Band Vocal EQ</div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Low Warmth (160 Hz)</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {selectedTrack.eqLow > 0 ? '+' : ''}
                      {selectedTrack.eqLow} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={selectedTrack.eqLow}
                    onChange={(e) =>
                      onUpdateTrack(selectedTrack.id, { eqLow: Number(e.target.value) })
                    }
                    className="w-full studio-slider"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Presence (1.2 kHz)</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {selectedTrack.eqMid > 0 ? '+' : ''}
                      {selectedTrack.eqMid} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={selectedTrack.eqMid}
                    onChange={(e) =>
                      onUpdateTrack(selectedTrack.id, { eqMid: Number(e.target.value) })
                    }
                    className="w-full studio-slider"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Vocal Air (4.5 kHz)</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {selectedTrack.eqHigh > 0 ? '+' : ''}
                      {selectedTrack.eqHigh} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={selectedTrack.eqHigh}
                    onChange={(e) =>
                      onUpdateTrack(selectedTrack.id, { eqHigh: Number(e.target.value) })
                    }
                    className="w-full studio-slider"
                  />
                </div>
              </div>

              {/* Alignment & Latency Compensation */}
              <div className="space-y-3 pt-2 border-t border-white/8">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Take Alignment Nudge</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {Math.round(selectedTrack.offsetSec * 1000)} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    step={0.02}
                    value={selectedTrack.offsetSec}
                    onChange={(e) =>
                      onUpdateTrack(selectedTrack.id, { offsetSec: Number(e.target.value) })
                    }
                    className="w-full studio-slider"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Input Latency Compensation</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {latencyOffsetMs} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={250}
                    step={5}
                    value={latencyOffsetMs}
                    onChange={(e) => onUpdateLatencyOffset(Number(e.target.value))}
                    className="w-full studio-slider"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 py-8 text-center">
              Select a vocal track to adjust mix and EQ.
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
