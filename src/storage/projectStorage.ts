import type {
  AspectRatio,
  CollageLayout,
  LoopRegion,
  PitchSettings,
  ProjectMeta,
  SavedProjectSummary,
  Track,
} from '../types/studio';

const DB_NAME = 'voxsplit_studio_db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const LAST_PROJECT_KEY = 'voxsplit_last_project_id';

interface SerializedTrack extends Omit<Track, 'audioBuffer' | 'videoUrl' | 'liveLevel'> {
  pcmChannels: Float32Array[] | null;
  sampleRate: number;
}

export interface StoredProjectRecord {
  id: string;
  updatedAt: number;
  project: ProjectMeta;
  pitchSettings: PitchSettings;
  loop: LoopRegion;
  layout: CollageLayout;
  aspectRatio: AspectRatio;
  tracks: SerializedTrack[];
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function serializeTracks(tracks: Track[]): SerializedTrack[] {
  return tracks.map((t) => {
    let pcmChannels: Float32Array[] | null = null;
    let sampleRate = 48000;
    if (t.audioBuffer) {
      sampleRate = t.audioBuffer.sampleRate;
      pcmChannels = [];
      for (let ch = 0; ch < t.audioBuffer.numberOfChannels; ch++) {
        pcmChannels.push(new Float32Array(t.audioBuffer.getChannelData(ch)));
      }
    }
    const { audioBuffer: _ab, videoUrl: _vu, liveLevel: _ll, ...rest } = t;
    return {
      ...rest,
      pcmChannels,
      sampleRate,
    };
  });
}

function deserializeTracks(serialized: SerializedTrack[], ctx: BaseAudioContext): Track[] {
  return serialized.map((st) => {
    let audioBuffer: AudioBuffer | null = null;
    if (st.pcmChannels && st.pcmChannels.length > 0 && st.pcmChannels[0].length > 0) {
      const len = st.pcmChannels[0].length;
      audioBuffer = ctx.createBuffer(st.pcmChannels.length, len, st.sampleRate || 48000);
      for (let ch = 0; ch < st.pcmChannels.length; ch++) {
        audioBuffer.copyToChannel(new Float32Array(st.pcmChannels[ch]), ch);
      }
    }
    const videoUrl = st.videoBlob ? URL.createObjectURL(st.videoBlob) : null;
    const { pcmChannels: _pcm, sampleRate: _sr, ...rest } = st;
    return {
      ...rest,
      audioBuffer,
      videoUrl,
      liveLevel: 0,
    };
  });
}

export async function saveProjectToDb(record: {
  project: ProjectMeta;
  pitchSettings: PitchSettings;
  loop: LoopRegion;
  layout: CollageLayout;
  aspectRatio: AspectRatio;
  tracks: Track[];
}): Promise<number> {
  const db = await openDatabase();
  const updatedAt = Date.now();
  const payload: StoredProjectRecord = {
    id: record.project.id,
    updatedAt,
    project: record.project,
    pitchSettings: record.pitchSettings,
    loop: record.loop,
    layout: record.layout,
    aspectRatio: record.aspectRatio,
    tracks: serializeTracks(record.tracks),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(payload);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  try {
    localStorage.setItem(LAST_PROJECT_KEY, record.project.id);
  } catch {
    // ignore storage quota errors
  }

  return updatedAt;
}

export async function listSavedProjects(): Promise<SavedProjectSummary[]> {
  const db = await openDatabase();
  const records = await new Promise<StoredProjectRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as StoredProjectRecord[]) ?? []);
    req.onerror = () => reject(req.error);
  });

  return records
    .map((r) => ({
      id: r.id,
      title: r.project.title,
      bpm: r.project.bpm,
      musicalKey: r.pitchSettings.key,
      trackCount: r.tracks.length,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProjectFromDb(
  id: string,
  ctx: BaseAudioContext
): Promise<{
  project: ProjectMeta;
  pitchSettings: PitchSettings;
  loop: LoopRegion;
  layout: CollageLayout;
  aspectRatio: AspectRatio;
  tracks: Track[];
  updatedAt: number;
} | null> {
  const db = await openDatabase();
  const record = await new Promise<StoredProjectRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as StoredProjectRecord | undefined);
    req.onerror = () => reject(req.error);
  });

  if (!record) return null;

  try {
    localStorage.setItem(LAST_PROJECT_KEY, id);
  } catch {
    // ignore
  }

  return {
    project: record.project,
    pitchSettings: record.pitchSettings,
    loop: record.loop,
    layout: record.layout,
    aspectRatio: record.aspectRatio,
    tracks: deserializeTracks(record.tracks, ctx),
    updatedAt: record.updatedAt,
  };
}

export async function deleteProjectFromDb(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getLastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}
