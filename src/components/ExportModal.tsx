import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Film, Music, Share2, X } from 'lucide-react';
import { studioAudio } from '../audio/studioEngine';
import {
  getBestVideoMimeType,
  getExportDimensions,
  renderCollageFrame,
} from '../video/collageRenderer';
import type {
  AspectRatio,
  CollageLayout,
  ExportFormat,
  ExportResolution,
  ExportResult,
  Track,
} from '../types/studio';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  layout: CollageLayout;
  defaultAspectRatio: AspectRatio;
  projectTitle: string;
  bpm: number;
  totalDurationSec: number;
  videoElementsRef: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  lastExport: ExportResult | null;
  onExportComplete: (result: ExportResult) => void;
  onOpenShare: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  tracks,
  layout,
  defaultAspectRatio,
  projectTitle,
  bpm,
  totalDurationSec,
  videoElementsRef,
  lastExport,
  onExportComplete,
  onOpenShare,
}) => {
  const [format, setFormat] = useState<ExportFormat>('video-webm');
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(defaultAspectRatio);
  const [fps, setFps] = useState<30 | 60>(30);
  const [isRendering, setIsRendering] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    setAspectRatio(defaultAspectRatio);
  }, [defaultAspectRatio]);

  if (!isOpen) return null;

  const playableTracks = tracks.filter((t) => t.audioBuffer !== null);
  const renderDuration = Math.max(4, totalDurationSec);

  const handleStartExport = async () => {
    if (playableTracks.length === 0) {
      setErrorMsg('Record at least one vocal track or load the Demo Quartet before exporting.');
      return;
    }

    setErrorMsg(null);
    setIsRendering(true);
    setProgressPct(0);
    cancelRef.current = false;

    const safeSlug =
      projectTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'voxsplit-mix';

    try {
      if (format === 'audio-wav') {
        setProgressPct(25);
        const wavBlob = await studioAudio.exportMixToWav(tracks, renderDuration);
        setProgressPct(100);
        const url = URL.createObjectURL(wavBlob);
        onExportComplete({
          blob: wavBlob,
          url,
          filename: `${safeSlug}-48khz.wav`,
          format,
          durationSec: renderDuration,
          sizeBytes: wavBlob.size,
        });
        setIsRendering(false);
        return;
      }

      // HD Video Collage Rendering (Canvas + Web Audio MediaStream -> MediaRecorder)
      await studioAudio.ensureContext();
      const { width, height } = getExportDimensions(aspectRatio, resolution);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      const preferredCodec = format === 'video-mp4' ? 'mp4' : 'webm';
      const mimeType = getBestVideoMimeType(preferredCodec);
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';

      const videoStream = canvas.captureStream(fps);
      const audioStream = studioAudio.getExportAudioStream();
      const combinedTracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];
      if (audioStream) {
        audioStream.getAudioTracks().forEach((t) => combinedTracks.push(t));
      }
      const combinedStream = new MediaStream(combinedTracks);

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: resolution === '1080p' ? 8_000_000 : 4_500_000,
        audioBitsPerSecond: 192_000,
      });

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunks.push(ev.data);
        }
      };

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }));
        };
      });

      // Reset any track videos to 0 and start playback
      videoElementsRef.current.forEach((vid) => {
        try {
          vid.currentTime = 0;
          vid.play().catch(() => {});
        } catch {
          // ignore
        }
      });

      recorder.start(200);
      await studioAudio.startPlayback(tracks, 0, {
        enabled: false,
        startSec: 0,
        endSec: renderDuration,
      });

      const startPerf = performance.now();

      await new Promise<void>((resolve) => {
        const step = () => {
          if (cancelRef.current) {
            resolve();
            return;
          }
          const elapsedSec = (performance.now() - startPerf) / 1000;
          const levels = studioAudio.getTrackLevels();
          renderCollageFrame(
            ctx,
            width,
            height,
            tracks,
            videoElementsRef.current,
            layout,
            elapsedSec,
            bpm,
            projectTitle,
            levels
          );

          const pct = Math.min(99, Math.round((elapsedSec / renderDuration) * 100));
          setProgressPct(pct);

          if (elapsedSec >= renderDuration) {
            resolve();
          } else {
            requestAnimationFrame(step);
          }
        };
        requestAnimationFrame(step);
      });

      studioAudio.stopPlayback();
      videoElementsRef.current.forEach((vid) => {
        if (!vid.paused) vid.pause();
      });

      if (recorder.state !== 'inactive') {
        recorder.stop();
      }

      const finalBlob = await recordingDone;
      if (!cancelRef.current) {
        setProgressPct(100);
        const url = URL.createObjectURL(finalBlob);
        onExportComplete({
          blob: finalBlob,
          url,
          filename: `${safeSlug}-${resolution}.${ext}`,
          format,
          durationSec: renderDuration,
          sizeBytes: finalBlob.size,
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsRendering(false);
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
    studioAudio.stopPlayback();
    setIsRendering(false);
    onClose();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-[#111622] border border-white/12 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div>
            <h2 className="text-base font-bold text-white font-display">
              Export HD Video &amp; Master Audio
            </h2>
            <p className="text-xs text-slate-400">
              Render synchronized collage mix · {renderDuration.toFixed(1)}s duration
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Format Selection */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              disabled={isRendering}
              onClick={() => setFormat('video-webm')}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                format === 'video-webm'
                  ? 'bg-rose-600/15 border-rose-500 text-white'
                  : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              <Film className="w-4 h-4 text-rose-400 mb-1.5" />
              <div className="text-xs font-semibold">HD Video (WebM)</div>
              <div className="text-[11px] text-slate-400">VP9 + Opus Stereo</div>
            </button>

            <button
              type="button"
              disabled={isRendering}
              onClick={() => setFormat('video-mp4')}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                format === 'video-mp4'
                  ? 'bg-rose-600/15 border-rose-500 text-white'
                  : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              <Film className="w-4 h-4 text-sky-400 mb-1.5" />
              <div className="text-xs font-semibold">HD Video (MP4)</div>
              <div className="text-[11px] text-slate-400">Social Ready Container</div>
            </button>

            <button
              type="button"
              disabled={isRendering}
              onClick={() => setFormat('audio-wav')}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                format === 'audio-wav'
                  ? 'bg-rose-600/15 border-rose-500 text-white'
                  : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              <Music className="w-4 h-4 text-emerald-400 mb-1.5" />
              <div className="text-xs font-semibold">Studio Audio (WAV)</div>
              <div className="text-[11px] text-slate-400">48 kHz Lossless PCM</div>
            </button>
          </div>

          {/* Video Options */}
          {format !== 'audio-wav' && (
            <div className="grid grid-cols-3 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-slate-400">Resolution</span>
                <select
                  disabled={isRendering}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as ExportResolution)}
                  className="w-full bg-[#0B0E14] text-slate-100 border border-white/10 rounded-lg px-2.5 py-2 text-xs outline-none"
                >
                  <option value="1080p">1080p Full HD</option>
                  <option value="720p">720p HD</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-slate-400">Aspect Ratio</span>
                <select
                  disabled={isRendering}
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                  className="w-full bg-[#0B0E14] text-slate-100 border border-white/10 rounded-lg px-2.5 py-2 text-xs outline-none"
                >
                  <option value="16:9">16:9 YouTube</option>
                  <option value="9:16">9:16 Reels / TikTok</option>
                  <option value="1:1">1:1 Square</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-slate-400">Frame Rate</span>
                <select
                  disabled={isRendering}
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value) as 30 | 60)}
                  className="w-full bg-[#0B0E14] text-slate-100 border border-white/10 rounded-lg px-2.5 py-2 text-xs outline-none"
                >
                  <option value={30}>30 fps</option>
                  <option value={60}>60 fps</option>
                </select>
              </label>
            </div>
          )}

          {/* Render Progress */}
          {isRendering && (
            <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-200 font-medium">
                  {format === 'audio-wav'
                    ? 'Mixing stems offline...'
                    : 'Encoding synchronized HD video collage...'}
                </span>
                <span className="font-mono text-sky-400 tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-2 bg-[#1A2130] rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Completed Export Preview & Download */}
          {lastExport && !isRendering && (
            <div className="p-4 rounded-xl bg-[#0B0E14] border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ready: {lastExport.filename}</span>
                </div>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  {formatBytes(lastExport.sizeBytes)}
                </span>
              </div>

              {lastExport.format === 'audio-wav' ? (
                <audio controls src={lastExport.url} className="w-full h-9" />
              ) : (
                <video
                  controls
                  src={lastExport.url}
                  className="w-full max-h-48 rounded-lg bg-black object-contain"
                />
              )}

              <div className="flex items-center gap-2.5 pt-1">
                <a
                  href={lastExport.url}
                  download={lastExport.filename}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenShare();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#1B2230] hover:bg-[#252E42] text-white border border-white/10 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-sky-400" />
                  <span>Share to Socials</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-[#0D1119] border-t border-white/8 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
          >
            {isRendering ? 'Cancel' : 'Close'}
          </button>
          <button
            type="button"
            disabled={isRendering}
            onClick={handleStartExport}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isRendering ? 'Rendering...' : 'Render & Export'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
