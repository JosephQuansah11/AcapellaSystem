import React from 'react';
import {
  Disc3,
  Download,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Share2,
  Sliders,
  Sparkles,
  Square,
  Timer,
  Volume2,
} from 'lucide-react';
import type { LoopRegion, MusicalKey, ProjectMeta, ScaleType } from '../types/studio';
import { NOTE_NAMES } from '../audio/pitchUtils';

interface TopBarProps {
  activeSection: 'studio' | 'pitch' | 'export' | 'share';
  onNavigate: (section: 'studio' | 'pitch' | 'export' | 'share') => void;
  project: ProjectMeta;
  onUpdateProject: (patch: Partial<ProjectMeta>) => void;
  musicalKey: MusicalKey;
  scale: ScaleType;
  onChangeKey: (key: MusicalKey) => void;
  onChangeScale: (scale: ScaleType) => void;
  isPlaying: boolean;
  isRecording: boolean;
  countInBeat: number | null;
  currentTimeSec: number;
  loop: LoopRegion;
  onTogglePlay: () => void;
  onRewind: () => void;
  onToggleRecord: () => void;
  onToggleLoop: () => void;
  onLoadDemo: () => void;
  hasAnyTracks: boolean;
  isLoadingDemo: boolean;
}

function formatTimecode(sec: number): string {
  const clamped = Math.max(0, sec);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const hundredths = Math.floor((clamped % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onNavigate,
  project,
  onUpdateProject,
  musicalKey,
  scale,
  onChangeKey,
  onChangeScale,
  isPlaying,
  isRecording,
  countInBeat,
  currentTimeSec,
  loop,
  onTogglePlay,
  onRewind,
  onToggleRecord,
  onToggleLoop,
  onLoadDemo,
  hasAnyTracks,
  isLoadingDemo,
}) => {
  return (
    <div className="border-b border-white/8 bg-[#0B0E14]">
      {/* Strict 3-Zone Top Bar */}
      <header className="flex items-center justify-between gap-8 px-6 py-3 border-b border-white/6">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('studio');
          }}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
        >
          VoxSplit
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            type="button"
            onClick={() => onNavigate('studio')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b ${
              activeSection === 'studio'
                ? 'text-white border-rose-500'
                : 'border-transparent hover:text-white'
            }`}
          >
            Collage Studio
          </button>
          <button
            type="button"
            onClick={() => onNavigate('pitch')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b ${
              activeSection === 'pitch'
                ? 'text-white border-rose-500'
                : 'border-transparent hover:text-white'
            }`}
          >
            Pitch Tuner
          </button>
          <button
            type="button"
            onClick={() => onNavigate('export')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b ${
              activeSection === 'export'
                ? 'text-white border-rose-500'
                : 'border-transparent hover:text-white'
            }`}
          >
            HD Export
          </button>
          <button
            type="button"
            onClick={() => onNavigate('share')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b ${
              activeSection === 'share'
                ? 'text-white border-rose-500'
                : 'border-transparent hover:text-white'
            }`}
          >
            Social Share
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('export')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-rose-400"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Mix</span>
          </button>
        </div>
      </header>

      {/* Studio Transport & Session Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2.5 bg-[#10141D]">
        {/* Project Title & Musical Context */}
        <div className="flex items-center gap-3 min-w-0">
          <input
            type="text"
            value={project.title}
            onChange={(e) => onUpdateProject({ title: e.target.value })}
            aria-label="Project title"
            className="bg-transparent text-sm font-semibold text-slate-100 border border-transparent hover:border-white/10 focus:border-white/25 focus:bg-[#161C28] rounded px-2 py-1 outline-none w-44 sm:w-56 truncate transition-colors"
          />
          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
            <label className="flex items-center gap-1.5">
              <span className="text-slate-500">Key</span>
              <select
                value={musicalKey}
                onChange={(e) => onChangeKey(e.target.value as MusicalKey)}
                className="bg-[#161C28] text-slate-200 border border-white/10 rounded px-2 py-1 text-xs outline-none cursor-pointer"
              >
                {NOTE_NAMES.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <select
              value={scale}
              onChange={(e) => onChangeScale(e.target.value as ScaleType)}
              aria-label="Scale"
              className="bg-[#161C28] text-slate-200 border border-white/10 rounded px-2 py-1 text-xs outline-none cursor-pointer"
            >
              <option value="Major">Major</option>
              <option value="Natural Minor">Natural Minor</option>
              <option value="Chromatic">Chromatic</option>
              <option value="Pentatonic Major">Pentatonic Maj</option>
              <option value="Pentatonic Minor">Pentatonic Min</option>
              <option value="Harmonic Minor">Harmonic Minor</option>
            </select>
          </div>
        </div>

        {/* Center Transport Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRewind}
            title="Rewind to start"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isPlaying
                ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                : 'bg-[#1B2230] text-slate-100 hover:bg-[#232C3E] border border-white/10'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleRecord}
            title="Record armed vocal track"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isRecording || countInBeat !== null
                ? 'bg-rose-600 text-white hover:bg-rose-500'
                : 'bg-[#1B2230] text-rose-400 hover:bg-rose-600/15 border border-rose-500/30'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Rec</span>
              </>
            ) : countInBeat !== null ? (
              <>
                <Timer className="w-3.5 h-3.5" />
                <span className="tabular-nums">Count {countInBeat}</span>
              </>
            ) : (
              <>
                <Disc3 className="w-3.5 h-3.5" />
                <span>Record</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleLoop}
            title="Loop existing tracks for harmony alignment"
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              loop.enabled
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-[#1B2230] text-slate-300 hover:text-white border border-white/10'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Loop</span>
          </button>

          {/* Timecode Readout */}
          <div className="ml-1 px-3 py-1.5 rounded-lg bg-[#080A0F] border border-white/8 font-mono text-sm font-medium text-slate-100 tabular-nums tracking-tight">
            {formatTimecode(currentTimeSec)}
          </div>
        </div>

        {/* Right Tempo, Metronome & Quick Actions */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-[#161C28] border border-white/10 rounded-lg px-2 py-1 gap-1.5">
            <span className="text-[11px] text-slate-400">BPM</span>
            <input
              type="number"
              min={50}
              max={200}
              value={project.bpm}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!Number.isNaN(val)) {
                  onUpdateProject({ bpm: Math.max(50, Math.min(200, val)) });
                }
              }}
              aria-label="Tempo BPM"
              className="w-11 bg-transparent text-xs font-mono font-semibold text-white text-right outline-none tabular-nums"
            />
          </div>

          <button
            type="button"
            onClick={() => onUpdateProject({ metronomeEnabled: !project.metronomeEnabled })}
            title="Toggle metronome click"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              project.metronomeEnabled
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-[#161C28] text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Click</span>
          </button>

          <button
            type="button"
            onClick={onLoadDemo}
            disabled={isLoadingDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#161C28] hover:bg-[#1E2636] text-slate-200 border border-white/10 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>{isLoadingDemo ? 'Synthesizing...' : hasAnyTracks ? 'Reload Quartet' : 'Load Demo Quartet'}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('share')}
            title="Share performance to social media"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#161C28] hover:bg-[#1E2636] text-slate-200 border border-white/10 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('pitch')}
            title="Open Pitch Lab"
            className="xl:hidden p-1.5 rounded-lg bg-[#161C28] text-slate-300 border border-white/10 cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
