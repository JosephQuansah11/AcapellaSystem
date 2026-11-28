import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Headphones,
  Mic,
  RotateCcw,
  Scissors,
  Sliders,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { FX_PRESETS } from '../audio/fxPresets';
import { getScaleMidiNotes, NOTE_NAMES } from '../audio/pitchUtils';
import type {
  FxPresetId,
  LivePitchReading,
  MusicalKey,
  PitchSettings,
  ScaleType,
  Track,
} from '../types/studio';

export type DockTab = 'fx' | 'clip' | 'autopitch';

interface PitchLabPanelProps {
  activeTab: DockTab;
  onChangeTab: (tab: DockTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  pitchSettings: PitchSettings;
  onUpdatePitchSettings: (patch: Partial<PitchSettings>) => void;
  livePitch: LivePitchReading;
  micLevel: number;
  selectedTrack: Track | undefined;
  onUpdateTrack: (id: string, patch: Partial<Track>) => void;
  onNormalizeTrack: (id: string) => void;
  onReverseTrack: (id: string) => void;
  onSplitTrack: (id: string) => void;
  latencyOffsetMs: number;
  onUpdateLatencyOffset: (ms: number) => void;
}

export const PitchLabPanel: React.FC<PitchLabPanelProps> = ({
  activeTab,
  onChangeTab,
  isCollapsed,
  onToggleCollapse,
  pitchSettings,
  onUpdatePitchSettings,
  livePitch,
  micLevel,
  selectedTrack,
  onUpdateTrack,
  onNormalizeTrack,
  onReverseTrack,
  onSplitTrack,
  latencyOffsetMs,
  onUpdateLatencyOffset,
}) => {
  const allowedNotes = getScaleMidiNotes(pitchSettings.key, pitchSettings.scale);
  const detectedPitchClass =
    livePitch.noteName !== '—' ? livePitch.noteName.replace(/\d+$/, '') : '';
  const targetPitchClass =
    livePitch.targetNoteName !== '—' ? livePitch.targetNoteName.replace(/\d+$/, '') : '';
  const centsClamped = Math.max(-50, Math.min(50, livePitch.cents));
  const meterPercent = 50 + centsClamped;

  const applyPreset = (presetId: FxPresetId) => {
    if (!selectedTrack) return;
    const found = FX_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    onUpdateTrack(selectedTrack.id, {
      fxPreset: presetId,
      ...found.patch,
    });
  };

  return (
    <section className="border-t border-white/10 bg-[#12151D] flex flex-col shrink-0">
      {/* BandLab Bottom Dock Tab Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-[#161922] border-b border-white/8">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 bg-[#0D0F15] rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => {
                onChangeTab('fx');
                if (isCollapsed) onToggleCollapse();
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'fx'
                  ? 'bg-[#222736] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>FX Chain</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onChangeTab('clip');
                if (isCollapsed) onToggleCollapse();
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'clip'
                  ? 'bg-[#222736] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scissors className="w-3.5 h-3.5 text-amber-400" />
              <span>Audio Clip Editor</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onChangeTab('autopitch');
                if (isCollapsed) onToggleCollapse();
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'autopitch'
                  ? 'bg-[#222736] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F14624]" />
              <span>AutoPitch</span>
            </button>
          </div>

          {selectedTrack && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-300 pl-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selectedTrack.color }}
              />
              <span className="font-semibold text-white">{selectedTrack.name}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">{selectedTrack.singerName}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"
        >
          <span>{isCollapsed ? 'Expand Editor' : 'Minimize'}</span>
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="p-4 overflow-x-auto">
          {activeTab === 'fx' && selectedTrack && (
            <div className="space-y-3 min-w-[780px]">
              {/* FX Preset Bar & Master Bypass */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-300">Vocal FX Preset:</span>
                  {FX_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      title={preset.description}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                        selectedTrack.fxPreset === preset.id
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                          : 'bg-[#0D0F15] text-slate-300 border-white/10 hover:border-white/25'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateTrack(selectedTrack.id, { fxEnabled: !selectedTrack.fxEnabled })
                  }
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedTrack.fxEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-[#1B1F2A] text-slate-400 border-white/10'
                  }`}
                >
                  {selectedTrack.fxEnabled ? 'FX Rack Active' : 'FX Bypassed'}
                </button>
              </div>

              {/* BandLab-Style Horizontal FX Rack Modules */}
              <div className="grid grid-cols-5 gap-3">
                {/* Module 1: Dynamics Compressor */}
                <div className="p-3 rounded-xl bg-[#0D0F15] border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-300">Compressor</span>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {selectedTrack.compRatio}:1
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Threshold</span>
                      <span className="font-mono tabular-nums">{selectedTrack.compThreshold} dB</span>
                    </div>
                    <input
                      type="range"
                      min={-40}
                      max={0}
                      step={1}
                      value={selectedTrack.compThreshold}
                      onChange={(e) =>
                        onUpdateTrack(selectedTrack.id, {
                          fxPreset: 'custom',
                          compThreshold: Number(e.target.value),
                        })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Ratio</span>
                      <span className="font-mono tabular-nums">{selectedTrack.compRatio}:1</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      step={0.5}
                      value={selectedTrack.compRatio}
                      onChange={(e) =>
                        onUpdateTrack(selectedTrack.id, {
                          fxPreset: 'custom',
                          compRatio: Number(e.target.value),
                        })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                </div>

                {/* Module 2: 3-Band Vocal EQ */}
                <div className="p-3 rounded-xl bg-[#0D0F15] border border-white/10 space-y-2">
                  <div className="text-xs font-semibold text-sky-300">3-Band EQ</div>
                  {[
                    { label: 'Low', key: 'eqLow' as const, val: selectedTrack.eqLow },
                    { label: 'Mid', key: 'eqMid' as const, val: selectedTrack.eqMid },
                    { label: 'High', key: 'eqHigh' as const, val: selectedTrack.eqHigh },
                  ].map((band) => (
                    <div key={band.key} className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 w-7">{band.label}</span>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        value={band.val}
                        onChange={(e) =>
                          onUpdateTrack(selectedTrack.id, {
                            fxPreset: 'custom',
                            [band.key]: Number(e.target.value),
                          })
                        }
                        className="flex-1 studio-slider"
                      />
                      <span className="text-[11px] font-mono text-slate-300 w-9 text-right tabular-nums">
                        {band.val > 0 ? '+' : ''}
                        {band.val}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Module 3: Studio Delay */}
                <div className="p-3 rounded-xl bg-[#0D0F15] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-300">Echo Delay</span>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {Math.round(selectedTrack.delayMix * 100)}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Mix</span>
                      <span className="font-mono tabular-nums">
                        {Math.round(selectedTrack.delayMix * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={0.8}
                      step={0.02}
                      value={selectedTrack.delayMix}
                      onChange={(e) =>
                        onUpdateTrack(selectedTrack.id, {
                          fxPreset: 'custom',
                          delayMix: Number(e.target.value),
                        })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Time</span>
                      <span className="font-mono tabular-nums">{selectedTrack.delayTimeMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={450}
                      step={5}
                      value={selectedTrack.delayTimeMs}
                      onChange={(e) =>
                        onUpdateTrack(selectedTrack.id, {
                          fxPreset: 'custom',
                          delayTimeMs: Number(e.target.value),
                        })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                </div>

                {/* Module 4: Vocal Chorus & Hall Reverb */}
                <div className="p-3 rounded-xl bg-[#0D0F15] border border-white/10 space-y-2.5">
                  <div className="text-xs font-semibold text-rose-300">Space &amp; Chorus</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Hall Reverb</span>
                      <span className="font-mono tabular-nums">
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
                        onUpdateTrack(selectedTrack.id, {
                          fxPreset: 'custom',
                          reverbSend: Number(e.target.value),
                        })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Vocal Chorus</span>
                      <span className="font-mono tabular-nums">
                        {Math.round(selectedTrack.chorusDepth * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={selectedTrack.chorusDepth}
                      onChange={(e) =>
                        onUpdateTrack(selectedTrack.id, {
                          fxPreset: 'custom',
                          chorusDepth: Number(e.target.value),
                        })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                </div>

                {/* Module 5: Singer Identity & Channel Strip */}
                <div className="p-3 rounded-xl bg-[#0D0F15] border border-white/10 space-y-2">
                  <div className="text-xs font-semibold text-slate-200">Singer &amp; Channel</div>
                  <input
                    type="text"
                    value={selectedTrack.singerName}
                    onChange={(e) =>
                      onUpdateTrack(selectedTrack.id, { singerName: e.target.value })
                    }
                    placeholder="Singer name"
                    className="w-full bg-[#161922] text-slate-100 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-sky-400"
                  />
                  <input
                    type="text"
                    value={selectedTrack.name}
                    onChange={(e) => onUpdateTrack(selectedTrack.id, { name: e.target.value })}
                    placeholder="Vocal part"
                    className="w-full bg-[#161922] text-slate-100 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-sky-400"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'clip' && selectedTrack && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-[740px]">
              {/* Clip Pitch & Gain */}
              <div className="p-3.5 rounded-xl bg-[#0D0F15] border border-white/10 space-y-3">
                <div className="text-xs font-semibold text-white">Pitch Transpose &amp; Gain</div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Semitone Shift</span>
                    <span className="font-mono text-sky-400 tabular-nums">
                      {selectedTrack.semitoneShift > 0 ? '+' : ''}
                      {selectedTrack.semitoneShift} st
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={selectedTrack.semitoneShift}
                    onChange={(e) =>
                      onUpdateTrack(selectedTrack.id, { semitoneShift: Number(e.target.value) })
                    }
                    className="w-full studio-slider"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Fine Tune (Cents)</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {selectedTrack.centsDetune > 0 ? '+' : ''}
                      {selectedTrack.centsDetune}¢
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    step={1}
                    value={selectedTrack.centsDetune}
                    onChange={(e) =>
                      onUpdateTrack(selectedTrack.id, { centsDetune: Number(e.target.value) })
                    }
                    className="w-full studio-slider"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Clip Gain Boost</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {selectedTrack.clipGainDb > 0 ? '+' : ''}
                      {selectedTrack.clipGainDb} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={selectedTrack.clipGainDb}
                    onChange={(e) =>
                      onUpdateTrack(selectedTrack.id, { clipGainDb: Number(e.target.value) })
                    }
                    className="w-full studio-slider"
                  />
                </div>
              </div>

              {/* Trim & Fades */}
              <div className="p-3.5 rounded-xl bg-[#0D0F15] border border-white/10 space-y-3">
                <div className="text-xs font-semibold text-white">Trim Bounds &amp; Fades</div>

                <div className="grid grid-cols-2 gap-2.5">
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400">Trim Start (s)</span>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, (selectedTrack.durationSec || 10) - 0.2)}
                      step={0.1}
                      value={selectedTrack.trimStartSec}
                      onChange={(e) =>
                        onUpdateTrack(selectedTrack.id, {
                          trimStartSec: Math.max(0, Number(e.target.value)),
                        })
                      }
                      className="w-full bg-[#161922] border border-white/10 rounded px-2 py-1 text-xs font-mono text-white outline-none tabular-nums"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400">Trim End (s)</span>
                    <input
                      type="number"
                      min={0}
                      max={selectedTrack.durationSec || 30}
                      step={0.1}
                      value={selectedTrack.trimEndSec || Number(selectedTrack.durationSec.toFixed(1))}
                      onChange={(e) =>
                        onUpdateTrack(selectedTrack.id, {
                          trimEndSec: Math.max(0, Number(e.target.value)),
                        })
                      }
                      className="w-full bg-[#161922] border border-white/10 rounded px-2 py-1 text-xs font-mono text-white outline-none tabular-nums"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Fade In</span>
                      <span className="font-mono tabular-nums">{selectedTrack.fadeInSec}s</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.1}
                      value={selectedTrack.fadeInSec}
                      onChange={(e) =>
                        onUpdateTrack(selectedTrack.id, { fadeInSec: Number(e.target.value) })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Fade Out</span>
                      <span className="font-mono tabular-nums">{selectedTrack.fadeOutSec}s</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.1}
                      value={selectedTrack.fadeOutSec}
                      onChange={(e) =>
                        onUpdateTrack(selectedTrack.id, { fadeOutSec: Number(e.target.value) })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Timeline Alignment Offset</span>
                    <span className="font-mono tabular-nums">
                      {selectedTrack.offsetSec.toFixed(2)} s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    step={0.05}
                    value={selectedTrack.offsetSec}
                    onChange={(e) =>
                      onUpdateTrack(selectedTrack.id, { offsetSec: Number(e.target.value) })
                    }
                    className="w-full studio-slider"
                  />
                </div>
              </div>

              {/* Audio Processing Actions & Latency */}
              <div className="p-3.5 rounded-xl bg-[#0D0F15] border border-white/10 space-y-3">
                <div className="text-xs font-semibold text-white">Audio Processing Tools</div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!selectedTrack.audioBuffer}
                    onClick={() => onNormalizeTrack(selectedTrack.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#1B1F2A] hover:bg-[#252B3B] text-slate-100 border border-white/10 disabled:opacity-40 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Normalize</span>
                  </button>

                  <button
                    type="button"
                    disabled={!selectedTrack.audioBuffer}
                    onClick={() => onReverseTrack(selectedTrack.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#1B1F2A] hover:bg-[#252B3B] text-slate-100 border border-white/10 disabled:opacity-40 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                    <span>Reverse Audio</span>
                  </button>

                  <button
                    type="button"
                    disabled={!selectedTrack.audioBuffer}
                    onClick={() => onSplitTrack(selectedTrack.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#1B1F2A] hover:bg-[#252B3B] text-slate-100 border border-white/10 disabled:opacity-40 cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5 text-amber-400" />
                    <span>Split at Playhead</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTrack(selectedTrack.id, {
                        semitoneShift: 0,
                        centsDetune: 0,
                        clipGainDb: 0,
                        trimStartSec: 0,
                        trimEndSec: 0,
                        fadeInSec: 0,
                        fadeOutSec: 0,
                      })
                    }
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#161922] hover:bg-[#1E2330] text-slate-300 border border-white/10 cursor-pointer"
                  >
                    <span>Reset Edits</span>
                  </button>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Recording Latency Compensation</span>
                    <span className="font-mono tabular-nums">{latencyOffsetMs} ms</span>
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
            </div>
          )}

          {activeTab === 'autopitch' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-[740px]">
              {/* Live Tuner & Mic Level */}
              <div className="p-3.5 rounded-xl bg-[#0D0F15] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Live AutoPitch Tuner</div>
                    <div className="text-[11px] text-slate-400">Real-time vocal pitch lock</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdatePitchSettings({ enabled: !pitchSettings.enabled })}
                    className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      pitchSettings.enabled
                        ? 'bg-[#F14624] text-white'
                        : 'bg-[#1B1F2A] text-slate-300 border border-white/10'
                    }`}
                  >
                    {pitchSettings.enabled ? 'Active' : 'Bypass'}
                  </button>
                </div>

                <div className="flex items-end justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-white tabular-nums">
                      {livePitch.noteName}
                    </span>
                    {pitchSettings.enabled && livePitch.targetNoteName !== '—' && (
                      <span className="text-xs font-mono text-sky-400 tabular-nums">
                        → {livePitch.targetNoteName}
                      </span>
                    )}
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums">
                    <div className="text-slate-300">
                      {livePitch.frequency > 0 ? `${livePitch.frequency.toFixed(1)} Hz` : '0.0 Hz'}
                    </div>
                    <div
                      className={
                        Math.abs(livePitch.cents) <= 10 && livePitch.frequency > 0
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                      }
                    >
                      {livePitch.frequency > 0
                        ? `${livePitch.cents >= 0 ? '+' : ''}${livePitch.cents}¢`
                        : 'Sing into mic'}
                    </div>
                  </div>
                </div>

                <div className="relative h-2 bg-[#1A1E29] rounded-full overflow-hidden">
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/40 z-10 -translate-x-1/2" />
                  {livePitch.frequency > 0 && (
                    <div
                      className={`absolute top-0 bottom-0 w-2.5 rounded-full -translate-x-1/2 ${
                        Math.abs(livePitch.cents) <= 10 ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{ left: `${meterPercent}%` }}
                    />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <div className="flex-1 h-1.5 bg-[#1A1E29] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-75"
                      style={{ width: `${Math.round(micLevel * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Scale Lock Piano Strip */}
              <div className="p-3.5 rounded-xl bg-[#0D0F15] border border-white/10 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400">Key</span>
                    <select
                      value={pitchSettings.key}
                      onChange={(e) =>
                        onUpdatePitchSettings({ key: e.target.value as MusicalKey })
                      }
                      className="w-full bg-[#161922] text-slate-100 border border-white/10 rounded px-2 py-1.5 text-xs outline-none"
                    >
                      {NOTE_NAMES.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400">Scale</span>
                    <select
                      value={pitchSettings.scale}
                      onChange={(e) =>
                        onUpdatePitchSettings({ scale: e.target.value as ScaleType })
                      }
                      className="w-full bg-[#161922] text-slate-100 border border-white/10 rounded px-2 py-1.5 text-xs outline-none"
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

                <div className="grid grid-cols-6 gap-1">
                  {NOTE_NAMES.map((note, idx) => {
                    const inScale = allowedNotes.has(idx);
                    const isTarget = targetPitchClass === note;
                    const isDetected = detectedPitchClass === note;
                    return (
                      <div
                        key={note}
                        className={`py-1.5 text-center rounded text-[11px] font-mono border ${
                          isTarget
                            ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                            : isDetected
                              ? 'bg-amber-500/25 text-amber-200 border-amber-400/50'
                              : inScale
                                ? 'bg-[#1B202C] text-slate-200 border-white/12'
                                : 'bg-[#0B0D12] text-slate-600 border-white/5'
                        }`}
                      >
                        {note}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Correction Speed & Monitor */}
              <div className="p-3.5 rounded-xl bg-[#0D0F15] border border-white/10 space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>AutoPitch Strength</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {pitchSettings.retuneSpeed}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={pitchSettings.retuneSpeed}
                    onChange={(e) =>
                      onUpdatePitchSettings({ retuneSpeed: Number(e.target.value) })
                    }
                    className="w-full studio-slider"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Humanize Vibrato</span>
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

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Headphones className="w-3.5 h-3.5 text-slate-400" />
                    <span>Headphone Monitor</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePitchSettings({ monitorCorrected: !pitchSettings.monitorCorrected })
                    }
                    className={`px-3 py-1 rounded text-xs font-semibold border cursor-pointer ${
                      pitchSettings.monitorCorrected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-[#161922] text-slate-400 border-white/10'
                    }`}
                  >
                    {pitchSettings.monitorCorrected ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
