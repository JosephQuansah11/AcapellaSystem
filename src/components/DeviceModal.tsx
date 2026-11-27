import React, { useEffect, useState } from 'react';
import { Camera, Mic, Radio, RefreshCw, X } from 'lucide-react';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAudioId: string;
  selectedVideoId: string;
  onConnectDevices: (audioId: string, videoId: string, includeVideo: boolean) => Promise<unknown>;
  onUseVirtualInput: () => Promise<void>;
  errorMsg: string | null;
}

export const DeviceModal: React.FC<DeviceModalProps> = ({
  isOpen,
  onClose,
  selectedAudioId,
  selectedVideoId,
  onConnectDevices,
  onUseVirtualInput,
  errorMsg,
}) => {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioId, setAudioId] = useState(selectedAudioId);
  const [videoId, setVideoId] = useState(selectedVideoId);
  const [includeVideo, setIncludeVideo] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const loadDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter((d) => d.kind === 'audioinput');
    const cams = devices.filter((d) => d.kind === 'videoinput');
    setAudioInputs(mics);
    setVideoInputs(cams);
    if (!audioId && mics[0]) setAudioId(mics[0].deviceId);
    if (!videoId && cams[0]) setVideoId(cams[0].deviceId);
  };

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await onConnectDevices(audioId, videoId, includeVideo);
      onClose();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleVirtual = async () => {
    setIsConnecting(true);
    try {
      await onUseVirtualInput();
      onClose();
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#111622] border border-white/12 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div>
            <h2 className="text-base font-bold text-white font-display">
              Studio Microphone &amp; Camera
            </h2>
            <p className="text-xs text-slate-400">
              Use headphones to prevent backing track bleed while singing
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Mic className="w-3.5 h-3.5 text-sky-400" />
              <span>Microphone Input</span>
            </span>
            <select
              value={audioId}
              onChange={(e) => setAudioId(e.target.value)}
              className="w-full bg-[#0B0E14] text-slate-100 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none"
            >
              {audioInputs.length === 0 ? (
                <option value="">Default System Microphone</option>
              ) : (
                audioInputs.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Microphone ${i + 1}`}
                  </option>
                ))
              )}
            </select>
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                <Camera className="w-3.5 h-3.5 text-rose-400" />
                <span>Camera Video Feed</span>
              </span>
              <button
                type="button"
                onClick={() => setIncludeVideo(!includeVideo)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer ${
                  includeVideo
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                    : 'bg-[#0B0E14] text-slate-400 border-white/10'
                }`}
              >
                {includeVideo ? 'Video On' : 'Audio Only'}
              </button>
            </div>

            {includeVideo && (
              <select
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                className="w-full bg-[#0B0E14] text-slate-100 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none"
              >
                {videoInputs.length === 0 ? (
                  <option value="">Default Camera</option>
                ) : (
                  videoInputs.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={loadDevices}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Devices</span>
            </button>

            <button
              type="button"
              onClick={handleVirtual}
              disabled={isConnecting}
              className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Use Virtual Vocal Synth</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-[#0D1119] border-t border-white/8 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isConnecting}
            onClick={handleConnect}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            {isConnecting ? 'Connecting...' : 'Connect Studio Input'}
          </button>
        </div>
      </div>
    </div>
  );
};
