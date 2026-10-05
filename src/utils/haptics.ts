/**
 * Apple-grade Haptic Engine
 * Provides dual-layer haptic feedback:
 * 1. Hardware vibration via navigator.vibrate (supported on Android, iOS Safari 17.4+ WebApps / modern WebKit)
 * 2. High-precision synthesized Apple Taptic acoustic clicks via Web Audio API
 */

import { isAudioFeedbackEnabled } from './audio';

export type HapticType = 'light' | 'selection' | 'medium' | 'delete' | 'success';

let hapticAudioCtx: AudioContext | null = null;

function getHapticAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!isAudioFeedbackEnabled()) return null;

  try {
    if (!hapticAudioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        hapticAudioCtx = new AudioContextClass();
      }
    }
    if (hapticAudioCtx && hapticAudioCtx.state === 'suspended') {
      hapticAudioCtx.resume();
    }
    return hapticAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Synthesizes an Apple Taptic Engine tactile click impulse (120Hz-220Hz damped transient)
 */
function playTactileImpulse(freq: number, duration: number, volume: number) {
  const ctx = getHapticAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Pure sine wave mimics the physical linear resonant actuator (LRA) in iPhones
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.4), now + duration);

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.01);
}

/**
 * Triggers hardware vibration and acoustic taptic feedback matching Apple iOS interactions
 */
export function triggerHaptic(type: HapticType = 'light') {
  // 1. Hardware Haptic Feedback (navigator.vibrate)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      switch (type) {
        case 'light':
        case 'selection':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(24);
          break;
        case 'delete':
          // Distinct iOS destructive pop pattern: quick warning tap then solid thud
          navigator.vibrate([25, 30, 45]);
          break;
        case 'success':
          navigator.vibrate([15, 40, 20]);
          break;
      }
    } catch {
      // Ignore vibration permissions or browser policies
    }
  }

  // 2. Synthesized Taptic Engine Acoustic Feedback
  switch (type) {
    case 'light':
    case 'selection':
      playTactileImpulse(240, 0.02, 0.06);
      break;
    case 'medium':
      playTactileImpulse(180, 0.035, 0.08);
      break;
    case 'delete':
      // Two-tone Apple destructive tactile pop
      playTactileImpulse(190, 0.03, 0.09);
      setTimeout(() => {
        playTactileImpulse(95, 0.06, 0.12);
      }, 35);
      break;
    case 'success':
      playTactileImpulse(320, 0.03, 0.07);
      setTimeout(() => {
        playTactileImpulse(480, 0.04, 0.08);
      }, 50);
      break;
  }
}

/**
 * Stops any active hardware vibration immediately
 */
export function cancelHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {
      // ignore
    }
  }
}
