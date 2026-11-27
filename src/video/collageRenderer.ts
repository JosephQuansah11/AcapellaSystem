import type { AspectRatio, CollageLayout, ExportResolution, Track } from '../types/studio';

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function getExportDimensions(
  aspectRatio: AspectRatio,
  resolution: ExportResolution
): { width: number; height: number } {
  const is1080 = resolution === '1080p';
  switch (aspectRatio) {
    case '16:9':
      return is1080 ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
    case '9:16':
      return is1080 ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
    case '1:1':
      return is1080 ? { width: 1080, height: 1080 } : { width: 720, height: 720 };
  }
}

export function computeCollageRects(
  count: number,
  width: number,
  height: number,
  layout: CollageLayout,
  gap = 12,
  pad = 16
): TileRect[] {
  const safeCount = Math.max(1, count);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  if (safeCount === 1) {
    return [{ x: pad, y: pad, w: innerW, h: innerH }];
  }

  if (layout === 'duet' || safeCount === 2) {
    const isPortrait = height > width;
    if (isPortrait) {
      const h = (innerH - gap) / 2;
      return [
        { x: pad, y: pad, w: innerW, h },
        { x: pad, y: pad + h + gap, w: innerW, h },
      ];
    }
    const w = (innerW - gap) / 2;
    return [
      { x: pad, y: pad, w, h: innerH },
      { x: pad + w + gap, y: pad, w, h: innerH },
    ];
  }

  if (layout === 'spotlight') {
    const isPortrait = height > width;
    const secondaryCount = safeCount - 1;
    if (isPortrait) {
      const mainH = innerH * 0.62 - gap / 2;
      const subH = innerH - mainH - gap;
      const subW = (innerW - gap * (secondaryCount - 1)) / secondaryCount;
      const rects: TileRect[] = [{ x: pad, y: pad, w: innerW, h: mainH }];
      for (let i = 0; i < secondaryCount; i++) {
        rects.push({
          x: pad + i * (subW + gap),
          y: pad + mainH + gap,
          w: subW,
          h: subH,
        });
      }
      return rects;
    } else {
      const mainW = innerW * 0.65 - gap / 2;
      const subW = innerW - mainW - gap;
      const subH = (innerH - gap * (secondaryCount - 1)) / secondaryCount;
      const rects: TileRect[] = [{ x: pad, y: pad, w: mainW, h: innerH }];
      for (let i = 0; i < secondaryCount; i++) {
        rects.push({
          x: pad + mainW + gap,
          y: pad + i * (subH + gap),
          w: subW,
          h: subH,
        });
      }
      return rects;
    }
  }

  if (layout === 'columns') {
    const w = (innerW - gap * (safeCount - 1)) / safeCount;
    return Array.from({ length: safeCount }, (_, i) => ({
      x: pad + i * (w + gap),
      y: pad,
      w,
      h: innerH,
    }));
  }

  if (layout === 'cinema-strip') {
    const h = (innerH - gap * (safeCount - 1)) / safeCount;
    return Array.from({ length: safeCount }, (_, i) => ({
      x: pad,
      y: pad + i * (h + gap),
      w: innerW,
      h,
    }));
  }

  // Default: grid-2x2 (scales up to 3x2 or 4x2 cleanly)
  const cols = safeCount <= 4 ? 2 : safeCount <= 6 ? 3 : 4;
  const rows = Math.ceil(safeCount / cols);
  const cellW = (innerW - gap * (cols - 1)) / cols;
  const cellH = (innerH - gap * (rows - 1)) / rows;

  const rects: TileRect[] = [];
  for (let i = 0; i < safeCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    rects.push({
      x: pad + col * (cellW + gap),
      y: pad + row * (cellH + gap),
      w: cellW,
      h: cellH,
    });
  }
  return rects;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  w: number,
  h: number,
  mirror = false
) {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const targetRatio = w / h;
  const srcRatio = vw / vh;

  let sx = 0;
  let sy = 0;
  let sw = vw;
  let sh = vh;

  if (srcRatio > targetRatio) {
    sw = vh * targetRatio;
    sx = (vw - sw) / 2;
  } else {
    sh = vw / targetRatio;
    sy = (vh - sh) / 2;
  }

  ctx.save();
  if (mirror) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  } else {
    ctx.drawImage(video, sx, sy, sw, sh, x, y, w, h);
  }
  ctx.restore();
}

