type AudioContextWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

let context: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();

function getContext() {
  if (typeof window === 'undefined') return null;
  const host = window as AudioContextWindow;
  const Context = host.AudioContext ?? host.webkitAudioContext;
  if (!Context) return null;
  context ??= new Context();
  return context;
}

function loadSound(path: string, audioContext: AudioContext) {
  let buffer = buffers.get(path);
  if (!buffer) {
    buffer = fetch(path)
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load sound: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => audioContext.decodeAudioData(data));
    buffers.set(path, buffer);
    buffer.catch(() => buffers.delete(path));
  }
  return buffer;
}

/** Call from a user gesture to unlock browser audio and preload the sound. */
export async function prepareUiSound(path: string): Promise<boolean> {
  const audioContext = getContext();
  if (!audioContext) return false;
  try {
    // resume() must be initiated in the click handler for browser autoplay rules.
    const resume = audioContext.resume();
    await Promise.all([resume, loadSound(path, audioContext)]);
    return audioContext.state === 'running';
  } catch {
    return false;
  }
}

/** Play a preloaded sound through the unlocked Web Audio context. */
export async function playUiSound(path: string): Promise<boolean> {
  const audioContext = getContext();
  if (!audioContext) return false;
  try {
    const [buffer] = await Promise.all([loadSound(path, audioContext), audioContext.resume()]);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
    return true;
  } catch {
    return false;
  }
}
