import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Share2,
  X,
} from 'lucide-react';
import { generatePerformanceCoverCard } from '../video/collageRenderer';
import type { CollageLayout, ExportResult, MusicalKey, Track } from '../types/studio';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  layout: CollageLayout;
  projectTitle: string;
  bpm: number;
  musicalKey: MusicalKey;
  lastExport: ExportResult | null;
  videoElementsRef: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  onOpenExport: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  tracks,
  layout,
  projectTitle,
  bpm,
  musicalKey,
  lastExport,
  videoElementsRef,
  onOpenExport,
}) => {
  const [coverCardUrl, setCoverCardUrl] = useState<string | null>(null);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const creditsList = tracks
    .filter((t) => t.audioBuffer || t.videoUrl)
    .map((t) => `${t.singerName} (${t.name})`)
    .join(' · ');

  const [caption, setCaption] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setCaption(
      `"${projectTitle}" — ${tracks.length}-part acapella vocal collage (${bpm} BPM · Key of ${musicalKey}).\nFeaturing: ${creditsList || 'Live Ensemble'}\n#acapella #vocalharmony #voxsplit #singers`
    );

    generatePerformanceCoverCard(
      tracks,
      videoElementsRef.current,
      layout,
      projectTitle,
      bpm,
      musicalKey
    )
      .then((url) => setCoverCardUrl(url))
      .catch(() => setCoverCardUrl(null));
  }, [isOpen, tracks, layout, projectTitle, bpm, musicalKey, creditsList, videoElementsRef]);

  if (!isOpen) return null;

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    } catch {
      setShareFeedback('Select and copy the caption text above.');
    }
  };

  const handleNativeShare = async () => {
    setShareFeedback(null);
    if (!navigator.share) {
      setShareFeedback('Direct OS share sheet is unavailable in this browser; use the platform buttons or download your clip below.');
      return;
    }

    try {
      if (lastExport) {
        const file = new File([lastExport.blob], lastExport.filename, {
          type: lastExport.blob.type,
        });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: projectTitle,
            text: caption,
            files: [file],
          });
          setShareFeedback('Shared media file successfully.');
          return;
        }
      }

      await navigator.share({
        title: projectTitle,
        text: caption,
        url: window.location.href,
      });
      setShareFeedback('Shared performance link.');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setShareFeedback('Could not open native share sheet; download your HD mix or cover card instead.');
      }
    }
  };

  const encodedText = encodeURIComponent(caption);
  const encodedUrl = encodeURIComponent(window.location.href);

  const platforms = [
    {
      name: 'TikTok',
      hint: '9:16 Reels Upload',
      href: 'https://www.tiktok.com/upload',
      color: 'bg-[#171D2B] hover:bg-[#1E2638] border-white/12',
    },
    {
      name: 'Instagram',
      hint: 'Reels & Stories',
      href: 'https://www.instagram.com/',
      color: 'bg-[#171D2B] hover:bg-[#1E2638] border-white/12',
    },
    {
      name: 'YouTube',
      hint: 'Shorts / HD Video',
      href: 'https://studio.youtube.com/',
      color: 'bg-[#171D2B] hover:bg-[#1E2638] border-white/12',
    },
    {
      name: 'X / Twitter',
      hint: 'Post Performance',
      href: `https://twitter.com/intent/tweet?text=${encodedText}`,
      color: 'bg-[#171D2B] hover:bg-[#1E2638] border-white/12',
    },
    {
      name: 'WhatsApp',
      hint: 'Send to Group',
      href: `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`,
      color: 'bg-[#171D2B] hover:bg-[#1E2638] border-white/12',
    },
    {
      name: 'Facebook',
      hint: 'Share Feed',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      color: 'bg-[#171D2B] hover:bg-[#1E2638] border-white/12',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-[#111622] border border-white/12 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div>
            <h2 className="text-base font-bold text-white font-display">
              Share Acapella Performance
            </h2>
            <p className="text-xs text-slate-400">
              Publish your video collage, cover card, and tagged part credits
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

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Performance Cover Card Preview + Media Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="rounded-xl overflow-hidden border border-white/10 bg-[#090C12] aspect-video flex items-center justify-center">
              {coverCardUrl ? (
                <img
                  src={coverCardUrl}
                  alt="Performance cover card"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  <span>Generating cover card...</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-white">
                  {lastExport ? `Export Ready: ${lastExport.filename}` : 'No video rendered yet'}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lastExport
                    ? 'Your HD mix is ready to attach directly via Native Share or platform upload.'
                    : 'Render an HD Video or WAV mix first to attach the full audio/video file.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Quick Share</span>
                </button>

                {!lastExport ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenExport();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#1B2230] hover:bg-[#252E42] text-slate-200 border border-white/10 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Render HD Clip</span>
                  </button>
                ) : (
                  <a
                    href={lastExport.url}
                    download={lastExport.filename}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#1B2230] hover:bg-[#252E42] text-slate-200 border border-white/10"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save Video</span>
                  </a>
                )}

                {coverCardUrl && (
                  <a
                    href={coverCardUrl}
                    download={`${projectTitle.toLowerCase().replace(/\s+/g, '-')}-card.png`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#161C28] hover:bg-[#1E2638] text-slate-300 border border-white/10"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Save PNG Card</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {shareFeedback && (
            <div className="p-3 rounded-lg bg-sky-500/12 border border-sky-500/30 text-xs text-sky-200">
              {shareFeedback}
            </div>
          )}

          {/* Post Caption & Auto-Credits */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Performance Caption &amp; Vocal Credits
              </label>
              <button
                type="button"
                onClick={handleCopyCaption}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 cursor-pointer"
              >
                {copiedCaption ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCaption ? 'Copied' : 'Copy Caption'}</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-sky-400 resize-none"
            />
          </div>

          {/* Platform Publish Shortcuts */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">Post to Platform</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {platforms.map((p) => (
                <a
                  key={p.name}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    navigator.clipboard?.writeText(caption).catch(() => {});
                  }}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${p.color}`}
                >
                  <div>
                    <div className="text-xs font-semibold text-white">{p.name}</div>
                    <div className="text-[11px] text-slate-400">{p.hint}</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
