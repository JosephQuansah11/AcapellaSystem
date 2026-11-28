import React from 'react';
import {
  Check,
  Disc3,
  Download,
  FolderOpen,
  Pause,
  Play,
  Redo2,
  Repeat,
  RotateCcw,
  Save,
  Share2,
  Sparkles,
  Square,
  Timer,
  Undo2,
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
  onStop: () => void;
  onRewind: () => void;
  onToggleRecord: () => void;
  onToggleLoop: () => void;
  onLoadDemo: () => void;
  hasAnyTracks: boolean;
  isLoadingDemo: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSaveProject: () => void;
  onOpenProjects: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: number | null;
}

function formatTimecode(sec: number): string {
  const clamped = Math.max(0, sec);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const hundredths = Math.floor((clamped % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

function formatBarBeat(sec: number, bpm: number, beatsPerBar: number): string {
  const totalBeats = Math.max(0, (sec * bpm) / 60);
  const bar = Math.floor(totalBeats / beatsPerBar) + 1;
  const beat = Math.floor(totalBeats % beatsPerBar) + 1;
  return `${String(bar).padStart(3, '0')}.${beat}`;
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
  onStop,
  onRewind,
  onToggleRecord,
  onToggleLoop,
  onLoadDemo,
  hasAnyTracks,
  isLoadingDemo,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSaveProject,
  onOpenProjects,
  isSaving,
  hasUnsavedChanges,
  lastSavedAt,
}) => {
  return (
    <div className="border-b border-white/10 bg-[#101218]">
      {/* Strict 3-Zone Top Bar */}
      <header className="flex items-center justify-between gap-8 px-5 py-2.5 border-b border-white/8 bg-[#0C0E13]">
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
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b-2 ${
              activeSection === 'studio'
                ? 'text-white border-[#F14624]'
                : 'border-transparent hover:text-white'
            }`}
          >
            Studio Mix
          </button>
          <button
            type="button"
            onClick={() => onNavigate('pitch')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b-2 ${
              activeSection === 'pitch'
                ? 'text-white border-[#F14624]'
                : 'border-transparent hover:text-white'
            }`}
          >
            AutoPitch &amp; FX
          </button>
          <button
            type="button"
            onClick={() => onNavigate('export')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b-2 ${
              activeSection === 'export'
                ? 'text-white border-[#F14624]'
                : 'border-transparent hover:text-white'
            }`}
          >
            HD Export
          </button>
          <button
            type="button"
            onClick={() => onNavigate('share')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b-2 ${
              activeSection === 'share'
                ? 'text-white border-[#F14624]'
                : 'border-transparent hover:text-white'
            }`}
          >
            Publish &amp; Share
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('export')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F14624] hover:bg-[#ff5633] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F14624]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Mix</span>
          </button>
        </div>
      </header>

      {/* BandLab-Style DAW Transport & Project Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-[#141720]">
        {/* Left: Project Title, Save, Library, Undo/Redo */}
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="text"
            value={project.title}
            onChange={(e) => onUpdateProject({ title: e.target.value })}
            aria-label="Project title"
            className="bg-[#0D0F15] text-sm font-semibold text-slate-100 border border-white/10 hover:border-white/20 focus:border-[#F14624] rounded-md px-2.5 py-1.5 outline-none w-36 sm:w-44 truncate transition-colors"
          />

          <button
            type="button"
            onClick={onSaveProject}
            disabled={isSaving}
            title="Save project locally (Ctrl+S)"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              hasUnsavedChanges
                ? 'bg-[#F14624]/15 text-[#FF7A59] border-[#F14624]/45 hover:bg-[#F14624]/25'
                : 'bg-[#1B202C] text-emerald-300 border-white/10 hover:bg-[#222836]'
            }`}
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : hasUnsavedChanges || !lastSavedAt ? (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenProjects}
            title="Open saved projects"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#1B202C] hover:bg-[#242A3A] text-slate-200 border border-white/10 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FolderOpen className="w-3.5 h-3.5 text-slate-300" />
            <span className="hidden sm:inline">Projects</span>
          </button>

          <div className="flex items-center bg-[#0D0F15] rounded-md border border-white/10 p-0.5">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: BandLab Transport Cluster */}
        <div className="flex items-center gap-1.5 bg-[#0D0F15] border border-white/10 rounded-lg px-2 py-1">
          <button
            type="button"
            onClick={onRewind}
            title="Return to start"
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onStop}
            title="Stop and reset playhead"
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isPlaying
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                : 'bg-[#1D2330] text-white hover:bg-[#272F40]'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleRecord}
            title="Record armed track"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isRecording || countInBeat !== null
                ? 'bg-[#FF3B30] text-white'
                : 'bg-[#261618] text-[#FF5E54] hover:bg-[#3A1C20] border border-[#FF3B30]/30'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-3 h-3 fill-current" />
                <span>Rec Stop</span>
              </>
            ) : countInBeat !== null ? (
              <>
                <Timer className="w-3.5 h-3.5" />
                <span className="tabular-nums">{countInBeat}</span>
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
            title="Toggle loop region (L)"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              loop.enabled
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Bar.Beat & Timecode LCD */}
          <div className="ml-1 pl-2.5 pr-1 border-l border-white/10 flex items-center gap-2.5 font-mono text-xs tabular-nums">
            <span className="text-slate-400 hidden sm:inline">
              {formatBarBeat(currentTimeSec, project.bpm, project.timeSignatureNumerator)}
            </span>
            <span className="text-white font-semibold">{formatTimecode(currentTimeSec)}</span>
          </div>
        </div>

        {/* Right: Tempo, Key, Click, Demo & Share */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0D0F15] border border-white/10 rounded-md px-2 py-1 gap-1">
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
              className="w-10 bg-transparent text-xs font-mono font-semibold text-white text-right outline-none tabular-nums"
            />
            <span className="text-[11px] text-slate-400">BPM</span>
          </div>

          <div className="hidden xl:flex items-center gap-1 bg-[#0D0F15] border border-white/10 rounded-md px-1.5 py-1">
            <select
              value={musicalKey}
              onChange={(e) => onChangeKey(e.target.value as MusicalKey)}
              aria-label="Project key"
              className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer"
            >
              {NOTE_NAMES.map((k) => (
                <option key={k} value={k} className="bg-[#141720]">
                  {k}
                </option>
              ))}
            </select>
            <select
              value={scale}
              onChange={(e) => onChangeScale(e.target.value as ScaleType)}
              aria-label="Project scale"
              className="bg-transparent text-xs text-slate-300 outline-none cursor-pointer"
            >
              <option value="Major" className="bg-[#141720]">Maj</option>
              <option value="Natural Minor" className="bg-[#141720]">Min</option>
              <option value="Chromatic" className="bg-[#141720]">Chrom</option>
              <option value="Pentatonic Major" className="bg-[#141720]">Pent Maj</option>
              <option value="Pentatonic Minor" className="bg-[#141720]">Pent Min</option>
              <option value="Harmonic Minor" className="bg-[#141720]">Harm Min</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => onUpdateProject({ metronomeEnabled: !project.metronomeEnabled })}
            title="Toggle metronome click"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              project.metronomeEnabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-[#1B202C] text-slate-400 hover:text-white border-white/10'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onLoadDemo}
            disabled={isLoadingDemo}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#1B202C] hover:bg-[#242A3A] text-slate-200 border border-white/10 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">
              {isLoadingDemo ? 'Loading...' : hasAnyTracks ? 'Demo Quartet' : 'Load Quartet'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('share')}
            title="Share performance"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#1B202C] hover:bg-[#242A3A] text-slate-200 border border-white/10 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">Share</span>
          </button>
        </div>
      </div>
    </div>
  );
};
