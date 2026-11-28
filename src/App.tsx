import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { extractWaveformPeaks, studioAudio } from './audio/studioEngine';
import { CollageStage } from './components/CollageStage';
import { DeviceModal } from './components/DeviceModal';
import { ExportModal } from './components/ExportModal';
import { PitchLabPanel, type DockTab } from './components/PitchLabPanel';
import { ProjectsModal } from './components/ProjectsModal';
import { ShareModal } from './components/ShareModal';
import { TimelinePanel } from './components/TimelinePanel';
import { TopBar } from './components/TopBar';
import {
  deleteProjectFromDb,
  getLastProjectId,
  listSavedProjects,
  loadProjectFromDb,
  saveProjectToDb,
} from './storage/projectStorage';
import type {
  AspectRatio,
  CollageLayout,
  ExportResult,
  LivePitchReading,
  LoopRegion,
  PitchSettings,
  ProjectMeta,
  SavedProjectSummary,
  StudioSnapshot,
  Track,
} from './types/studio';

const TRACK_PALETTE = [
  '#F14624',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

function createEmptyTrack(
  index: number,
  role: Track['role'],
  name: string,
  singerName: string,
  armed = false
): Track {
  return {
    id: `track-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    singerName,
    role,
    color: TRACK_PALETTE[index % TRACK_PALETTE.length],
    muted: false,
    solo: false,
    armed,
    volume: 1.0,
    pan: 0,
    fxPreset: 'clean',
    fxEnabled: true,
    reverbSend: 0.2,
    delayMix: 0,
    delayTimeMs: 140,
    delayFeedback: 0.2,
    chorusDepth: 0,
    compThreshold: -18,
    compRatio: 3,
    eqLow: 0,
    eqMid: 1,
    eqHigh: 2,
    clipGainDb: 0,
    semitoneShift: 0,
    centsDetune: 0,
    trimStartSec: 0,
    trimEndSec: 0,
    fadeInSec: 0,
    fadeOutSec: 0,
    reversed: false,
    pitchCorrectTake: true,
    offsetSec: 0,
    durationSec: 0,
    audioBuffer: null,
    waveformPeaks: [],
    videoUrl: null,
    videoBlob: null,
    liveLevel: 0,
  };
}

function createInitialTracks(): Track[] {
  return [
    createEmptyTrack(0, 'Lead', 'Lead Vocal', 'Singer 1', true),
    createEmptyTrack(1, 'Harmony High', 'High Harmony', 'Singer 2', false),
    createEmptyTrack(2, 'Harmony Mid', 'Mid Harmony', 'Singer 3', false),
    createEmptyTrack(3, 'Bass', 'Vocal Bass', 'Singer 4', false),
  ];
}

function createDefaultProject(): ProjectMeta {
  return {
    id: `proj-${Date.now()}`,
    title: 'Midnight Harmony',
    bpm: 100,
    timeSignatureNumerator: 4,
    metronomeEnabled: false,
    countInBars: 1,
    latencyOffsetMs: 45,
  };
}

const MAX_HISTORY = 40;

export default function App() {
  const [tracks, setTracks] = useState<Track[]>(createInitialTracks);
  const [selectedTrackId, setSelectedTrackId] = useState<string>(() => '');
  const [project, setProject] = useState<ProjectMeta>(createDefaultProject);

  const [pitchSettings, setPitchSettings] = useState<PitchSettings>({
    enabled: true,
    key: 'C',
    scale: 'Major',
    retuneSpeed: 78,
    humanize: 25,
    monitorCorrected: false,
  });

  const [livePitch, setLivePitch] = useState<LivePitchReading>({
    frequency: 0,
    targetFrequency: 0,
    noteName: '—',
    targetNoteName: '—',
    cents: 0,
    confidence: 0,
    shiftRatio: 1,
  });
  const [micLevel, setMicLevel] = useState(0);

  const [layout, setLayout] = useState<CollageLayout>('grid-2x2');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [loop, setLoop] = useState<LoopRegion>({
    enabled: false,
    startSec: 0,
    endSec: 9.6,
  });

  // Ensure a valid selectedTrackId on initial mount
  useEffect(() => {
    setSelectedTrackId((prev) => (prev ? prev : tracks[0]?.id ?? ''));
  }, [tracks]);

  // Undo / Redo History Stacks
  const [pastHistory, setPastHistory] = useState<StudioSnapshot[]>([]);
  const [futureHistory, setFutureHistory] = useState<StudioSnapshot[]>([]);
  const lastEditSnapshotTimeRef = useRef<number>(0);

  // Project Persistence State
  const [savedProjects, setSavedProjects] = useState<SavedProjectSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showProjectsModal, setShowProjectsModal] = useState(false);

  // Transport & Dock UI State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [countInBeat, setCountInBeat] = useState<number | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [dockTab, setDockTab] = useState<DockTab>('fx');
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Modals & Navigation
  const [activeNav, setActiveNav] = useState<'studio' | 'pitch' | 'export' | 'share'>('studio');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [lastExport, setLastExport] = useState<ExportResult | null>(null);

  // Live Media Stream & Recording Refs
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [processedAudioStream, setProcessedAudioStream] = useState<MediaStream | null>(null);
  const [hasMic, setHasMic] = useState(false);
  const [hasCam, setHasCam] = useState(false);
  const [isVirtualInput, setIsVirtualInput] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState('');

  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const virtualStopRef = useRef<(() => void) | null>(null);
  const recordingStartSecRef = useRef(0);
  const countInTimerRef = useRef<number | null>(null);
  const lastMetronomeBeatRef = useRef<number>(-1);
  const dockSectionRef = useRef<HTMLDivElement | null>(null);

  const captureSnapshot = useCallback(
    (): StudioSnapshot => ({
      tracks: tracks.map((t) => ({ ...t, liveLevel: 0 })),
      project: { ...project },
      pitchSettings: { ...pitchSettings },
      loop: { ...loop },
      layout,
      aspectRatio,
    }),
    [tracks, project, pitchSettings, loop, layout, aspectRatio]
  );

  const pushUndoCheckpoint = useCallback(
    (coalesceMs = 0) => {
      const now = Date.now();
      if (coalesceMs > 0 && now - lastEditSnapshotTimeRef.current < coalesceMs && pastHistory.length > 0) {
        setHasUnsavedChanges(true);
        return;
      }
      lastEditSnapshotTimeRef.current = now;
      const snap = captureSnapshot();
      setPastHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), snap]);
      setFutureHistory([]);
      setHasUnsavedChanges(true);
    },
    [captureSnapshot, pastHistory.length]
  );

  const applySnapshot = useCallback((snap: StudioSnapshot) => {
    setTracks(snap.tracks);
    setProject(snap.project);
    setPitchSettings(snap.pitchSettings);
    setLoop(snap.loop);
    setLayout(snap.layout);
    setAspectRatio(snap.aspectRatio);
    setHasUnsavedChanges(true);
  }, []);

  const handleUndo = useCallback(() => {
    if (pastHistory.length === 0) return;
    const previous = pastHistory[pastHistory.length - 1];
    const current = captureSnapshot();
    setPastHistory((prev) => prev.slice(0, -1));
    setFutureHistory((prev) => [current, ...prev.slice(0, MAX_HISTORY - 1)]);
    applySnapshot(previous);
  }, [pastHistory, captureSnapshot, applySnapshot]);

  const handleRedo = useCallback(() => {
    if (futureHistory.length === 0) return;
    const next = futureHistory[0];
    const current = captureSnapshot();
    setFutureHistory((prev) => prev.slice(1));
    setPastHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), current]);
    applySnapshot(next);
  }, [futureHistory, captureSnapshot, applySnapshot]);

  // Load saved projects index + restore last active project on startup
  useEffect(() => {
    let mounted = true;
    const initStorage = async () => {
      try {
        const list = await listSavedProjects();
        if (!mounted) return;
        setSavedProjects(list);
        const lastId = getLastProjectId();
        if (lastId) {
          const ctx = await studioAudio.ensureContext();
          const loaded = await loadProjectFromDb(lastId, ctx);
          if (loaded && mounted) {
            setTracks(loaded.tracks);
            setSelectedTrackId(loaded.tracks[0]?.id ?? '');
            setProject(loaded.project);
            setPitchSettings(loaded.pitchSettings);
            setLoop(loaded.loop);
            setLayout(loaded.layout);
            setAspectRatio(loaded.aspectRatio);
            setLastSavedAt(loaded.updatedAt);
            setHasUnsavedChanges(false);
          }
        }
      } catch (err) {
        console.warn('IndexedDB project load skipped:', err);
      }
    };
    initStorage();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveProject = useCallback(async () => {
    setIsSaving(true);
    try {
      const updatedAt = await saveProjectToDb({
        project,
        pitchSettings,
        loop,
        layout,
        aspectRatio,
        tracks,
      });
      setLastSavedAt(updatedAt);
      setHasUnsavedChanges(false);
      const list = await listSavedProjects();
      setSavedProjects(list);
    } finally {
      setIsSaving(false);
    }
  }, [project, pitchSettings, loop, layout, aspectRatio, tracks]);

  const handleSaveAsNew = useCallback(async () => {
    const newProj: ProjectMeta = {
      ...project,
      id: `proj-${Date.now()}`,
      title: `${project.title} (Copy)`,
    };
    setProject(newProj);
    setIsSaving(true);
    try {
      const updatedAt = await saveProjectToDb({
        project: newProj,
        pitchSettings,
        loop,
        layout,
        aspectRatio,
        tracks,
      });
      setLastSavedAt(updatedAt);
      setHasUnsavedChanges(false);
      setSavedProjects(await listSavedProjects());
      setShowProjectsModal(false);
    } finally {
      setIsSaving(false);
    }
  }, [project, pitchSettings, loop, layout, aspectRatio, tracks]);

  const handleLoadProjectById = useCallback(async (id: string) => {
    studioAudio.stopPlayback();
    setIsPlaying(false);
    const ctx = await studioAudio.ensureContext();
    const loaded = await loadProjectFromDb(id, ctx);
    if (!loaded) return;
    setTracks(loaded.tracks);
    setSelectedTrackId(loaded.tracks[0]?.id ?? '');
    setProject(loaded.project);
    setPitchSettings(loaded.pitchSettings);
    setLoop(loaded.loop);
    setLayout(loaded.layout);
    setAspectRatio(loaded.aspectRatio);
    setLastSavedAt(loaded.updatedAt);
    setHasUnsavedChanges(false);
    setPastHistory([]);
    setFutureHistory([]);
    setCurrentTimeSec(0);
    setShowProjectsModal(false);
  }, []);

  const handleDeleteProjectById = useCallback(async (id: string) => {
    await deleteProjectFromDb(id);
    setSavedProjects(await listSavedProjects());
  }, []);

  const handleNewBlankProject = useCallback(() => {
    studioAudio.stopPlayback();
    setIsPlaying(false);
    const freshTracks = createInitialTracks();
    setTracks(freshTracks);
    setSelectedTrackId(freshTracks[0].id);
    setProject(createDefaultProject());
    setLoop({ enabled: false, startSec: 0, endSec: 9.6 });
    setPastHistory([]);
    setFutureHistory([]);
    setHasUnsavedChanges(false);
    setLastSavedAt(null);
    setCurrentTimeSec(0);
    setShowProjectsModal(false);
  }, []);

  const totalDurationSec = useMemo(() => {
    let maxEnd = 0;
    for (const t of tracks) {
      if (t.audioBuffer) {
        const effectiveEnd =
          t.trimEndSec > t.trimStartSec + 0.05 ? t.trimEndSec : t.durationSec;
        const span = Math.max(0, effectiveEnd - t.trimStartSec);
        const rate = Math.pow(2, (t.semitoneShift + t.centsDetune / 100) / 12);
        maxEnd = Math.max(maxEnd, t.offsetSec + span / rate);
      }
    }
    return Math.max(9.6, maxEnd);
  }, [tracks]);

  const hasAnyTracks = useMemo(() => tracks.some((t) => t.audioBuffer !== null), [tracks]);
  const selectedTrack = useMemo(
    () => tracks.find((t) => t.id === selectedTrackId) ?? tracks[0],
    [tracks, selectedTrackId]
  );

  // Sync live mix/FX sliders with active Web Audio nodes
  useEffect(() => {
    studioAudio.updateLiveTrackParams(tracks);
  }, [tracks]);

  // Connect real Mic & Camera
  const connectDevices = useCallback(
    async (audioId: string, videoId: string, includeVideo: boolean) => {
      setDeviceError(null);
      try {
        liveStream?.getTracks().forEach((t) => t.stop());
        virtualStopRef.current?.();
        virtualStopRef.current = null;

        const constraints: MediaStreamConstraints = {
          audio: {
            deviceId: audioId ? { exact: audioId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: includeVideo
            ? {
                deviceId: videoId ? { exact: videoId } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
              }
            : false,
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: audioId ? { exact: audioId } : undefined,
              echoCancellation: false,
            },
            video: false,
          });
        }

        const tunedAudioStream = await studioAudio.attachLiveMicrophone(stream, pitchSettings);
        setLiveStream(stream);
        setProcessedAudioStream(tunedAudioStream);
        setHasMic(stream.getAudioTracks().length > 0);
        setHasCam(stream.getVideoTracks().length > 0);
        setIsVirtualInput(false);
        setSelectedAudioId(audioId);
        setSelectedVideoId(videoId);
        return { stream, tunedAudioStream };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Camera/Microphone access denied. You can connect a device or use Virtual Vocal Synth.';
        setDeviceError(message);
        throw err;
      }
    },
    [liveStream, pitchSettings]
  );

  const connectVirtualInput = useCallback(async () => {
    setDeviceError(null);
    liveStream?.getTracks().forEach((t) => t.stop());
    virtualStopRef.current?.();

    const { stream, stop } = await studioAudio.createVirtualMicStream();
    virtualStopRef.current = stop;
    const tunedAudioStream = await studioAudio.attachLiveMicrophone(stream, pitchSettings);
    setLiveStream(stream);
    setProcessedAudioStream(tunedAudioStream);
    setHasMic(true);
    setHasCam(false);
    setIsVirtualInput(true);
  }, [liveStream, pitchSettings]);

  // Animation loop for transport timecode, metronome click, level meters, and AutoPitch
  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      if (hasMic) {
        const { reading, inputLevel } = studioAudio.sampleLivePitch(pitchSettings);
        setLivePitch(reading);
        setMicLevel(inputLevel);
      }

      if (isPlaying || isRecording) {
        const t = studioAudio.getCurrentTransportTime();
        setCurrentTimeSec(t);

        const levels = studioAudio.getTrackLevels();
        setTracks((prev) =>
          prev.map((tr) => ({
            ...tr,
            liveLevel:
              tr.armed && isRecording ? Math.max(micLevel, levels[tr.id] ?? 0) : levels[tr.id] ?? 0,
          }))
        );

        if (project.metronomeEnabled) {
          const beatFloat = (t * project.bpm) / 60;
          const beatInt = Math.floor(beatFloat);
          if (beatInt !== lastMetronomeBeatRef.current) {
            lastMetronomeBeatRef.current = beatInt;
            studioAudio.playMetronomeClick(beatInt % project.timeSignatureNumerator === 0);
          }
        }

        if (isPlaying && !isRecording && !loop.enabled && t >= totalDurationSec) {
          studioAudio.stopPlayback(0);
          setIsPlaying(false);
          setCurrentTimeSec(0);
          lastMetronomeBeatRef.current = -1;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    hasMic,
    pitchSettings,
    isPlaying,
    isRecording,
    project.metronomeEnabled,
    project.bpm,
    project.timeSignatureNumerator,
    loop.enabled,
    totalDurationSec,
    micLevel,
  ]);

  // Transport Controls: Play/Pause, Dedicated Stop, Rewind, Seek
  const handleTogglePlay = useCallback(async () => {
    if (isRecording) return;

    if (isPlaying) {
      const pausedAt = studioAudio.getCurrentTransportTime();
      studioAudio.stopPlayback(pausedAt);
      setIsPlaying(false);
      setCurrentTimeSec(pausedAt);
      setTracks((prev) => prev.map((t) => ({ ...t, liveLevel: 0 })));
      return;
    }

    if (!hasAnyTracks) return;

    const startPos =
      loop.enabled && (currentTimeSec < loop.startSec || currentTimeSec >= loop.endSec)
        ? loop.startSec
        : currentTimeSec >= totalDurationSec
          ? 0
          : currentTimeSec;

    lastMetronomeBeatRef.current = -1;
    await studioAudio.startPlayback(tracks, startPos, loop);
    setIsPlaying(true);
  }, [isRecording, isPlaying, hasAnyTracks, loop, currentTimeSec, totalDurationSec, tracks]);

  const stopRecordingTake = useCallback(() => {
    if (countInTimerRef.current !== null) {
      window.clearInterval(countInTimerRef.current);
      countInTimerRef.current = null;
      setCountInBeat(null);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    studioAudio.stopPlayback(0);
    setIsRecording(false);
    setIsPlaying(false);
    setTracks((prev) => prev.map((t) => ({ ...t, liveLevel: 0 })));
  }, []);

  const handleStop = useCallback(() => {
    if (isRecording || countInBeat !== null) {
      stopRecordingTake();
    }
    const resetTarget = loop.enabled ? loop.startSec : 0;
    studioAudio.stopPlayback(resetTarget);
    setIsPlaying(false);
    setCurrentTimeSec(resetTarget);
    lastMetronomeBeatRef.current = -1;
    setTracks((prev) => prev.map((t) => ({ ...t, liveLevel: 0 })));
  }, [isRecording, countInBeat, stopRecordingTake, loop]);

  const handleRewind = useCallback(async () => {
    const target = loop.enabled ? loop.startSec : 0;
    setCurrentTimeSec(target);
    lastMetronomeBeatRef.current = -1;
    if (isPlaying) {
      await studioAudio.startPlayback(tracks, target, loop);
    }
  }, [loop, isPlaying, tracks]);

  const handleSeek = useCallback(
    async (sec: number) => {
      const clamped = Math.max(0, sec);
      setCurrentTimeSec(clamped);
      lastMetronomeBeatRef.current = -1;
      if (isPlaying && !isRecording) {
        await studioAudio.startPlayback(tracks, clamped, loop);
      }
    },
    [isPlaying, isRecording, tracks, loop]
  );

  // Recording Pipeline
  const beginCapture = useCallback(
    async (activeStream: MediaStream, tunedAudio: MediaStream, armedTrackId: string) => {
      const startSec = loop.enabled ? loop.startSec : currentTimeSec;
      recordingStartSecRef.current = startSec;

      const combinedTracks: MediaStreamTrack[] = [...tunedAudio.getAudioTracks()];
      const videoTracks = activeStream.getVideoTracks();
      const hasVideo = videoTracks.length > 0;
      if (hasVideo) {
        combinedTracks.push(...videoTracks);
      }
      const captureStream = new MediaStream(combinedTracks);

      const mimeCandidates = hasVideo
        ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        : ['audio/webm;codecs=opus', 'audio/webm'];
      const chosenMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

      recordedChunksRef.current = [];
      const recorder = chosenMime
        ? new MediaRecorder(captureStream, { mimeType: chosenMime })
        : new MediaRecorder(captureStream);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: chosenMime || (hasVideo ? 'video/webm' : 'audio/webm'),
        });
        if (blob.size < 100) return;

        try {
          const decoded = await studioAudio.decodeAudioBlob(blob);
          const peaks = extractWaveformPeaks(decoded, 180);
          const compensatedOffset = Math.max(
            0,
            Number((recordingStartSecRef.current - project.latencyOffsetMs / 1000).toFixed(2))
          );
          const videoUrl = hasVideo ? URL.createObjectURL(blob) : null;

          pushUndoCheckpoint();
          setTracks((prev) =>
            prev.map((t) => {
              if (t.id !== armedTrackId) return t;
              if (t.videoUrl) URL.revokeObjectURL(t.videoUrl);
              return {
                ...t,
                audioBuffer: decoded,
                waveformPeaks: peaks,
                durationSec: decoded.duration,
                trimStartSec: 0,
                trimEndSec: 0,
                offsetSec: compensatedOffset,
                videoUrl,
                videoBlob: hasVideo ? blob : null,
                isDemoSynthetic: false,
                pitchCorrectTake: pitchSettings.enabled,
              };
            })
          );
        } catch (err) {
          console.error('Could not decode recorded vocal take:', err);
        }
      };

      mediaRecorderRef.current = recorder;

      const backingTracks = tracks.filter((t) => t.id !== armedTrackId && t.audioBuffer !== null);
      if (backingTracks.length > 0) {
        await studioAudio.startPlayback(backingTracks, startSec, loop);
      } else {
        await studioAudio.ensureContext();
      }

      recorder.start(150);
      setIsRecording(true);
    },
    [loop, currentTimeSec, project.latencyOffsetMs, pitchSettings.enabled, tracks, pushUndoCheckpoint]
  );

  const handleToggleRecord = useCallback(async () => {
    if (isRecording || countInBeat !== null) {
      stopRecordingTake();
      return;
    }

    const armedTrack = tracks.find((t) => t.armed) ?? tracks[0];
    if (!armedTrack) return;

    let activeStream = liveStream;
    let tunedAudio = processedAudioStream;

    if (!activeStream || !tunedAudio) {
      try {
        const res = await connectDevices(selectedAudioId, selectedVideoId, true);
        activeStream = res.stream;
        tunedAudio = res.tunedAudioStream;
      } catch {
        setShowDeviceModal(true);
        return;
      }
    }

    await studioAudio.ensureContext();

    const beatMs = Math.round((60 / project.bpm) * 1000);
    let beatLeft = 4;
    setCountInBeat(beatLeft);
    studioAudio.playMetronomeClick(true);

    countInTimerRef.current = window.setInterval(() => {
      beatLeft -= 1;
      if (beatLeft > 0) {
        setCountInBeat(beatLeft);
        studioAudio.playMetronomeClick(false);
      } else {
        if (countInTimerRef.current !== null) {
          window.clearInterval(countInTimerRef.current);
          countInTimerRef.current = null;
        }
        setCountInBeat(null);
        beginCapture(activeStream!, tunedAudio!, armedTrack.id);
      }
    }, beatMs);
  }, [
    isRecording,
    countInBeat,
    stopRecordingTake,
    tracks,
    liveStream,
    processedAudioStream,
    connectDevices,
    selectedAudioId,
    selectedVideoId,
    project.bpm,
    beginCapture,
  ]);

  // Load 4-Part Demo Quartet
  const handleLoadDemo = useCallback(async () => {
    if (isRecording) return;
    if (isPlaying) {
      studioAudio.stopPlayback(0);
      setIsPlaying(false);
    }

    setIsLoadingDemo(true);
    try {
      pushUndoCheckpoint();
      const bpm = 100;
      const parts = await studioAudio.generateDemoQuartetBuffers(bpm);
      const demoTracks: Track[] = parts.map((part, idx) => ({
        ...createEmptyTrack(idx, part.role, part.name, part.singerName, false),
        id: `demo-track-${idx}-${Date.now()}`,
        color: part.color,
        volume: idx === 0 ? 1.05 : 0.85,
        pan: part.pan,
        reverbSend: part.reverbSend,
        eqLow: idx === 3 ? 3 : -1,
        eqMid: idx === 0 ? 2 : 0,
        eqHigh: idx === 0 ? 2 : 1,
        durationSec: part.buffer.duration,
        audioBuffer: part.buffer,
        waveformPeaks: extractWaveformPeaks(part.buffer, 180),
        isDemoSynthetic: true,
        demoHue: part.hue,
        demoNotes: part.notes,
      }));

      setTracks(demoTracks);
      setSelectedTrackId(demoTracks[0].id);
      setProject((p) => ({ ...p, title: 'Midnight Harmony Quartet', bpm }));
      setPitchSettings((ps) => ({ ...ps, key: 'C', scale: 'Major' }));
      setLoop({ enabled: true, startSec: 0, endSec: Number(((16 * 60) / bpm).toFixed(2)) });
      setCurrentTimeSec(0);
    } finally {
      setIsLoadingDemo(false);
    }
  }, [isRecording, isPlaying, pushUndoCheckpoint]);

  // Undoable Track & Clip Editing Handlers
  const handleUpdateTrack = useCallback(
    (id: string, patch: Partial<Track>) => {
      pushUndoCheckpoint(450);
      setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    [pushUndoCheckpoint]
  );

  const handleArmTrack = useCallback(
    (id: string) => {
      pushUndoCheckpoint();
      setTracks((prev) =>
        prev.map((t) => ({
          ...t,
          armed: t.id === id ? !t.armed : false,
        }))
      );
      setSelectedTrackId(id);
    },
    [pushUndoCheckpoint]
  );

  const handleToggleMute = useCallback(
    (id: string) => {
      pushUndoCheckpoint();
      setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)));
    },
    [pushUndoCheckpoint]
  );

  const handleToggleSolo = useCallback(
    (id: string) => {
      pushUndoCheckpoint();
      setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, solo: !t.solo } : t)));
    },
    [pushUndoCheckpoint]
  );

  const handleClearTrackTake = useCallback(
    (id: string) => {
      pushUndoCheckpoint();
      setTracks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          if (t.videoUrl) URL.revokeObjectURL(t.videoUrl);
          return {
            ...t,
            audioBuffer: null,
            waveformPeaks: [],
            durationSec: 0,
            trimStartSec: 0,
            trimEndSec: 0,
            videoUrl: null,
            videoBlob: null,
            isDemoSynthetic: false,
            liveLevel: 0,
          };
        })
      );
    },
    [pushUndoCheckpoint]
  );

  const handleAddTrack = useCallback(() => {
    if (tracks.length >= 8) return;
    pushUndoCheckpoint();
    const idx = tracks.length;
    const newTrack = createEmptyTrack(
      idx,
      'Layer',
      `Harmony ${idx + 1}`,
      `Singer ${idx + 1}`,
      true
    );
    setTracks((prev) => [...prev.map((t) => ({ ...t, armed: false })), newTrack]);
    setSelectedTrackId(newTrack.id);
  }, [tracks.length, pushUndoCheckpoint]);

  const handleDeleteTrack = useCallback(
    (id: string) => {
      if (tracks.length <= 1) return;
      pushUndoCheckpoint();
      setTracks((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (selectedTrackId === id && next[0]) {
          setSelectedTrackId(next[0].id);
        }
        return next;
      });
    },
    [tracks.length, selectedTrackId, pushUndoCheckpoint]
  );

  const handleDuplicateTrack = useCallback(
    (id: string) => {
      if (tracks.length >= 8) return;
      const src = tracks.find((t) => t.id === id);
      if (!src) return;
      pushUndoCheckpoint();
      const copy: Track = {
        ...src,
        id: `track-${Date.now()}-dup`,
        name: `${src.name} (Copy)`,
        armed: false,
        color: TRACK_PALETTE[tracks.length % TRACK_PALETTE.length],
        videoUrl: src.videoBlob ? URL.createObjectURL(src.videoBlob) : null,
        liveLevel: 0,
      };
      setTracks((prev) => [...prev, copy]);
      setSelectedTrackId(copy.id);
    },
    [tracks, pushUndoCheckpoint]
  );

  const handleNormalizeTrack = useCallback(
    async (id: string) => {
      const target = tracks.find((t) => t.id === id);
      if (!target?.audioBuffer) return;
      pushUndoCheckpoint();
      const norm = await studioAudio.normalizeAudioBuffer(target.audioBuffer);
      const peaks = extractWaveformPeaks(norm, 180);
      setTracks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, audioBuffer: norm, waveformPeaks: peaks } : t))
      );
    },
    [tracks, pushUndoCheckpoint]
  );

  const handleReverseTrack = useCallback(
    async (id: string) => {
      const target = tracks.find((t) => t.id === id);
      if (!target?.audioBuffer) return;
      pushUndoCheckpoint();
      const rev = await studioAudio.reverseAudioBuffer(target.audioBuffer);
      const peaks = extractWaveformPeaks(rev, 180);
      setTracks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, audioBuffer: rev, waveformPeaks: peaks, reversed: !t.reversed }
            : t
        )
      );
    },
    [tracks, pushUndoCheckpoint]
  );

  const handleSplitTrackAtPlayhead = useCallback(
    async (id: string) => {
      const target = tracks.find((t) => t.id === id);
      if (!target?.audioBuffer || tracks.length >= 8) return;
      const splitOffset = currentTimeSec - target.offsetSec;
      if (splitOffset <= 0.1 || splitOffset >= target.durationSec - 0.1) return;

      const splitRes = await studioAudio.splitAudioBufferAt(target.audioBuffer, splitOffset);
      if (!splitRes) return;
      const [leftBuf, rightBuf] = splitRes;
      pushUndoCheckpoint();

      const rightTrack: Track = {
        ...target,
        id: `track-${Date.now()}-split`,
        name: `${target.name} (Part 2)`,
        armed: false,
        color: TRACK_PALETTE[tracks.length % TRACK_PALETTE.length],
        offsetSec: Number((target.offsetSec + leftBuf.duration).toFixed(2)),
        durationSec: rightBuf.duration,
        trimStartSec: 0,
        trimEndSec: 0,
        audioBuffer: rightBuf,
        waveformPeaks: extractWaveformPeaks(rightBuf, 140),
        videoUrl: null,
        videoBlob: null,
        liveLevel: 0,
      };

      setTracks((prev) => {
        const updated = prev.map((t) =>
          t.id === id
            ? {
                ...t,
                durationSec: leftBuf.duration,
                trimStartSec: 0,
                trimEndSec: 0,
                audioBuffer: leftBuf,
                waveformPeaks: extractWaveformPeaks(leftBuf, 140),
              }
            : t
        );
        return [...updated, rightTrack];
      });
    },
    [tracks, currentTimeSec, pushUndoCheckpoint]
  );

  // Keyboard Shortcuts: Space (Play/Pause), L (Loop), Ctrl+Z (Undo), Ctrl+Shift+Z / Ctrl+Y (Redo), Ctrl+S (Save)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (isMod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (isMod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveProject();
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'KeyL') {
        pushUndoCheckpoint();
        setLoop((prev) => ({ ...prev, enabled: !prev.enabled }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlay, handleUndo, handleRedo, handleSaveProject, pushUndoCheckpoint]);

  const handleTopNavigate = (section: 'studio' | 'pitch' | 'export' | 'share') => {
    setActiveNav(section);
    if (section === 'export') {
      setShowExportModal(true);
    } else if (section === 'share') {
      setShowShareModal(true);
    } else if (section === 'pitch') {
      setDockTab('autopitch');
      setDockCollapsed(false);
      dockSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0E1015] text-slate-100">
      <TopBar
        activeSection={activeNav}
        onNavigate={handleTopNavigate}
        project={project}
        onUpdateProject={(patch) => {
          pushUndoCheckpoint(600);
          setProject((prev) => ({ ...prev, ...patch }));
        }}
        musicalKey={pitchSettings.key}
        scale={pitchSettings.scale}
        onChangeKey={(key) => {
          pushUndoCheckpoint();
          setPitchSettings((prev) => ({ ...prev, key }));
        }}
        onChangeScale={(scale) => {
          pushUndoCheckpoint();
          setPitchSettings((prev) => ({ ...prev, scale }));
        }}
        isPlaying={isPlaying}
        isRecording={isRecording}
        countInBeat={countInBeat}
        currentTimeSec={currentTimeSec}
        loop={loop}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        onRewind={handleRewind}
        onToggleRecord={handleToggleRecord}
        onToggleLoop={() => {
          pushUndoCheckpoint();
          setLoop((prev) => ({ ...prev, enabled: !prev.enabled }));
        }}
        onLoadDemo={handleLoadDemo}
        hasAnyTracks={hasAnyTracks}
        isLoadingDemo={isLoadingDemo}
        canUndo={pastHistory.length > 0}
        canRedo={futureHistory.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSaveProject={handleSaveProject}
        onOpenProjects={() => setShowProjectsModal(true)}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        lastSavedAt={lastSavedAt}
      />

      {/* BandLab-Style Upper Studio: Multi-Track Arrangement Left + Video Collage Monitor Right */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        <TimelinePanel
          tracks={tracks}
          selectedTrackId={selectedTrackId}
          onSelectTrack={setSelectedTrackId}
          onArmTrack={handleArmTrack}
          onToggleMute={handleToggleMute}
          onToggleSolo={handleToggleSolo}
          onUpdateTrack={handleUpdateTrack}
          onAddTrack={handleAddTrack}
          onDeleteTrack={handleDeleteTrack}
          onDuplicateTrack={handleDuplicateTrack}
          onSplitTrackAtPlayhead={handleSplitTrackAtPlayhead}
          onOpenFxForTrack={(id) => {
            setSelectedTrackId(id);
            setDockTab('fx');
            setDockCollapsed(false);
          }}
          currentTimeSec={currentTimeSec}
          totalDurationSec={totalDurationSec}
          bpm={project.bpm}
          loop={loop}
          onUpdateLoop={(patch) => {
            pushUndoCheckpoint(400);
            setLoop((prev) => ({ ...prev, ...patch }));
          }}
          onSeek={handleSeek}
        />

        <CollageStage
          tracks={tracks}
          selectedTrackId={selectedTrackId}
          onSelectTrack={setSelectedTrackId}
          onArmTrack={handleArmTrack}
          onToggleMute={handleToggleMute}
          onToggleSolo={handleToggleSolo}
          onClearTrackTake={handleClearTrackTake}
          layout={layout}
          onChangeLayout={(nextLayout) => {
            pushUndoCheckpoint();
            setLayout(nextLayout);
          }}
          aspectRatio={aspectRatio}
          onChangeAspectRatio={(nextRatio) => {
            pushUndoCheckpoint();
            setAspectRatio(nextRatio);
          }}
          liveStream={liveStream}
          hasMic={hasMic}
          hasCam={hasCam}
          isVirtualInput={isVirtualInput}
          onOpenDeviceModal={() => setShowDeviceModal(true)}
          isPlaying={isPlaying}
          isRecording={isRecording}
          countInBeat={countInBeat}
          currentTimeSec={currentTimeSec}
          bpm={project.bpm}
          videoElementsRef={videoElementsRef}
        />
      </main>

      {/* BandLab-Style Bottom Studio Editor Dock: FX Chain, Audio Clip Editor, AutoPitch */}
      <div ref={dockSectionRef}>
        <PitchLabPanel
          activeTab={dockTab}
          onChangeTab={setDockTab}
          isCollapsed={dockCollapsed}
          onToggleCollapse={() => setDockCollapsed((c) => !c)}
          pitchSettings={pitchSettings}
          onUpdatePitchSettings={(patch) => {
            pushUndoCheckpoint(400);
            setPitchSettings((prev) => ({ ...prev, ...patch }));
          }}
          livePitch={livePitch}
          micLevel={micLevel}
          selectedTrack={selectedTrack}
          onUpdateTrack={handleUpdateTrack}
          onNormalizeTrack={handleNormalizeTrack}
          onReverseTrack={handleReverseTrack}
          onSplitTrack={handleSplitTrackAtPlayhead}
          latencyOffsetMs={project.latencyOffsetMs}
          onUpdateLatencyOffset={(latencyOffsetMs) => {
            pushUndoCheckpoint(400);
            setProject((prev) => ({ ...prev, latencyOffsetMs }));
          }}
        />
      </div>

      {/* Modals */}
      <ProjectsModal
        isOpen={showProjectsModal}
        onClose={() => setShowProjectsModal(false)}
        projects={savedProjects}
        currentProjectId={project.id}
        onLoadProject={handleLoadProjectById}
        onDeleteProject={handleDeleteProjectById}
        onSaveAsNew={handleSaveAsNew}
        onNewBlankProject={handleNewBlankProject}
      />

      <DeviceModal
        isOpen={showDeviceModal}
        onClose={() => setShowDeviceModal(false)}
        selectedAudioId={selectedAudioId}
        selectedVideoId={selectedVideoId}
        onConnectDevices={connectDevices}
        onUseVirtualInput={connectVirtualInput}
        errorMsg={deviceError}
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setActiveNav('studio');
        }}
        tracks={tracks}
        layout={layout}
        defaultAspectRatio={aspectRatio}
        projectTitle={project.title}
        bpm={project.bpm}
        totalDurationSec={totalDurationSec}
        videoElementsRef={videoElementsRef}
        lastExport={lastExport}
        onExportComplete={(res) => setLastExport(res)}
        onOpenShare={() => {
          setShowShareModal(true);
          setActiveNav('share');
        }}
      />

      <ShareModal
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setActiveNav('studio');
        }}
        tracks={tracks}
        layout={layout}
        projectTitle={project.title}
        bpm={project.bpm}
        musicalKey={pitchSettings.key}
        lastExport={lastExport}
        videoElementsRef={videoElementsRef}
        onOpenExport={() => {
          setShowExportModal(true);
          setActiveNav('export');
        }}
      />
    </div>
  );
}
