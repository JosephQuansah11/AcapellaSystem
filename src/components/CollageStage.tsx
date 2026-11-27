import React, { useEffect, useRef } from 'react';
import {
  Camera,
  CameraOff,
  Columns,
  Disc3,
  LayoutGrid,
  Mic,
  MicOff,
  Maximize2,
  Rows,
  SplitSquareHorizontal,
  Trash2,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { AspectRatio, CollageLayout, Track } from '../types/studio';

interface CollageStageProps {
  tracks: Track[];
  selectedTrackId: string;
  onSelectTrack: (id: string) => void;
  onArmTrack: (id: string) => void;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onClearTrackTake: (id: string) => void;
  layout: CollageLayout;
  onChangeLayout: (layout: CollageLayout) => void;
  aspectRatio: AspectRatio;
  onChangeAspectRatio: (ratio: AspectRatio) => void;
  liveStream: MediaStream | null;
  hasMic: boolean;
  hasCam: boolean;
  isVirtualInput: boolean;
  onOpenDeviceModal: () => void;
  isPlaying: boolean;
  isRecording: boolean;
  countInBeat: number | null;
  currentTimeSec: number;
  bpm: number;
  videoElementsRef: React.MutableRefObject<Map<string, HTMLVideoElement>>;
}

const LAYOUT_OPTIONS: { id: CollageLayout; label: string; icon: React.ReactNode }[] = [
  { id: 'grid-2x2', label: '2×2 Grid', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { id: 'spotlight', label: 'Spotlight', icon: <Maximize2 className="w-3.5 h-3.5" /> },
  { id: 'columns', label: 'Columns', icon: <Columns className="w-3.5 h-3.5" /> },
  { id: 'cinema-strip', label: 'Strip', icon: <Rows className="w-3.5 h-3.5" /> },
  { id: 'duet', label: 'Duet', icon: <SplitSquareHorizontal className="w-3.5 h-3.5" /> },
];

export const CollageStage: React.FC<CollageStageProps> = ({
  tracks,
  selectedTrackId,
  onSelectTrack,
  onArmTrack,
  onToggleMute,
  onToggleSolo,
  onClearTrackTake,
  layout,
  onChangeLayout,
  aspectRatio,
  onChangeAspectRatio,
  liveStream,
  hasMic,
  hasCam,
  isVirtualInput,
  onOpenDeviceModal,
  isPlaying,
  isRecording,
  countInBeat,
  currentTimeSec,
  bpm,
  videoElementsRef,
}) => {
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = liveStream;
    }
  }, [liveStream]);

  // Synchronize recorded track <video> playback with master AudioContext clock
  useEffect(() => {
    videoElementsRef.current.forEach((video, trackId) => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track || !track.videoUrl) return;

      const targetTime = Math.max(0, currentTimeSec - track.offsetSec);
      if (isPlaying || isRecording) {
        if (targetTime < (video.duration || track.durationSec)) {
          if (video.paused) {
            video.play().catch(() => {});
          }
          if (Math.abs(video.currentTime - targetTime) > 0.12) {
            try {
              video.currentTime = targetTime;
            } catch {
              // ignore seek while loading
            }
          }
        } else if (!video.paused) {
          video.pause();
        }
      } else {
        if (!video.paused) video.pause();
        if (Math.abs(video.currentTime - targetTime) > 0.08 && Number.isFinite(targetTime)) {
          try {
            video.currentTime = Math.min(targetTime, video.duration || targetTime);
          } catch {
            // ignore
          }
        }
      }
    });
  }, [currentTimeSec, isPlaying, isRecording, tracks, videoElementsRef]);

  const beat = (currentTimeSec * bpm) / 60;

  // Determine grid container classes matching layout & aspectRatio
  const getGridClass = (): string => {
    const count = tracks.length;
    if (count <= 1) return 'grid-cols-1 grid-rows-1';
    if (layout === 'duet' || count === 2) {
      return aspectRatio === '9:16' ? 'grid-cols-1 grid-rows-2' : 'grid-cols-2 grid-rows-1';
    }
    if (layout === 'columns') {
      if (count === 3) return 'grid-cols-3 grid-rows-1';
      return 'grid-cols-4 grid-rows-1';
    }
    if (layout === 'cinema-strip') {
      return 'grid-cols-1 auto-rows-fr';
    }
    if (layout === 'spotlight') {
      return aspectRatio === '9:16' ? 'grid-cols-3 grid-rows-3' : 'grid-cols-3 grid-rows-3';
    }
    // grid-2x2
    if (count <= 4) return 'grid-cols-2 grid-rows-2';
    if (count <= 6) return 'grid-cols-3 grid-rows-2';
    return 'grid-cols-4 grid-rows-2';
  };

  const getTileSpanClass = (index: number): string => {
    if (layout !== 'spotlight' || tracks.length <= 2) return '';
    if (aspectRatio === '9:16') {
      return index === 0 ? 'col-span-3 row-span-2' : 'col-span-1 row-span-1';
    }
    return index === 0 ? 'col-span-2 row-span-3' : 'col-span-1 row-span-1';
  };

  const aspectBoxClass =
    aspectRatio === '16:9'
      ? 'aspect-video max-h-[500px] w-full'
      : aspectRatio === '9:16'
        ? 'aspect-[9/16] h-[480px] max-w-[300px]'
        : 'aspect-square h-[460px] max-w-[460px]';

  return (
    <section className="flex flex-col flex-1 min-w-0 bg-[#0D1119] border-r border-white/8">
      {/* Stage Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-white/6 bg-[#10151F]">
        <div className="flex items-center gap-1 p-1 bg-[#090C12] rounded-lg border border-white/8">
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeLayout(opt.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                layout === opt.id
                  ? 'bg-[#1D2535] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Aspect Ratio Switcher */}
          <div className="flex items-center gap-1 p-1 bg-[#090C12] rounded-lg border border-white/8">
            {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => onChangeAspectRatio(ratio)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  aspectRatio === ratio
                    ? 'bg-[#1D2535] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>

          {/* Camera / Mic Setup Button */}
          <button
            type="button"
            onClick={onOpenDeviceModal}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              hasMic || isVirtualInput
                ? 'bg-emerald-500/12 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-rose-500/12 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
            }`}
          >
            {hasCam ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
            {hasMic || isVirtualInput ? (
              <Mic className="w-3.5 h-3.5" />
            ) : (
              <MicOff className="w-3.5 h-3.5" />
            )}
            <span>
              {isVirtualInput
                ? 'Virtual Vocal Input'
                : hasMic && hasCam
                  ? 'Mic & Cam Ready'
                  : hasMic
                    ? 'Mic Ready (No Cam)'
                    : 'Connect Mic & Cam'}
            </span>
          </button>
        </div>
      </div>

      {/* Synchronized Collage Canvas Viewport */}
      <div className="flex-1 flex items-center justify-center p-5 bg-[#090C12] relative overflow-hidden">
        {countInBeat !== null && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-none">
            <div className="text-center">
              <div className="text-6xl font-bold font-mono text-rose-400 tabular-nums">
                {countInBeat}
              </div>
              <div className="text-sm font-medium text-slate-300 mt-1">
                Get ready — recording on beat 1
              </div>
            </div>
          </div>
        )}

        <div
          className={`grid gap-2.5 p-2.5 bg-[#0D1119] rounded-xl border border-white/10 transition-all duration-200 ${aspectBoxClass} ${getGridClass()}`}
        >
          {tracks.map((track, idx) => {
            const isSelected = track.id === selectedTrackId;
            const showLiveCam = track.armed && liveStream && hasCam;
            const hasRecordedMedia = Boolean(track.audioBuffer || track.videoUrl);
            const activeNote = track.demoNotes?.find(
              (n) => beat >= n.startBeat && beat < n.startBeat + n.durationBeats
            );

            return (
              <div
                key={track.id}
                onClick={() => onSelectTrack(track.id)}
                className={`group relative rounded-lg overflow-hidden bg-[#131823] border transition-colors cursor-pointer flex flex-col justify-between ${getTileSpanClass(
                  idx
                )} ${
                  track.armed && isRecording
                    ? 'border-rose-500 ring-2 ring-rose-500/40'
                    : isSelected
                      ? 'border-sky-400/70'
                      : 'border-white/10 hover:border-white/25'
                } ${track.muted ? 'opacity-45' : ''}`}
              >
                {/* Media Layer */}
                {showLiveCam ? (
                  <video
                    ref={liveVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />
                ) : track.videoUrl ? (
                  <video
                    ref={(el) => {
                      if (el) {
                        videoElementsRef.current.set(track.id, el);
                      } else {
                        videoElementsRef.current.delete(track.id);
                      }
                    }}
                    src={track.videoUrl}
                    muted
                    playsInline
                    preload="auto"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : hasRecordedMedia ? (
                  /* Synchronized Vocal Stage Visualizer for audio-only / synthesized tracks */
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center p-4"
                    style={{
                      background: `radial-gradient(circle at 50% 42%, hsla(${
                        track.demoHue ?? (idx * 75 + 200) % 360
                      }, 45%, 22%, 0.9), #0E131D 85%)`,
                    }}
                  >
                    <div
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center border-2 transition-transform duration-100"
                      style={{
                        borderColor: track.color,
                        backgroundColor: `${track.color}22`,
                        transform: `scale(${1 + track.liveLevel * 0.22})`,
                      }}
                    >
                      <span className="text-lg font-bold font-display text-white">
                        {activeNote
                          ? activeNote.syllable
                          : track.singerName.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    {track.isDemoSynthetic && (
                      <span className="mt-2 text-[11px] font-medium text-slate-300/80">
                        {activeNote ? 'Singing Harmony' : 'Harmony Ready'}
                      </span>
                    )}
                  </div>
                ) : (
                  /* Empty Track Slot */
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-[#111621]">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mb-2 border"
                      style={{ borderColor: `${track.color}66`, backgroundColor: `${track.color}18` }}
                    >
                      <Video className="w-4 h-4" style={{ color: track.color }} />
                    </div>
                    <p className="text-xs font-medium text-slate-200">{track.name}</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onArmTrack(track.id);
                      }}
                      className={`mt-2 px-3 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                        track.armed
                          ? 'bg-rose-600 text-white'
                          : 'bg-[#1D2434] text-slate-200 hover:bg-[#263044]'
                      }`}
                    >
                      {track.armed ? 'Armed for Take' : 'Arm Track'}
                    </button>
                  </div>
                )}

                {/* Top Quick Controls (visible on hover or when armed) */}
                <div className="relative z-10 flex items-center justify-between p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMute(track.id);
                      }}
                      title={track.muted ? 'Unmute' : 'Mute'}
                      className={`p-1.5 rounded bg-black/65 text-white hover:bg-black/85 transition-colors cursor-pointer ${
                        track.muted ? 'text-rose-400' : ''
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
                      title="Solo part"
                      className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                        track.solo
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-black/65 text-slate-200 hover:bg-black/85'
                      }`}
                    >
                      S
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onArmTrack(track.id);
                      }}
                      title="Arm for recording / retake"
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        track.armed
                          ? 'bg-rose-600 text-white'
                          : 'bg-black/65 text-slate-200 hover:bg-black/85'
                      }`}
                    >
                      <Disc3 className="w-3 h-3" />
                      <span>{track.armed ? 'Armed' : 'Arm'}</span>
                    </button>
                    {hasRecordedMedia && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearTrackTake(track.id);
                        }}
                        title="Clear take"
                        className="p-1.5 rounded bg-black/65 text-slate-300 hover:text-rose-400 hover:bg-black/85 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Scrim & Singer Label */}
                <div className="relative z-10 mt-auto px-3 py-2 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: track.color }}
                      />
                      <span className="text-xs font-semibold text-white truncate">
                        {track.singerName}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 truncate">
                      {track.name}
                      {track.armed ? ' · Armed' : ''}
                    </div>
                  </div>

                  {/* Live Tile Level Bar */}
                  <div className="w-12 h-1.5 bg-white/15 rounded-full overflow-hidden shrink-0 mb-1">
                    <div
                      className="h-full transition-all duration-75 rounded-full"
                      style={{
                        width: `${Math.round(track.liveLevel * 100)}%`,
                        backgroundColor: track.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
