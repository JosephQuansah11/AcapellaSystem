import React, { useRef } from 'react';
import { Disc3, Plus, Repeat, Trash2, Volume2, VolumeX } from 'lucide-react';
import type { LoopRegion, Track } from '../types/studio';

interface TimelinePanelProps {
  tracks: Track[];
  selectedTrackId: string;
  onSelectTrack: (id: string) => void;
  onArmTrack: (id: string) => void;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onAddTrack: () => void;
  onDeleteTrack: (id: string) => void;
  onUpdateTrackOffset: (id: string, offsetSec: number) => void;
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
  onAddTrack,
  onDeleteTrack,
  onUpdateTrackOffset,
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
    <section className="border-t border-white/8 bg-[#0B0E14] flex flex-col">
      {/* Timeline & Loop Alignment Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#10151F] border-b border-white/8">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-semibold text-slate-200 tracking-tight">
            Multi-Track Vocal Layers
          </h3>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="text-xs text-slate-400 tabular-nums">
            {tracks.length} {tracks.length === 1 ? 'part' : 'parts'}
          </span>
          <button
            type="button"
            onClick={onAddTrack}
            disabled={tracks.length >= 8}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#1B2230] hover:bg-[#242D3F] text-slate-200 border border-white/10 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Vocal Part</span>
          </button>
        </div>

        {/* Loop Alignment Bar Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => onUpdateLoop({ enabled: !loop.enabled })}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium border transition-colors cursor-pointer whitespace-nowrap ${
              loop.enabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-[#161C28] text-slate-400 border-white/10 hover:text-slate-200'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>{loop.enabled ? 'Looping Region' : 'Loop Off'}</span>
          </button>

          <div className="flex items-center gap-1 bg-[#090C12] p-0.5 rounded-md border border-white/8">
            <button
              type="button"
              onClick={() => setBarLoopPreset(0, 2)}
              className="px-2 py-1 rounded text-[11px] text-slate-300 hover:bg-[#1B2230] cursor-pointer whitespace-nowrap"
            >
              Bars 1–2
            </button>
            <button
              type="button"
              onClick={() => setBarLoopPreset(2, 4)}
              className="px-2 py-1 rounded text-[11px] text-slate-300 hover:bg-[#1B2230] cursor-pointer whitespace-nowrap"
            >
              Bars 3–4
            </button>
            <button
              type="button"
              onClick={() => setBarLoopPreset(0, 4)}
              className="px-2 py-1 rounded text-[11px] text-slate-300 hover:bg-[#1B2230] cursor-pointer whitespace-nowrap"
            >
              Full 4 Bars
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
            <span>In</span>
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
              className="w-12 bg-[#161C28] border border-white/10 rounded px-1.5 py-0.5 text-slate-200 text-right tabular-nums outline-none"
            />
            <span>Out</span>
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
              className="w-12 bg-[#161C28] border border-white/10 rounded px-1.5 py-0.5 text-slate-200 text-right tabular-nums outline-none"
            />
            <span>s</span>
          </div>
        </div>
      </div>

      {/* Ruler + Stacked Track Lanes */}
      <div className="overflow-y-auto max-h-[255px]">
        {/* Time & Loop Ruler Row */}
        <div className="flex border-b border-white/8 bg-[#0E131C] sticky top-0 z-20">
          <div className="w-[230px] sm:w-[260px] shrink-0 px-4 py-1.5 text-[11px] font-medium text-slate-400 border-r border-white/8 flex items-center justify-between">
            <span>Track / Singer</span>
            <span className="font-mono text-slate-500">M · S · R</span>
          </div>

          <div
            ref={rulerRef}
            onClick={handleRulerClick}
            className="relative flex-1 h-7 cursor-pointer select-none overflow-hidden"
          >
            {/* Bar Markers */}
            {Array.from({ length: numBars }).map((_, barIdx) => {
              const leftPct = ((barIdx * barSec) / timelineSpanSec) * 100;
              return (
                <div
                  key={barIdx}
                  className="absolute top-0 bottom-0 border-l border-white/10 pl-1.5 text-[10px] font-mono text-slate-500 flex items-center tabular-nums"
                  style={{ left: `${leftPct}%` }}
                >
                  Bar {barIdx + 1}
                </div>
              );
            })}

