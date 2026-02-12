/**
 * Sound effects utility for piece movement animation.
 * Preloads audio files and provides play functions.
 * All errors are caught silently (missing files, autoplay blocked, etc.)
 */

let hopAudio: HTMLAudioElement | null = null;
let landAudio: HTMLAudioElement | null = null;
let initialized = false;

function initSounds() {
  if (initialized) return;
  initialized = true;

  try {
    hopAudio = new Audio("/sounds/hop.mp3");
    hopAudio.volume = 0.4;
    hopAudio.preload = "auto";

    landAudio = new Audio("/sounds/land.mp3");
    landAudio.volume = 0.6;
    landAudio.preload = "auto";
  } catch {
    // Audio not supported
  }
}

export function playHop(): void {
  initSounds();
  if (!hopAudio) return;
  try {
    // Clone and play so overlapping hops don't cut each other off
    const clone = hopAudio.cloneNode() as HTMLAudioElement;
    clone.volume = 0.4;
    clone.play().catch(() => {});
  } catch {
    // Ignore
  }
}

export function playLand(): void {
  initSounds();
  if (!landAudio) return;
  try {
    const clone = landAudio.cloneNode() as HTMLAudioElement;
    clone.volume = 0.6;
    clone.play().catch(() => {});
  } catch {
    // Ignore
  }
}
