import React, { useRef } from 'react';
import {
  Copy,
  Disc3,
  Mic,
  Plus,
  Repeat,
  Scissors,
  Sliders,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { LoopRegion, Track } from '../types/studio';

interface TimelinePanelProps {
  tracks: Track[];
  selectedTrackId: string;
  onSelectTrack: (id: string) => void;
  onArmTrack: (id: string) => void;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onUpdateTrack: (id: string, patch: Partial<Track>) => void;
  onAddTrack: () => void;
  onDeleteTrack: (id: string) => void;
  onDuplicateTrack: (id: string) => void;
  onSplitTrackAtPlayhead: (id: string) => void;
  onOpenFxForTrack: (id: string) => void;
  currentTimeSec: number;
  totalDurationSec: number;
  bpm: number;
  loop: LoopRegion;
  onUpdateLoop: (patch: Partial<LoopRegion>) => void;
  onSeek: (sec: number) => void;
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  tracks,
  selectedTrackId,
  onSelectTrack,
  onArmTrack,
  onToggleMute,
  onToggleSolo,
  onUpdateTrack,
  onAddTrack,
  onDeleteTrack,
  onDuplicateTrack,
  onSplitTrackAtPlayhead,
  onOpenFxForTrack,
  currentTimeSec,
  totalDurationSec,
  bpm,
  loop,
  onUpdateLoop,
  onSeek,
}) => {
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const timelineSpanSec = Math.max(16, totalDurationSec + 4);
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  const numBars = Math.ceil(timelineSpanSec / barSec);

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * timelineSpanSec);
  };

  const playheadPercent = Math.min(100, (currentTimeSec / timelineSpanSec) * 100);
  const loopStartPct = Math.max(0, Math.min(100, (loop.startSec / timelineSpanSec) * 100));
  const loopWidthPct = Math.max(
    1,
    Math.min(100 - loopStartPct, ((loop.endSec - loop.startSec) / timelineSpanSec) * 100)
  );

  const setBarLoopPreset = (startBar: number, endBar: number) => {
    onUpdateLoop({
      enabled: true,
      startSec: Number((startBar * barSec).toFixed(2)),
      endSec: Number((endBar * barSec).toFixed(2)),
    });
  };

  return (
    <section className="flex-1 min-w-0 bg-[#101218] flex flex-col border-r border-white/10 overflow-hidden">
      {/* BandLab Arrangement Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-[#161922] border-b border-white/8">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddTrack}
            disabled={tracks.length >= 8}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#222736] hover:bg-[#2C3347] text-white border border-white/10 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-[#F14624]" />
            <span>Add Track</span>
          </button>

          <button
            type="button"
            onClick={() => onSplitTrackAtPlayhead(selectedTrackId)}
            title="Split selected track clip at playhead"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#1B1F2A] hover:bg-[#242A38] text-slate-300 border border-white/10 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Split</span>
          </button>

          <button
            type="button"
            onClick={() => onDuplicateTrack(selectedTrackId)}
            disabled={tracks.length >= 8}
            title="Duplicate selected track"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#1B1F2A] hover:bg-[#242A38] text-slate-300 border border-white/10 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Duplicate</span>
          </button>
        </div>

        {/* Loop Alignment Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => onUpdateLoop({ enabled: !loop.enabled })}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium border transition-colors cursor-pointer whitespace-nowrap ${
              loop.enabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-[#1B1F2A] text-slate-400 border-white/10 hover:text-slate-200'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>{loop.enabled ? 'Loop On' : 'Loop Off'}</span>
          </button>

          <div className="hidden sm:flex items-center gap-0.5 bg-[#0D0F15] p-0.5 rounded-md border border-white/8">
            <button
              type="button"
              onClick={() => setBarLoopPreset(0, 2)}
              className="px-2 py-1 rounded text-[11px] text-slate-300 hover:bg-[#222736] cursor-pointer whitespace-nowrap"
            >
              Bars 1–2
            </button>
            <button
              type="button"
              onClick={() => setBarLoopPreset(2, 4)}
              className="px-2 py-1 rounded text-[11px] text-slate-300 hover:bg-[#222736] cursor-pointer whitespace-nowrap"
            >
              Bars 3–4
            </button>
            <button
              type="button"
              onClick={() => setBarLoopPreset(0, 4)}
              className="px-2 py-1 rounded text-[11px] text-slate-300 hover:bg-[#222736] cursor-pointer whitespace-nowrap"
            >
              4 Bars
            </button>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
            <input
              type="number"
              min={0}
              max={Math.max(0.5, loop.endSec - 0.5)}
              step={0.5}
              value={loop.startSec}
              onChange={(e) =>
                onUpdateLoop({
                  startSec: Math.max(0, Math.min(loop.endSec - 0.5, Number(e.target.value))),
                })
              }
              aria-label="Loop start seconds"
              className="w-11 bg-[#0D0F15] border border-white/10 rounded px-1 py-0.5 text-slate-200 text-right tabular-nums outline-none"
            />
            <span>–</span>
            <input
              type="number"
              min={loop.startSec + 0.5}
              max={timelineSpanSec}
              step={0.5}
              value={loop.endSec}
              onChange={(e) =>
                onUpdateLoop({
                  endSec: Math.max(loop.startSec + 0.5, Number(e.target.value)),
                })
              }
              aria-label="Loop end seconds"
              className="w-11 bg-[#0D0F15] border border-white/10 rounded px-1 py-0.5 text-slate-200 text-right tabular-nums outline-none"
            />
            <span>s</span>
          </div>
        </div>
      </div>

      {/* Ruler + Stacked BandLab Track Lanes */}
      <div className="flex-1 overflow-y-auto">
        {/* Time & Beat Ruler Row */}
        <div className="flex border-b border-white/10 bg-[#13161E] sticky top-0 z-20">
          <div className="w-[290px] sm:w-[320px] shrink-0 px-3.5 py-1.5 text-[11px] font-medium text-slate-400 border-r border-white/10 flex items-center justify-between">
            <span>Tracks ({tracks.length})</span>
            <span className="font-mono text-slate-500">Mix · FX · Arm</span>
          </div>

          <div
            ref={rulerRef}
            onClick={handleRulerClick}
            className="relative flex-1 h-7 cursor-pointer select-none overflow-hidden bg-[#0D0F15]"
          >
            {Array.from({ length: numBars }).map((_, barIdx) => {
              const leftPct = ((barIdx * barSec) / timelineSpanSec) * 100;
              return (
                <div
                  key={barIdx}
                  className="absolute top-0 bottom-0 border-l border-white/12 pl-1.5 text-[10px] font-mono text-slate-400 flex items-center tabular-nums"
                  style={{ left: `${leftPct}%` }}
                >
                  {barIdx + 1}
                </div>
              );
            })}

            {loop.enabled && (
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/20 border-x-2 border-emerald-400 pointer-events-none"
                style={{ left: `${loopStartPct}%`, width: `${loopWidthPct}%` }}
              />
            )}

            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#F14624] z-10 pointer-events-none"
              style={{ left: `${playheadPercent}%` }}
            >
              <div className="w-2.5 h-2.5 bg-[#F14624] -translate-x-1 rotate-45 -translate-y-1" />
            </div>
          </div>
        </div>

        {/* Track Rows */}
        {tracks.map((track) => {
          const isSelected = track.id === selectedTrackId;
          const trimStart = track.trimStartSec;
          const trimEnd =
            track.trimEndSec > trimStart + 0.05 ? track.trimEndSec : track.durationSec;
          const visibleSpan = Math.max(0, trimEnd - trimStart);
          const clipStartPct = ((track.offsetSec + trimStart) / timelineSpanSec) * 100;
          const clipWidthPct =
            track.durationSec > 0
              ? Math.min(100 - clipStartPct, (visibleSpan / timelineSpanSec) * 100)
              : 0;

          return (
            <div
              key={track.id}
              onClick={() => onSelectTrack(track.id)}
              className={`flex border-b border-white/8 transition-colors cursor-pointer ${
                isSelected ? 'bg-[#1D2230]' : 'bg-[#141720] hover:bg-[#191D29]'
              }`}
            >
              {/* BandLab-Style Track Header with Inline Volume, Pan, M/S/R & FX */}
              <div className="w-[290px] sm:w-[320px] shrink-0 px-3 py-2.5 border-r border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Circular Instrument/Vocal Badge */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `${track.color}25`,
                        borderColor: track.color,
                      }}
                    >
                      <Mic className="w-3.5 h-3.5" style={{ color: track.color }} />
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{track.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{track.singerName}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMute(track.id);
                      }}
                      title="Mute"
                      className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold transition-colors cursor-pointer ${
                        track.muted
                          ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                          : 'bg-[#0D0F15] text-slate-400 hover:text-white border border-white/8'
                      }`}
                    >
                      {track.muted ? (
                        <VolumeX className="w-3 h-3" />
                      ) : (
                        <Volume2 className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSolo(track.id);
                      }}
                      title="Solo"
                      className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold transition-colors cursor-pointer ${
                        track.solo
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-[#0D0F15] text-slate-400 hover:text-white border border-white/8'
                      }`}
                    >
                      S
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onArmTrack(track.id);
                      }}
                      title="Arm for recording"
                      className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                        track.armed
                          ? 'bg-[#FF3B30] text-white'
                          : 'bg-[#0D0F15] text-slate-400 hover:text-[#FF5E54] border border-white/8'
                      }`}
                    >
                      <Disc3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFxForTrack(track.id);
                      }}
                      title="Edit track FX chain"
                      className={`px-1.5 h-6 rounded flex items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer border ${
                        track.fxEnabled
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                          : 'bg-[#0D0F15] text-slate-500 border-white/8 hover:text-slate-200'
                      }`}
                    >
                      <Sliders className="w-2.5 h-2.5" />
                      <span>FX</span>
                    </button>
                    {tracks.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTrack(track.id);
                        }}
                        title="Remove track"
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-white/8 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline BandLab Volume & Pan Sliders */}
                <div
                  className="flex items-center gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex-1 flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-500">Vol</span>
                    <input
                      type="range"
                      min={0}
                      max={1.4}
                      step={0.02}
                      value={track.volume}
                      onChange={(e) =>
                        onUpdateTrack(track.id, { volume: Number(e.target.value) })
                      }
                      aria-label={`${track.name} volume`}
                      className="w-full studio-slider"
                    />
                  </div>
                  <div className="w-24 flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-500">Pan</span>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.05}
                      value={track.pan}
                      onChange={(e) =>
                        onUpdateTrack(track.id, { pan: Number(e.target.value) })
                      }
                      aria-label={`${track.name} pan`}
                      className="w-full studio-slider"
                    />
                  </div>
                </div>
              </div>

              {/* Right Waveform Region Lane */}
              <div
                className="relative flex-1 min-h-[72px] overflow-hidden bg-[#0E1016]"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  onSeek(ratio * timelineSpanSec);
                }}
              >
                {/* Vertical Beat Grid Lines */}
                {Array.from({ length: numBars }).map((_, barIdx) => {
                  const leftPct = ((barIdx * barSec) / timelineSpanSec) * 100;
                  return (
                    <div
                      key={barIdx}
                      className="absolute top-0 bottom-0 border-l border-white/5 pointer-events-none"
                      style={{ left: `${leftPct}%` }}
                    />
                  );
                })}

                {loop.enabled && (
                  <div
                    className="absolute top-0 bottom-0 bg-emerald-500/8 border-x border-emerald-500/25 pointer-events-none"
                    style={{ left: `${loopStartPct}%`, width: `${loopWidthPct}%` }}
                  />
                )}

                {/* Audio Waveform Clip Region */}
                {track.audioBuffer && clipWidthPct > 0 ? (
                  <div
                    draggable
                    onDragEnd={(e) => {
                      const parent = e.currentTarget.parentElement;
                      if (!parent) return;
                      const rect = parent.getBoundingClientRect();
                      const dropRatio = Math.max(
                        0,
                        Math.min(0.85, (e.clientX - rect.left) / rect.width)
                      );
                      onUpdateTrack(track.id, {
                        offsetSec: Number((dropRatio * timelineSpanSec).toFixed(2)),
                      });
                    }}
                    title="Drag clip horizontally to align timing"
                    className="absolute top-2 bottom-2 rounded-lg border overflow-hidden flex flex-col justify-between"
                    style={{
                      left: `${clipStartPct}%`,
                      width: `${clipWidthPct}%`,
                      backgroundColor: `${track.color}22`,
                      borderColor: `${track.color}88`,
                    }}
                  >
                    {/* Clip Header Strip */}
                    <div
                      className="px-2 py-0.5 text-[10px] font-semibold text-white flex items-center justify-between truncate"
                      style={{ backgroundColor: `${track.color}40` }}
                    >
                      <span className="truncate">{track.name}</span>
                      {(track.semitoneShift !== 0 || track.reversed) && (
                        <span className="font-mono text-[9px] text-white/90 ml-1 shrink-0">
                          {track.semitoneShift !== 0
                            ? `${track.semitoneShift > 0 ? '+' : ''}${track.semitoneShift}st`
                            : ''}
                          {track.reversed ? ' REV' : ''}
                        </span>
                      )}
                    </div>

                    {/* Waveform Bars */}
                    <div className="flex-1 flex items-center gap-[1px] px-1.5 py-1">
                      {track.waveformPeaks.map((peak, pIdx) => (
                        <div
                          key={pIdx}
                          className="flex-1 rounded-full min-w-[1px]"
                          style={{
                            height: `${Math.max(12, Math.round(peak * 92))}%`,
                            backgroundColor: track.color,
                            opacity: track.muted ? 0.35 : 0.9,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center px-4 text-xs text-slate-500">
                    {track.armed
                      ? 'Armed — press Record to capture live voice & video'
                      : 'Empty vocal track — click Arm or Load Quartet'}
                  </div>
                )}

                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#F14624] pointer-events-none z-10"
                  style={{ left: `${playheadPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