            {/* Loop Region Overlay */}
            {loop.enabled && (
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/20 border-x-2 border-emerald-400 pointer-events-none"
                style={{ left: `${loopStartPct}%`, width: `${loopWidthPct}%` }}
              />
            )}

            {/* Playhead Triangle */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 pointer-events-none"
              style={{ left: `${playheadPercent}%` }}
            >
              <div className="w-2.5 h-2.5 bg-rose-500 -translate-x-1 rotate-45 -translate-y-1" />
            </div>
          </div>
        </div>

        {/* Track Rows */}
        {tracks.map((track) => {
          const isSelected = track.id === selectedTrackId;
          const clipStartPct = (track.offsetSec / timelineSpanSec) * 100;
          const clipWidthPct =
            track.durationSec > 0 ? Math.min(100 - clipStartPct, (track.durationSec / timelineSpanSec) * 100) : 0;

          return (
            <div
              key={track.id}
              onClick={() => onSelectTrack(track.id)}
              className={`flex border-b border-white/6 transition-colors cursor-pointer ${
                isSelected ? 'bg-[#151C29]' : 'bg-[#0D1119] hover:bg-[#121722]'
              }`}
            >
              {/* Left Track Header */}
              <div className="w-[230px] sm:w-[260px] shrink-0 px-3 py-2 border-r border-white/8 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: track.color }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {track.name}
                    </div>
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
                    className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                      track.muted
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'text-slate-400 hover:text-white hover:bg-white/8'
                    }`}
                  >
                    {track.muted ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSolo(track.id);
                    }}
                    title="Solo"
                    className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                      track.solo
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white hover:bg-white/8'
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
                    className={`p-1 rounded transition-colors cursor-pointer ${
                      track.armed
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-400 hover:text-rose-400 hover:bg-white/8'
                    }`}
                  >
                    <Disc3 className="w-3.5 h-3.5" />
                  </button>
                  {tracks.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTrack(track.id);
                      }}
                      title="Remove layer"
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-white/8 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Right Waveform Lane */}
              <div
                className="relative flex-1 h-12 overflow-hidden"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  onSeek(ratio * timelineSpanSec);
                }}
              >
                {/* Loop Guide Backdrop */}
                {loop.enabled && (
                  <div
                    className="absolute top-0 bottom-0 bg-emerald-500/8 border-x border-emerald-500/25 pointer-events-none"
                    style={{ left: `${loopStartPct}%`, width: `${loopWidthPct}%` }}
                  />
                )}

                {/* Audio Waveform Clip */}
                {track.audioBuffer && clipWidthPct > 0 ? (
                  <div
                    draggable
                    onDragEnd={(e) => {
                      const parent = e.currentTarget.parentElement;
                      if (!parent) return;
                      const rect = parent.getBoundingClientRect();
                      const dropRatio = Math.max(0, Math.min(0.85, (e.clientX - rect.left) / rect.width));
                      onUpdateTrackOffset(track.id, Number((dropRatio * timelineSpanSec).toFixed(2)));
                    }}
                    title="Drag clip or use Mix tab to adjust timing alignment"
                    className="absolute top-1.5 bottom-1.5 rounded-md border overflow-hidden flex items-center px-1"
                    style={{
                      left: `${clipStartPct}%`,
                      width: `${clipWidthPct}%`,
                      backgroundColor: `${track.color}20`,
                      borderColor: `${track.color}70`,
                    }}
                  >
                    <div className="w-full h-full flex items-center gap-[1px]">
                      {track.waveformPeaks.map((peak, pIdx) => (
                        <div
                          key={pIdx}
                          className="flex-1 rounded-full min-w-[1px]"
                          style={{
                            height: `${Math.max(12, Math.round(peak * 92))}%`,
                            backgroundColor: track.color,
                            opacity: track.muted ? 0.35 : 0.85,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center px-4 text-[11px] text-slate-500">
                    {track.armed
                      ? 'Armed — press Record to capture live vocal & video layer'
                      : 'Empty layer — click Arm to record a harmony'}
                  </div>
                )}

                {/* Playhead Line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-10"
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
