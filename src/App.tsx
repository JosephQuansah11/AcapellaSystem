import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { extractWaveformPeaks, studioAudio } from './audio/studioEngine';
import { CollageStage } from './components/CollageStage';
import { DeviceModal } from './components/DeviceModal';
import { ExportModal } from './components/ExportModal';
import { PitchLabPanel } from './components/PitchLabPanel';
import { ShareModal } from './components/ShareModal';
import { TimelinePanel } from './components/TimelinePanel';
import { TopBar } from './components/TopBar';
import type {
  AspectRatio,
  CollageLayout,
  ExportResult,
  LivePitchReading,
  LoopRegion,
  PitchSettings,
  ProjectMeta,
  Track,
} from './types/studio';

const TRACK_PALETTE = [
  '#E11D48',
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
    id: `track-${Date.now()}-${index}`,
    name,
    singerName,
    role,
    color: TRACK_PALETTE[index % TRACK_PALETTE.length],
    muted: false,
    solo: false,
    armed,
    volume: 1.0,
    pan: 0,
    reverbSend: 0.25,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
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

const INITIAL_TRACKS: Track[] = [
  createEmptyTrack(0, 'Lead', 'Lead Vocal', 'Singer 1', true),
  createEmptyTrack(1, 'Harmony High', 'High Harmony', 'Singer 2', false),
  createEmptyTrack(2, 'Harmony Mid', 'Mid Harmony', 'Singer 3', false),
  createEmptyTrack(3, 'Bass', 'Vocal Bass', 'Singer 4', false),
];

export default function App() {
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [selectedTrackId, setSelectedTrackId] = useState<string>(INITIAL_TRACKS[0].id);
  const [project, setProject] = useState<ProjectMeta>({
    title: 'Midnight Harmony',
    bpm: 100,
    timeSignatureNumerator: 4,
    metronomeEnabled: false,
    countInBars: 1,
    latencyOffsetMs: 45,
  });

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

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [countInBeat, setCountInBeat] = useState<number | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

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
  const pitchLabSectionRef = useRef<HTMLDivElement | null>(null);

  const totalDurationSec = useMemo(() => {
    let maxEnd = 0;
    for (const t of tracks) {
      if (t.audioBuffer) {
        maxEnd = Math.max(maxEnd, t.offsetSec + t.durationSec);
      }
    }
    return Math.max(9.6, maxEnd);
  }, [tracks]);

  const hasAnyTracks = useMemo(() => tracks.some((t) => t.audioBuffer !== null), [tracks]);
  const selectedTrack = useMemo(
    () => tracks.find((t) => t.id === selectedTrackId) ?? tracks[0],
    [tracks, selectedTrackId]
  );

  // Sync live mix sliders with active Web Audio nodes
  useEffect(() => {
    studioAudio.updateLiveTrackParams(tracks);
  }, [tracks]);

  // Connect real Mic & Camera
  const connectDevices = useCallback(
    async (audioId: string, videoId: string, includeVideo: boolean) => {
      setDeviceError(null);
      try {
        // Stop prior stream
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
          // Retry audio-only if camera failed/unavailable
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

  // Animation loop for transport timecode, metronome click, level meters, and real-time pitch correction
  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      // 1. Live pitch detection + AudioWorklet retune update
      if (hasMic) {
        const { reading, inputLevel } = studioAudio.sampleLivePitch(pitchSettings);
        setLivePitch(reading);
        setMicLevel(inputLevel);
      }

      // 2. Playback / Recording transport clock
      if (isPlaying || isRecording) {
        const t = studioAudio.getCurrentTransportTime();
        setCurrentTimeSec(t);

        const levels = studioAudio.getTrackLevels();
        setTracks((prev) =>
          prev.map((tr) => ({
            ...tr,
            liveLevel: tr.armed && isRecording ? Math.max(micLevel, levels[tr.id] ?? 0) : levels[tr.id] ?? 0,
          }))
        );

        // Metronome click on beat crossings
        if (project.metronomeEnabled) {
          const beatFloat = (t * project.bpm) / 60;
          const beatInt = Math.floor(beatFloat);
          if (beatInt !== lastMetronomeBeatRef.current) {
            lastMetronomeBeatRef.current = beatInt;
            studioAudio.playMetronomeClick(beatInt % project.timeSignatureNumerator === 0);
          }
        }

        // Stop playback automatically at end when not looping and not recording
        if (isPlaying && !isRecording && !loop.enabled && t >= totalDurationSec) {
          studioAudio.stopPlayback();
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

  // Playback Controls
  const handleTogglePlay = useCallback(async () => {
    if (isRecording) return;

    if (isPlaying) {
      studioAudio.stopPlayback();
      setIsPlaying(false);
      setTracks((prev) => prev.map((t) => ({ ...t, liveLevel: 0 })));
      return;
    }

    if (!hasAnyTracks) {
      // Load demo quartet automatically if user hits Play on empty studio? No, only if tracks exist, or prompt gently
      return;
    }

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

  // Recording Pipeline (with 4-beat count-in & loop-aligned overdubbing)
  const stopRecordingTake = useCallback(() => {
    if (countInTimerRef.current !== null) {
      window.clearInterval(countInTimerRef.current);
      countInTimerRef.current = null;
      setCountInBeat(null);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    studioAudio.stopPlayback();
    setIsRecording(false);
    setIsPlaying(false);
    setTracks((prev) => prev.map((t) => ({ ...t, liveLevel: 0 })));
  }, []);

  const beginCapture = useCallback(
    async (activeStream: MediaStream, tunedAudio: MediaStream, armedTrackId: string) => {
      const startSec = loop.enabled ? loop.startSec : currentTimeSec;
      recordingStartSecRef.current = startSec;

      // Combine pitch-corrected audio track + camera video track (if present)
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
      const chosenMime =
        mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

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

          setTracks((prev) =>
            prev.map((t) => {
              if (t.id !== armedTrackId) return t;
              if (t.videoUrl) URL.revokeObjectURL(t.videoUrl);
              return {
                ...t,
                audioBuffer: decoded,
                waveformPeaks: peaks,
                durationSec: decoded.duration,
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

      // Start playback of existing unmuted tracks (looping if enabled!) for harmony alignment
      const backingTracks = tracks.filter((t) => t.id !== armedTrackId && t.audioBuffer !== null);
      if (backingTracks.length > 0) {
        await studioAudio.startPlayback(backingTracks, startSec, loop);
      } else {
        await studioAudio.ensureContext();
      }

      recorder.start(150);
      setIsRecording(true);
    },
    [loop, currentTimeSec, project.latencyOffsetMs, pitchSettings.enabled, tracks]
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

    // 4-beat Count-In before capture starts
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
      studioAudio.stopPlayback();
      setIsPlaying(false);
    }

    setIsLoadingDemo(true);
    try {
      const bpm = 100;
      const parts = await studioAudio.generateDemoQuartetBuffers(bpm);
      const demoTracks: Track[] = parts.map((part, idx) => ({
        id: `demo-track-${idx}`,
        name: part.name,
        singerName: part.singerName,
        role: part.role,
        color: part.color,
        muted: false,
        solo: false,
        armed: false,
        volume: idx === 0 ? 1.05 : 0.85,
        pan: part.pan,
        reverbSend: part.reverbSend,
        eqLow: idx === 3 ? 3 : -1,
        eqMid: idx === 0 ? 2 : 0,
        eqHigh: idx === 0 ? 2 : 1,
        pitchCorrectTake: true,
        offsetSec: 0,
        durationSec: part.buffer.duration,
        audioBuffer: part.buffer,
        waveformPeaks: extractWaveformPeaks(part.buffer, 180),
        videoUrl: null,
        videoBlob: null,
        isDemoSynthetic: true,
        demoHue: part.hue,
        demoNotes: part.notes,
        liveLevel: 0,
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
  }, [isRecording, isPlaying]);

  // Track Actions
  const handleArmTrack = (id: string) => {
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        armed: t.id === id ? !t.armed : false,
      }))
    );
    setSelectedTrackId(id);
  };

  const handleToggleMute = (id: string) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)));
  };

  const handleToggleSolo = (id: string) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, solo: !t.solo } : t)));
  };

  const handleClearTrackTake = (id: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (t.videoUrl) URL.revokeObjectURL(t.videoUrl);
        return {
          ...t,
          audioBuffer: null,
          waveformPeaks: [],
          durationSec: 0,
          videoUrl: null,
          videoBlob: null,
          isDemoSynthetic: false,
          liveLevel: 0,
        };
      })
    );
  };

  const handleAddTrack = () => {
    if (tracks.length >= 8) return;
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
  };

  const handleDeleteTrack = (id: string) => {
    if (tracks.length <= 1) return;
    setTracks((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target?.videoUrl) URL.revokeObjectURL(target.videoUrl);
      const next = prev.filter((t) => t.id !== id);
      if (selectedTrackId === id && next[0]) {
        setSelectedTrackId(next[0].id);
      }
      return next;
    });
  };

  const handleUpdateTrack = (id: string, patch: Partial<Track>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'KeyL') {
        setLoop((prev) => ({ ...prev, enabled: !prev.enabled }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlay]);

  const handleTopNavigate = (section: 'studio' | 'pitch' | 'export' | 'share') => {
    setActiveNav(section);
    if (section === 'export') {
      setShowExportModal(true);
    } else if (section === 'share') {
      setShowShareModal(true);
    } else if (section === 'pitch') {
      pitchLabSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0E14] text-slate-100">
      <TopBar
        activeSection={activeNav}
        onNavigate={handleTopNavigate}
        project={project}
        onUpdateProject={(patch) => setProject((prev) => ({ ...prev, ...patch }))}
        musicalKey={pitchSettings.key}
        scale={pitchSettings.scale}
        onChangeKey={(key) => setPitchSettings((prev) => ({ ...prev, key }))}
        onChangeScale={(scale) => setPitchSettings((prev) => ({ ...prev, scale }))}
        isPlaying={isPlaying}
        isRecording={isRecording}
        countInBeat={countInBeat}
        currentTimeSec={currentTimeSec}
        loop={loop}
        onTogglePlay={handleTogglePlay}
        onRewind={handleRewind}
        onToggleRecord={handleToggleRecord}
        onToggleLoop={() => setLoop((prev) => ({ ...prev, enabled: !prev.enabled }))}
        onLoadDemo={handleLoadDemo}
        hasAnyTracks={hasAnyTracks}
        isLoadingDemo={isLoadingDemo}
      />

      {/* Main Studio Workspace: Collage Stage + Pitch Lab & Mixer */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        <CollageStage
          tracks={tracks}
          selectedTrackId={selectedTrackId}
          onSelectTrack={setSelectedTrackId}
          onArmTrack={handleArmTrack}
          onToggleMute={handleToggleMute}
          onToggleSolo={handleToggleSolo}
          onClearTrackTake={handleClearTrackTake}
          layout={layout}
          onChangeLayout={setLayout}
          aspectRatio={aspectRatio}
          onChangeAspectRatio={setAspectRatio}
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

        <div ref={pitchLabSectionRef} className="flex">
          <PitchLabPanel
            pitchSettings={pitchSettings}
            onUpdatePitchSettings={(patch) =>
              setPitchSettings((prev) => ({ ...prev, ...patch }))
            }
            livePitch={livePitch}
            micLevel={micLevel}
            selectedTrack={selectedTrack}
            onUpdateTrack={handleUpdateTrack}
            latencyOffsetMs={project.latencyOffsetMs}
            onUpdateLatencyOffset={(latencyOffsetMs) =>
              setProject((prev) => ({ ...prev, latencyOffsetMs }))
            }
          />
        </div>
      </main>

      {/* Multi-Track Layering & Loop Alignment Timeline */}
      <TimelinePanel
        tracks={tracks}
        selectedTrackId={selectedTrackId}
        onSelectTrack={setSelectedTrackId}
        onArmTrack={handleArmTrack}
        onToggleMute={handleToggleMute}
        onToggleSolo={handleToggleSolo}
        onAddTrack={handleAddTrack}
        onDeleteTrack={handleDeleteTrack}
        onUpdateTrackOffset={(id, offsetSec) => handleUpdateTrack(id, { offsetSec })}
        currentTimeSec={currentTimeSec}
        totalDurationSec={totalDurationSec}
        bpm={project.bpm}
        loop={loop}
        onUpdateLoop={(patch) => setLoop((prev) => ({ ...prev, ...patch }))}
        onSeek={handleSeek}
      />

      {/* Modals */}
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
