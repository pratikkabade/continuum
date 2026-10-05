import { ClipItem } from '../types/clipboard';

const STORAGE_KEY = 'continuum_clips_glass_v1';
const BROADCAST_CHANNEL_NAME = 'continuum_glass_sync';

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch {
  // Ignore BroadcastChannel errors
}

export function subscribeToSync(callback: (clips: ClipItem[]) => void): () => void {
  if (!broadcastChannel) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'SYNC_CLIPS' && Array.isArray(event.data.clips)) {
      callback(event.data.clips);
    }
  };

  broadcastChannel.addEventListener('message', handler);
  return () => {
    broadcastChannel?.removeEventListener('message', handler);
  };
}

export function broadcastClips(clips: ClipItem[]) {
  if (!broadcastChannel) return;
  try {
    broadcastChannel.postMessage({
      type: 'SYNC_CLIPS',
      clips,
      timestamp: Date.now(),
    });
  } catch {
    // Ignore postMessage failure
  }
}

const INITIAL_SEEDS: ClipItem[] = [
  {
    id: 'seed-code-1',
    type: 'code',
    language: 'typescript',
    content: `// GlassOS Refractive Blur Shader
const glassShader = {
  ior: 1.52,
  dispersion: 0.04,
  roughness: 0.08,
  transmission: 0.94,
  fresnelBias: 0.12
};`,
    createdAt: Date.now() - 1000 * 60 * 5,
    copyCount: 12,
  },
  {
    id: 'seed-color-1',
    type: 'color',
    content: '#0071E3',
    colorHex: '#0071E3',
    colorRgb: 'rgb(0, 113, 227)',
    createdAt: Date.now() - 1000 * 60 * 18,
    copyCount: 24,
  },
  {
    id: 'seed-url-1',
    type: 'url',
    content: 'https://developer.apple.com/design/human-interface-guidelines',
    createdAt: Date.now() - 1000 * 60 * 45,
    copyCount: 7,
  },
  {
    id: 'seed-text-1',
    type: 'text',
    content: `"Simplicity is about subtracting the obvious and adding the meaningful." — John Maeda`,
    createdAt: Date.now() - 1000 * 60 * 120,
    copyCount: 9,
  },
];

export function getStoredClips(): ClipItem[] {
  if (typeof window === 'undefined') return INITIAL_SEEDS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveClips(INITIAL_SEEDS, false);
      return INITIAL_SEEDS;
    }
    const parsed: ClipItem[] = JSON.parse(raw);
    return parsed;
  } catch {
    return INITIAL_SEEDS;
  }
}

export function saveClips(clips: ClipItem[], broadcast = true) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clips));
    if (broadcast) {
      broadcastClips(clips);
    }
  } catch (err) {
    console.error('Failed to save clips:', err);
  }
}