export function renderCollageFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tracks: Track[],
  videoMap: Map<string, HTMLVideoElement>,
  layout: CollageLayout,
  currentTimeSec: number,
  bpm: number,
  projectTitle: string,
  levels: Record<string, number>
): void {
  // Studio backdrop
  ctx.fillStyle = '#090C12';
  ctx.fillRect(0, 0, width, height);

  const visibleTracks = tracks.filter((t) => !t.muted);
  const drawList = visibleTracks.length > 0 ? visibleTracks : tracks;
  const rects = computeCollageRects(drawList.length, width, height, layout, 14, 24);

  const beat = (currentTimeSec * bpm) / 60;

  drawList.forEach((track, idx) => {
    const rect = rects[idx];
    if (!rect) return;

    const level = levels[track.id] ?? track.liveLevel ?? 0;

    ctx.save();
    drawRoundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.clip();

    const vid = videoMap.get(track.id);
    if (vid && vid.readyState >= 2 && vid.videoWidth > 0) {
      drawVideoCover(ctx, vid, rect.x, rect.y, rect.w, rect.h, false);
    } else {
      // Studio performer stage graphic for synthesized/audio-only vocal layers
      const hue = track.demoHue ?? (idx * 75 + 200) % 360;
      const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      grad.addColorStop(0, `hsl(${hue}, 28%, 14%)`);
      grad.addColorStop(1, `hsl(${hue}, 34%, 8%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

      // Subtle concentric vocal resonance rings
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h * 0.45;
      const baseR = Math.min(rect.w, rect.h) * 0.16;

      for (let r = 3; r >= 1; r--) {
        ctx.beginPath();
        ctx.arc(cx, cy, baseR * (1 + r * 0.35 + level * 0.55), 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue}, 70%, 62%, ${0.08 + level * 0.18})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Stylized singer emblem circle
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 55%, 45%, 0.22)`;
      ctx.fill();
      ctx.strokeStyle = track.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Active syllable or initial
      const activeNote = track.demoNotes?.find(
        (n) => beat >= n.startBeat && beat < n.startBeat + n.durationBeats
      );
      ctx.fillStyle = '#F8FAFC';
      ctx.font = `600 ${Math.round(baseR * 0.65)}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        activeNote ? activeNote.syllable : track.singerName.slice(0, 2).toUpperCase(),
        cx,
        cy
      );

      // Mini waveform bars at bottom center of tile
      const barCount = 18;
      const barWidth = Math.min(6, (rect.w * 0.4) / barCount);
      const barGap = 4;
      const totalBarW = barCount * (barWidth + barGap) - barGap;
      const startBX = cx - totalBarW / 2;
      const baseBY = rect.y + rect.h * 0.76;
      for (let b = 0; b < barCount; b++) {
        const wave = Math.abs(Math.sin(currentTimeSec * 7 + b * 0.6 + idx));
        const bh = 6 + wave * level * (rect.h * 0.14);
        ctx.fillStyle = track.color;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(startBX + b * (barWidth + barGap), baseBY - bh / 2, barWidth, bh);
      }
      ctx.globalAlpha = 1;
    }

    // Bottom contrast scrim for legible singer caption
    const scrim = ctx.createLinearGradient(0, rect.y + rect.h * 0.68, 0, rect.y + rect.h);
    scrim.addColorStop(0, 'rgba(0,0,0,0)');
    scrim.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = scrim;
    ctx.fillRect(rect.x, rect.y + rect.h * 0.68, rect.w, rect.h * 0.32);

    // Singer label
    const fontSize = Math.max(15, Math.round(Math.min(width, height) * 0.02));
    ctx.fillStyle = '#F8FAFC';
    ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(track.singerName, rect.x + 18, rect.y + rect.h - 24);

    ctx.fillStyle = '#94A3B8';
    ctx.font = `500 ${Math.round(fontSize * 0.78)}px "DM Sans", sans-serif`;
    ctx.fillText(track.name, rect.x + 18, rect.y + rect.h - 8);

    ctx.restore();

    // Tile border (highlights softly when singing)
    ctx.save();
    drawRoundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.strokeStyle = level > 0.12 ? track.color : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = level > 0.12 ? 3 : 1.5;
    ctx.stroke();
    ctx.restore();
  });

  // Subtle top-right watermark / title stamp in exported frame
  ctx.save();
  ctx.fillStyle = 'rgba(248, 250, 252, 0.55)';
  ctx.font = `500 ${Math.max(13, Math.round(height * 0.015))}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`${projectTitle} · VoxSplit`, width - 28, 8);
  ctx.restore();
}

export function getBestVideoMimeType(preferred: 'webm' | 'mp4'): string {
  const candidates =
    preferred === 'mp4'
      ? [
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ]
      : [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
          'video/mp4',
        ];

  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return 'video/webm';
}

export async function generatePerformanceCoverCard(
  tracks: Track[],
  videoMap: Map<string, HTMLVideoElement>,
  layout: CollageLayout,
  projectTitle: string,
  bpm: number,
  musicalKey: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 675;
  const ctx = canvas.getContext('2d')!;

  const dummyLevels: Record<string, number> = {};
  tracks.forEach((t) => {
    dummyLevels[t.id] = 0.45;
  });

  renderCollageFrame(ctx, 1200, 675, tracks, videoMap, layout, 1.2, bpm, projectTitle, dummyLevels);

  // Editorial bottom banner overlay
  ctx.fillStyle = 'rgba(11, 14, 20, 0.86)';
  ctx.fillRect(0, 585, 1200, 90);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(0, 585);
  ctx.lineTo(1200, 585);
  ctx.stroke();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(projectTitle, 36, 622);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 16px "DM Sans", sans-serif';
  const credits = tracks.map((t) => t.singerName).join(' · ');
  ctx.fillText(`${credits}  ·  ${bpm} BPM  ·  Key of ${musicalKey}`, 36, 652);

  ctx.fillStyle = '#E11D48';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Recorded on VoxSplit', 1164, 632);

  return canvas.toDataURL('image/png');
}
