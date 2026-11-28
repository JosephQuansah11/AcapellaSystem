import { detectPitchYIN, midiToFrequency } from './pitchUtils';
import { createPitchWorkletUrl } from './pitchWorklet';
import type { LivePitchReading, LoopRegion, PitchSettings, Track } from '../types/studio';

function createStudioImpulseResponse(ctx: BaseAudioContext, seconds = 1.6, decay = 2.6): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, decay);
      data[i] = (Math.random() * 2 - 1) * env * 0.45;
    }
  }
  return impulse;
}

export function extractWaveformPeaks(buffer: AudioBuffer, numPeaks = 180): number[] {
  const ch0 = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(ch0.length / numPeaks));
  const peaks: number[] = [];
  for (let i = 0; i < numPeaks; i++) {
    const start = i * step;
    const end = Math.min(ch0.length, start + step);
    let maxVal = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(ch0[j]);
      if (abs > maxVal) maxVal = abs;
    }
    peaks.push(Math.min(1, maxVal));
  }
  return peaks;
}

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

interface ActiveTrackNodes {
  source: AudioBufferSourceNode;
  clipGain: GainNode;
  comp: DynamicsCompressorNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  chorusDelay: DelayNode;
  chorusLfo: OscillatorNode;
  chorusLfoGain: GainNode;
  chorusWet: GainNode;
  delayNode: DelayNode;
  delayFeedback: GainNode;
  delayWet: GainNode;
  gain: GainNode;
  pan: StereoPannerNode;
  reverbGain: GainNode;
  analyser: AnalyserNode;
  analyserData: Float32Array<ArrayBuffer>;
}

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private exportDest: MediaStreamAudioDestinationNode | null = null;
  private workletLoaded = false;

  // Live microphone & pitch correction graph
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micAnalyserBuf: Float32Array<ArrayBuffer> | null = null;
  private pitchWorklet: AudioWorkletNode | null = null;
  private micMonitorGain: GainNode | null = null;
  private micRecordDest: MediaStreamAudioDestinationNode | null = null;
  private micPassGain: GainNode | null = null;

  // Playback state
  private activeNodes: Map<string, ActiveTrackNodes> = new Map();
  private isPlaying = false;
  private playStartCtxTime = 0;
  private playStartOffsetSec = 0;
  private currentLoop: LoopRegion = { enabled: false, startSec: 0, endSec: 8 };

  public async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: 48000, latencyHint: 'interactive' });

      this.masterLimiter = this.ctx.createDynamicsCompressor();
      this.masterLimiter.threshold.value = -3;
      this.masterLimiter.knee.value = 12;
      this.masterLimiter.ratio.value = 6;
      this.masterLimiter.attack.value = 0.003;
      this.masterLimiter.release.value = 0.15;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.92;

      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = createStudioImpulseResponse(this.ctx, 1.7, 2.8);

      this.exportDest = this.ctx.createMediaStreamDestination();

      this.reverbNode.connect(this.masterLimiter);
      this.masterLimiter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.connect(this.exportDest);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    if (!this.workletLoaded && this.ctx.audioWorklet) {
      try {
        const url = createPitchWorkletUrl();
        await this.ctx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        this.workletLoaded = true;
      } catch (err) {
        console.warn('AudioWorklet fallback active:', err);
      }
    }

    return this.ctx;
  }

  public getExportAudioStream(): MediaStream | null {
    return this.exportDest ? this.exportDest.stream : null;
  }

  public async attachLiveMicrophone(
    stream: MediaStream,
    pitchSettings: PitchSettings
  ): Promise<MediaStream> {
    const ctx = await this.ensureContext();
    this.detachLiveMicrophone();

    this.micSource = ctx.createMediaStreamSource(stream);
    this.micAnalyser = ctx.createAnalyser();
    this.micAnalyser.fftSize = 2048;
    this.micAnalyserBuf = new Float32Array(this.micAnalyser.fftSize) as Float32Array<ArrayBuffer>;

    this.micRecordDest = ctx.createMediaStreamDestination();
    this.micMonitorGain = ctx.createGain();
    this.micMonitorGain.gain.value = pitchSettings.monitorCorrected ? 0.75 : 0;

    this.micSource.connect(this.micAnalyser);

    if (this.workletLoaded) {
      this.pitchWorklet = new AudioWorkletNode(ctx, 'vox-pitch-corrector', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      const wetParam = this.pitchWorklet.parameters.get('wetMix');
      if (wetParam) {
        wetParam.value = pitchSettings.enabled ? 1.0 : 0.0;
      }
      this.micSource.connect(this.pitchWorklet);
      this.pitchWorklet.connect(this.micRecordDest);
      this.pitchWorklet.connect(this.micMonitorGain);
    } else {
      this.micPassGain = ctx.createGain();
      this.micSource.connect(this.micPassGain);
      this.micPassGain.connect(this.micRecordDest);
      this.micPassGain.connect(this.micMonitorGain);
    }

    if (this.masterGain) {
      this.micMonitorGain.connect(ctx.destination);
    }

    return this.micRecordDest.stream;
  }

  public detachLiveMicrophone(): void {
    this.micSource?.disconnect();
    this.micAnalyser?.disconnect();
    this.pitchWorklet?.disconnect();
    this.micPassGain?.disconnect();
    this.micMonitorGain?.disconnect();
    this.micSource = null;
    this.micAnalyser = null;
    this.micAnalyserBuf = null;
    this.pitchWorklet = null;
    this.micPassGain = null;
    this.micMonitorGain = null;
    this.micRecordDest = null;
  }

  public sampleLivePitch(pitchSettings: PitchSettings): {
    reading: LivePitchReading;
    inputLevel: number;
  } {
    if (!this.ctx || !this.micAnalyser || !this.micAnalyserBuf) {
      return {
        reading: {
          frequency: 0,
          targetFrequency: 0,
          noteName: '—',
          targetNoteName: '—',
          cents: 0,
          confidence: 0,
          shiftRatio: 1,
        },
        inputLevel: 0,
      };
    }

    this.micAnalyser.getFloatTimeDomainData(this.micAnalyserBuf);
    let peak = 0;
    for (let i = 0; i < this.micAnalyserBuf.length; i++) {
      const a = Math.abs(this.micAnalyserBuf[i]);
      if (a > peak) peak = a;
    }

    const reading = detectPitchYIN(
      this.micAnalyserBuf,
      this.ctx.sampleRate,
      pitchSettings.key,
      pitchSettings.scale,
      pitchSettings.retuneSpeed,
      pitchSettings.humanize
    );

    if (this.pitchWorklet) {
      const ratioParam = this.pitchWorklet.parameters.get('pitchRatio');
      const wetParam = this.pitchWorklet.parameters.get('wetMix');
      if (wetParam) {
        wetParam.setTargetAtTime(pitchSettings.enabled ? 1.0 : 0.0, this.ctx.currentTime, 0.015);
      }
      if (ratioParam) {
        const nextRatio =
          pitchSettings.enabled && reading.frequency > 0 ? reading.shiftRatio : 1.0;
        ratioParam.setTargetAtTime(nextRatio, this.ctx.currentTime, 0.02);
      }
    }

    if (this.micMonitorGain) {
      this.micMonitorGain.gain.setTargetAtTime(
        pitchSettings.monitorCorrected ? 0.75 : 0.0,
        this.ctx.currentTime,
        0.02
      );
    }

    return {
      reading,
      inputLevel: Math.min(1, peak * 1.8),
    };
  }

  public playMetronomeClick(accent = false): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accent ? 1320 : 880, now);
    gain.gain.setValueAtTime(accent ? 0.22 : 0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public async startPlayback(
    tracks: Track[],
    fromSec: number,
    loop: LoopRegion
  ): Promise<void> {
    const ctx = await this.ensureContext();
    this.stopPlayback();

    this.currentLoop = loop;
    this.isPlaying = true;
    this.playStartOffsetSec = Math.max(0, fromSec);
    this.playStartCtxTime = ctx.currentTime + 0.03;

    this.scheduleAllTracksAt(tracks, this.playStartOffsetSec, this.playStartCtxTime, loop);
  }

  private scheduleAllTracksAt(
    tracks: Track[],
    positionSec: number,
    whenCtxTime: number,
    loop: LoopRegion
  ): void {
    if (!this.ctx || !this.masterLimiter || !this.reverbNode) return;

    const anySolo = tracks.some((t) => t.solo);

    for (const track of tracks) {
      if (!track.audioBuffer) continue;

      const isAudible = anySolo ? track.solo : !track.muted;

      const source = this.ctx.createBufferSource();
      source.buffer = track.audioBuffer;
      const semitoneRatio = Math.pow(2, (track.semitoneShift + track.centsDetune / 100) / 12);
      source.playbackRate.value = semitoneRatio;

      const clipGain = this.ctx.createGain();
      const baseClipGain = dbToGain(track.clipGainDb);

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = track.fxEnabled ? track.compThreshold : 0;
      comp.ratio.value = track.fxEnabled ? Math.max(1, track.compRatio) : 1;
      comp.knee.value = 10;
      comp.attack.value = 0.005;
      comp.release.value = 0.12;

      const eqLow = this.ctx.createBiquadFilter();
      eqLow.type = 'lowshelf';
      eqLow.frequency.value = 160;
      eqLow.gain.value = track.fxEnabled ? track.eqLow : 0;

      const eqMid = this.ctx.createBiquadFilter();
      eqMid.type = 'peaking';
      eqMid.frequency.value = 1200;
      eqMid.Q.value = 1.1;
      eqMid.gain.value = track.fxEnabled ? track.eqMid : 0;

      const eqHigh = this.ctx.createBiquadFilter();
      eqHigh.type = 'highshelf';
      eqHigh.frequency.value = 4500;
      eqHigh.gain.value = track.fxEnabled ? track.eqHigh : 0;

      // Chorus stage
      const chorusDelay = this.ctx.createDelay(0.1);
      chorusDelay.delayTime.value = 0.018;
      const chorusLfo = this.ctx.createOscillator();
      chorusLfo.frequency.value = 1.6;
      const chorusLfoGain = this.ctx.createGain();
      chorusLfoGain.gain.value = track.fxEnabled ? track.chorusDepth * 0.004 : 0;
      const chorusWet = this.ctx.createGain();
      chorusWet.gain.value = track.fxEnabled ? track.chorusDepth * 0.45 : 0;
      chorusLfo.connect(chorusLfoGain);
      chorusLfoGain.connect(chorusDelay.delayTime);
      chorusLfo.start(whenCtxTime);

      // Slapback / Studio Delay stage
      const delayNode = this.ctx.createDelay(1.0);
      delayNode.delayTime.value = Math.max(0.04, Math.min(0.8, track.delayTimeMs / 1000));
      const delayFeedback = this.ctx.createGain();
      delayFeedback.gain.value = track.fxEnabled ? Math.min(0.7, track.delayFeedback) : 0;
      const delayWet = this.ctx.createGain();
      delayWet.gain.value = track.fxEnabled ? track.delayMix : 0;
      delayNode.connect(delayFeedback);
      delayFeedback.connect(delayNode);

      const gain = this.ctx.createGain();
      gain.gain.value = isAudible ? track.volume : 0;

      const pan = this.ctx.createStereoPanner();
      pan.pan.value = track.pan;

      const reverbGain = this.ctx.createGain();
      reverbGain.gain.value = isAudible && track.fxEnabled ? track.reverbSend * 0.65 : 0;

      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 256;
      const analyserData = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;

      // Signal Chain: source -> clipGain -> comp -> eqLow -> eqMid -> eqHigh -> [dry + chorus + delay] -> gain -> pan -> analyser -> masterLimiter
      source.connect(clipGain);
      clipGain.connect(comp);
      comp.connect(eqLow);
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);

      // Dry path
      eqHigh.connect(gain);
      // Chorus path
      eqHigh.connect(chorusDelay);
      chorusDelay.connect(chorusWet);
      chorusWet.connect(gain);
      // Delay path
      eqHigh.connect(delayNode);
      delayNode.connect(delayWet);
      delayWet.connect(gain);

      gain.connect(pan);
      pan.connect(analyser);
      analyser.connect(this.masterLimiter);

      gain.connect(reverbGain);
      reverbGain.connect(this.reverbNode);

      // Non-destructive trim bounds
      const trimStart = Math.max(0, Math.min(track.audioBuffer.duration - 0.1, track.trimStartSec));
      const trimEnd =
        track.trimEndSec > trimStart + 0.05
          ? Math.min(track.audioBuffer.duration, track.trimEndSec)
          : track.audioBuffer.duration;
      const playableSpan = Math.max(0.05, trimEnd - trimStart);

      const relOffset = positionSec - track.offsetSec;
      const startDelay = Math.max(0, track.offsetSec - positionSec);
      const bufferOffset = trimStart + Math.max(0, relOffset);

      // Apply fade-in & fade-out on non-looped clip start
      const startAt = whenCtxTime + startDelay;
      if (track.fadeInSec > 0 && relOffset <= 0.05) {
        clipGain.gain.setValueAtTime(0.001, startAt);
        clipGain.gain.linearRampToValueAtTime(
          baseClipGain,
          startAt + Math.min(track.fadeInSec, playableSpan * 0.5)
        );
      } else {
        clipGain.gain.setValueAtTime(baseClipGain, startAt);
      }

      if (loop.enabled && loop.endSec > loop.startSec + 0.1) {
        const clipStartInLoop = Math.max(trimStart, trimStart + (loop.startSec - track.offsetSec));
        const clipEndInLoop = Math.min(trimEnd, trimStart + (loop.endSec - track.offsetSec));
        if (clipEndInLoop > clipStartInLoop) {
          source.loop = true;
          source.loopStart = clipStartInLoop;
          source.loopEnd = clipEndInLoop;
          const startPos = Math.max(clipStartInLoop, Math.min(clipEndInLoop - 0.02, bufferOffset));
          source.start(startAt, startPos);
        }
      } else if (bufferOffset < trimEnd) {
        const remainingDur = (trimEnd - bufferOffset) / semitoneRatio;
        if (track.fadeOutSec > 0 && remainingDur > track.fadeOutSec) {
          const fadeOutStart = startAt + remainingDur - track.fadeOutSec;
          clipGain.gain.setValueAtTime(baseClipGain, fadeOutStart);
          clipGain.gain.linearRampToValueAtTime(0.0001, startAt + remainingDur);
        }
        source.start(startAt, bufferOffset, trimEnd - bufferOffset);
      }

      this.activeNodes.set(track.id, {
        source,
        clipGain,
        comp,
        eqLow,
        eqMid,
        eqHigh,
        chorusDelay,
        chorusLfo,
        chorusLfoGain,
        chorusWet,
        delayNode,
        delayFeedback,
        delayWet,
        gain,
        pan,
        reverbGain,
        analyser,
        analyserData,
      });
    }
  }

  public updateLiveTrackParams(tracks: Track[]): void {
    if (!this.ctx) return;
    const anySolo = tracks.some((t) => t.solo);
    const now = this.ctx.currentTime;

    for (const track of tracks) {
      const nodes = this.activeNodes.get(track.id);
      if (!nodes) continue;
      const isAudible = anySolo ? track.solo : !track.muted;

      nodes.source.playbackRate.setTargetAtTime(
        Math.pow(2, (track.semitoneShift + track.centsDetune / 100) / 12),
        now,
        0.02
      );
      nodes.clipGain.gain.setTargetAtTime(dbToGain(track.clipGainDb), now, 0.02);
      nodes.gain.gain.setTargetAtTime(isAudible ? track.volume : 0, now, 0.015);
      nodes.pan.pan.setTargetAtTime(track.pan, now, 0.015);

      nodes.comp.threshold.setTargetAtTime(track.fxEnabled ? track.compThreshold : 0, now, 0.02);
      nodes.comp.ratio.setTargetAtTime(
        track.fxEnabled ? Math.max(1, track.compRatio) : 1,
        now,
        0.02
      );
      nodes.eqLow.gain.setTargetAtTime(track.fxEnabled ? track.eqLow : 0, now, 0.02);
      nodes.eqMid.gain.setTargetAtTime(track.fxEnabled ? track.eqMid : 0, now, 0.02);
      nodes.eqHigh.gain.setTargetAtTime(track.fxEnabled ? track.eqHigh : 0, now, 0.02);

      nodes.chorusLfoGain.gain.setTargetAtTime(
        track.fxEnabled ? track.chorusDepth * 0.004 : 0,
        now,
        0.02
      );
      nodes.chorusWet.gain.setTargetAtTime(
        track.fxEnabled ? track.chorusDepth * 0.45 : 0,
        now,
        0.02
      );

      nodes.delayNode.delayTime.setTargetAtTime(
        Math.max(0.04, Math.min(0.8, track.delayTimeMs / 1000)),
        now,
        0.02
      );
      nodes.delayFeedback.gain.setTargetAtTime(
        track.fxEnabled ? Math.min(0.7, track.delayFeedback) : 0,
        now,
        0.02
      );
      nodes.delayWet.gain.setTargetAtTime(track.fxEnabled ? track.delayMix : 0, now, 0.02);
      nodes.reverbGain.gain.setTargetAtTime(
        isAudible && track.fxEnabled ? track.reverbSend * 0.65 : 0,
        now,
        0.02
      );
    }
  }

  public getCurrentTransportTime(): number {
    if (!this.ctx || !this.isPlaying) return this.playStartOffsetSec;
    const elapsed = Math.max(0, this.ctx.currentTime - this.playStartCtxTime);
    const raw = this.playStartOffsetSec + elapsed;
    if (this.currentLoop.enabled && this.currentLoop.endSec > this.currentLoop.startSec + 0.1) {
      const span = this.currentLoop.endSec - this.currentLoop.startSec;
      if (raw >= this.currentLoop.startSec) {
        return this.currentLoop.startSec + ((raw - this.currentLoop.startSec) % span);
      }
    }
    return raw;
  }

  public getTrackLevels(): Record<string, number> {
    const levels: Record<string, number> = {};
    this.activeNodes.forEach((nodes, id) => {
      nodes.analyser.getFloatTimeDomainData(nodes.analyserData);
      let max = 0;
      for (let i = 0; i < nodes.analyserData.length; i++) {
        const v = Math.abs(nodes.analyserData[i]);
        if (v > max) max = v;
      }
      levels[id] = Math.min(1, max * 1.9);
    });
    return levels;
  }

  public stopPlayback(resetOffsetTo = 0): void {
    this.isPlaying = false;
    this.playStartOffsetSec = resetOffsetTo;
    this.activeNodes.forEach((nodes) => {
      try {
        nodes.source.stop();
        nodes.chorusLfo.stop();
        nodes.source.disconnect();
      } catch {
        // already stopped
      }
    });
    this.activeNodes.clear();
  }

  public async decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
    const ctx = await this.ensureContext();
    const arrayBuffer = await blob.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  }

  /**
   * Non-destructive / undoable PCM audio editing utilities
   */
  public async normalizeAudioBuffer(buffer: AudioBuffer): Promise<AudioBuffer> {
    const ctx = await this.ensureContext();
    let maxAbs = 0;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const a = Math.abs(data[i]);
        if (a > maxAbs) maxAbs = a;
      }
    }
    const factor = maxAbs > 0.001 ? 0.94 / maxAbs : 1;
    const out = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      const dst = out.getChannelData(ch);
      for (let i = 0; i < src.length; i++) {
        dst[i] = Math.max(-1, Math.min(1, src[i] * factor));
      }
    }
    return out;
  }

  public async reverseAudioBuffer(buffer: AudioBuffer): Promise<AudioBuffer> {
    const ctx = await this.ensureContext();
    const out = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      const dst = out.getChannelData(ch);
      for (let i = 0; i < src.length; i++) {
        dst[i] = src[src.length - 1 - i];
      }
    }
    return out;
  }

  public async splitAudioBufferAt(
    buffer: AudioBuffer,
    splitSec: number
  ): Promise<[AudioBuffer, AudioBuffer] | null> {
    const ctx = await this.ensureContext();
    const splitSample = Math.floor(splitSec * buffer.sampleRate);
    if (splitSample <= 256 || splitSample >= buffer.length - 256) {
      return null;
    }

    const left = ctx.createBuffer(buffer.numberOfChannels, splitSample, buffer.sampleRate);
    const right = ctx.createBuffer(
      buffer.numberOfChannels,
      buffer.length - splitSample,
      buffer.sampleRate
    );

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      left.copyToChannel(src.subarray(0, splitSample), ch);
      right.copyToChannel(src.subarray(splitSample), ch);
    }

    return [left, right];
  }

  /**
   * Renders the full multi-track mix offline (including EQ, compression, delay, reverb,
   * trim, fades, and transpose) into a lossless 16-bit PCM Stereo WAV Blob.
   */
  public async exportMixToWav(tracks: Track[], totalDurationSec: number): Promise<Blob> {
    const sampleRate = 48000;
    const length = Math.max(sampleRate, Math.ceil(totalDurationSec * sampleRate));
    const offline = new OfflineAudioContext(2, length, sampleRate);

    const limiter = offline.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.ratio.value = 5;
    limiter.connect(offline.destination);

    const reverb = offline.createConvolver();
    reverb.buffer = createStudioImpulseResponse(offline, 1.7, 2.8);
    reverb.connect(limiter);

    const anySolo = tracks.some((t) => t.solo);

    for (const track of tracks) {
      if (!track.audioBuffer) continue;
      const isAudible = anySolo ? track.solo : !track.muted;
      if (!isAudible) continue;

      const source = offline.createBufferSource();
      source.buffer = track.audioBuffer;
      const semitoneRatio = Math.pow(2, (track.semitoneShift + track.centsDetune / 100) / 12);
      source.playbackRate.value = semitoneRatio;

      const clipGain = offline.createGain();
      const baseClipGain = dbToGain(track.clipGainDb);

      const comp = offline.createDynamicsCompressor();
      comp.threshold.value = track.fxEnabled ? track.compThreshold : 0;
      comp.ratio.value = track.fxEnabled ? Math.max(1, track.compRatio) : 1;

      const eqLow = offline.createBiquadFilter();
      eqLow.type = 'lowshelf';
      eqLow.frequency.value = 160;
      eqLow.gain.value = track.fxEnabled ? track.eqLow : 0;

      const eqMid = offline.createBiquadFilter();
      eqMid.type = 'peaking';
      eqMid.frequency.value = 1200;
      eqMid.gain.value = track.fxEnabled ? track.eqMid : 0;

      const eqHigh = offline.createBiquadFilter();
      eqHigh.type = 'highshelf';
      eqHigh.frequency.value = 4500;
      eqHigh.gain.value = track.fxEnabled ? track.eqHigh : 0;

      const delayNode = offline.createDelay(1.0);
      delayNode.delayTime.value = Math.max(0.04, Math.min(0.8, track.delayTimeMs / 1000));
      const delayFeedback = offline.createGain();
      delayFeedback.gain.value = track.fxEnabled ? Math.min(0.7, track.delayFeedback) : 0;
      const delayWet = offline.createGain();
      delayWet.gain.value = track.fxEnabled ? track.delayMix : 0;
      delayNode.connect(delayFeedback);
      delayFeedback.connect(delayNode);

      const gain = offline.createGain();
      gain.gain.value = track.volume;

      const pan = offline.createStereoPanner();
      pan.pan.value = track.pan;

      const revSend = offline.createGain();
      revSend.gain.value = track.fxEnabled ? track.reverbSend * 0.65 : 0;

      source.connect(clipGain);
      clipGain.connect(comp);
      comp.connect(eqLow);
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      eqHigh.connect(gain);
      eqHigh.connect(delayNode);
      delayNode.connect(delayWet);
      delayWet.connect(gain);

      gain.connect(pan);
      pan.connect(limiter);

      gain.connect(revSend);
      revSend.connect(reverb);

      const trimStart = Math.max(0, Math.min(track.audioBuffer.duration - 0.1, track.trimStartSec));
      const trimEnd =
        track.trimEndSec > trimStart + 0.05
          ? Math.min(track.audioBuffer.duration, track.trimEndSec)
          : track.audioBuffer.duration;
      const span = Math.max(0.05, trimEnd - trimStart);
      const startAt = Math.max(0, track.offsetSec);
      const playDur = span / semitoneRatio;

      if (track.fadeInSec > 0) {
        clipGain.gain.setValueAtTime(0.001, startAt);
        clipGain.gain.linearRampToValueAtTime(
          baseClipGain,
          startAt + Math.min(track.fadeInSec, playDur * 0.5)
        );
      } else {
        clipGain.gain.setValueAtTime(baseClipGain, startAt);
      }

      if (track.fadeOutSec > 0 && playDur > track.fadeOutSec) {
        clipGain.gain.setValueAtTime(baseClipGain, startAt + playDur - track.fadeOutSec);
        clipGain.gain.linearRampToValueAtTime(0.0001, startAt + playDur);
      }

      source.start(startAt, trimStart, span);
    }

    const rendered = await offline.startRendering();
    return audioBufferToWavBlob(rendered);
  }

  public async createVirtualMicStream(): Promise<{ stream: MediaStream; stop: () => void }> {
    const ctx = await this.ensureContext();
    const dest = ctx.createMediaStreamDestination();
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = 261.63;
    lfo.frequency.value = 0.6;
    lfoGain.gain.value = 14;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    filter.type = 'bandpass';
    filter.frequency.value = 780;
    filter.Q.value = 2.2;

    amp.gain.value = 0.25;

    osc.connect(filter);
    filter.connect(amp);
    amp.connect(dest);

    osc.start();
    lfo.start();

    return {
      stream: dest.stream,
      stop: () => {
        try {
          osc.stop();
          lfo.stop();
        } catch {
          // ignore
        }
      },
    };
  }

  public async generateDemoQuartetBuffers(bpm: number): Promise<
    {
      role: Track['role'];
      name: string;
      singerName: string;
      color: string;
      pan: number;
      reverbSend: number;
      hue: number;
      notes: { startBeat: number; durationBeats: number; midi: number; syllable: string }[];
      buffer: AudioBuffer;
    }[]
  > {
    await this.ensureContext();
    const beatSec = 60 / bpm;
    const totalBeats = 16;
    const durationSec = totalBeats * beatSec;
    const sampleRate = 48000;

    const parts: {
      role: Track['role'];
      name: string;
      singerName: string;
      color: string;
      pan: number;
      reverbSend: number;
      hue: number;
      formant: number;
      notes: { startBeat: number; durationBeats: number; midi: number; syllable: string }[];
    }[] = [
      {
        role: 'Lead',
        name: 'Lead Melody',
        singerName: 'Maya (Soprano)',
        color: '#F14624',
        pan: 0,
        reverbSend: 0.32,
        hue: 14,
        formant: 820,
        notes: [
          { startBeat: 0, durationBeats: 1.5, midi: 67, syllable: 'Ah' },
          { startBeat: 1.5, durationBeats: 1.5, midi: 69, syllable: 'Ooh' },
          { startBeat: 3, durationBeats: 1, midi: 71, syllable: 'La' },
          { startBeat: 4, durationBeats: 2, midi: 72, syllable: 'Ah' },
          { startBeat: 6, durationBeats: 2, midi: 71, syllable: 'Mmm' },
          { startBeat: 8, durationBeats: 1.5, midi: 69, syllable: 'Ooh' },
          { startBeat: 9.5, durationBeats: 1.5, midi: 67, syllable: 'La' },
          { startBeat: 11, durationBeats: 1, midi: 64, syllable: 'Ah' },
          { startBeat: 12, durationBeats: 4, midi: 67, syllable: 'Oh' },
        ],
      },
      {
        role: 'Harmony High',
        name: 'Upper Harmony',
        singerName: 'Elena (Alto)',
        color: '#0EA5E9',
        pan: -0.35,
        reverbSend: 0.35,
        hue: 199,
        formant: 720,
        notes: [
          { startBeat: 0, durationBeats: 3, midi: 64, syllable: 'Ooh' },
          { startBeat: 3, durationBeats: 1, midi: 67, syllable: 'La' },
          { startBeat: 4, durationBeats: 4, midi: 67, syllable: 'Ah' },
          { startBeat: 8, durationBeats: 3, midi: 65, syllable: 'Ooh' },
          { startBeat: 11, durationBeats: 1, midi: 62, syllable: 'Ah' },
          { startBeat: 12, durationBeats: 4, midi: 64, syllable: 'Mmm' },
        ],
      },
      {
        role: 'Harmony Mid',
        name: 'Tenor Pad',
        singerName: 'Liam (Tenor)',
        color: '#10B981',
        pan: 0.35,
        reverbSend: 0.3,
        hue: 160,
        formant: 580,
        notes: [
          { startBeat: 0, durationBeats: 4, midi: 60, syllable: 'Mmm' },
          { startBeat: 4, durationBeats: 4, midi: 57, syllable: 'Ooh' },
          { startBeat: 8, durationBeats: 4, midi: 57, syllable: 'Ah' },
          { startBeat: 12, durationBeats: 4, midi: 59, syllable: 'Mmm' },
        ],
      },
      {
        role: 'Bass',
        name: 'Vocal Bass',
        singerName: 'Marcus (Bass)',
        color: '#F59E0B',
        pan: 0,
        reverbSend: 0.14,
        hue: 38,
        formant: 360,
        notes: [
          { startBeat: 0, durationBeats: 1.5, midi: 48, syllable: 'Dum' },
          { startBeat: 2, durationBeats: 1.5, midi: 48, syllable: 'Bum' },
          { startBeat: 4, durationBeats: 1.5, midi: 45, syllable: 'Dum' },
          { startBeat: 6, durationBeats: 1.5, midi: 45, syllable: 'Bum' },
          { startBeat: 8, durationBeats: 1.5, midi: 41, syllable: 'Dum' },
          { startBeat: 10, durationBeats: 1.5, midi: 41, syllable: 'Bum' },
          { startBeat: 12, durationBeats: 3.5, midi: 43, syllable: 'Doom' },
        ],
      },
    ];

    const results = [];

    for (const part of parts) {
      const offline = new OfflineAudioContext(1, Math.ceil(durationSec * sampleRate), sampleRate);
      for (const note of part.notes) {
        const startTime = note.startBeat * beatSec;
        const dur = note.durationBeats * beatSec;
        const freq = midiToFrequency(note.midi);

        const osc1 = offline.createOscillator();
        const osc2 = offline.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, startTime);
        osc2.frequency.setValueAtTime(freq * 1.002, startTime);

        const vib = offline.createOscillator();
        const vibGain = offline.createGain();
        vib.frequency.value = 5.2;
        vibGain.gain.setValueAtTime(0, startTime);
        vibGain.gain.linearRampToValueAtTime(freq * 0.008, startTime + Math.min(0.35, dur * 0.4));
        vib.connect(vibGain);
        vibGain.connect(osc1.frequency);
        vibGain.connect(osc2.frequency);

        const formantFilter = offline.createBiquadFilter();
        formantFilter.type = 'bandpass';
        formantFilter.frequency.setValueAtTime(part.formant, startTime);
        formantFilter.Q.value = 2.6;

        const warmthFilter = offline.createBiquadFilter();
        warmthFilter.type = 'lowpass';
        warmthFilter.frequency.setValueAtTime(part.formant * 2.4, startTime);

        const env = offline.createGain();
        env.gain.setValueAtTime(0.0001, startTime);
        env.gain.linearRampToValueAtTime(0.28, startTime + 0.07);
        env.gain.setValueAtTime(0.24, Math.max(startTime + 0.08, startTime + dur - 0.09));
        env.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

        osc1.connect(formantFilter);
        osc2.connect(formantFilter);
        formantFilter.connect(warmthFilter);
        warmthFilter.connect(env);
        env.connect(offline.destination);

        osc1.start(startTime);
        osc2.start(startTime);
        vib.start(startTime);
        osc1.stop(startTime + dur + 0.02);
        osc2.stop(startTime + dur + 0.02);
        vib.stop(startTime + dur + 0.02);
      }

      const buffer = await offline.startRendering();
      results.push({
        role: part.role,
        name: part.name,
        singerName: part.singerName,
        color: part.color,
        pan: part.pan,
        reverbSend: part.reverbSend,
        hue: part.hue,
        notes: part.notes,
        buffer,
      });
    }

    return results;
  }
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export const studioAudio = new StudioAudioEngine();
