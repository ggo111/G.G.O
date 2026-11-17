import type { TouchMode } from '../types/game.ts';

export type DeviceProfile = 'mobile' | 'desktop';

const MOBILE_UA_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export function detectDeviceProfile(): DeviceProfile {
  if (typeof window === 'undefined') return 'desktop';

  const coarse = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
  const touchScreenNarrow =
    typeof navigator !== 'undefined' &&
    navigator.maxTouchPoints > 0 &&
    window.innerWidth <= 1024;
  const mobileUa =
    typeof navigator !== 'undefined' && MOBILE_UA_RE.test(navigator.userAgent || '');

  return coarse || touchScreenNarrow || mobileUa ? 'mobile' : 'desktop';
}

export function resolveActiveControlScheme(
  detected: DeviceProfile,
  touchMode: TouchMode
): DeviceProfile {
  if (touchMode === 'always') return 'mobile';
  if (touchMode === 'off') return 'desktop';
  return detected;
}

/**
 * Subscribes to device profile changes from:
 * - Viewport resize / orientationchange / (pointer: coarse) media query
 * - Hybrid devices: switching automatically on first real touch vs keyboard input
 */
export function subscribeDeviceProfile(onChange: (profile: DeviceProfile) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let current: DeviceProfile = detectDeviceProfile();
  let lastInputOverride: DeviceProfile | null = null;

  const emitIfChanged = (next: DeviceProfile) => {
    if (next !== current) {
      current = next;
      onChange(next);
    }
  };

  const handleEnvironmentChange = () => {
    lastInputOverride = null;
    emitIfChanged(detectDeviceProfile());
  };

  const handleTouchStart = () => {
    lastInputOverride = 'mobile';
    emitIfChanged('mobile');
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      lastInputOverride = 'mobile';
      emitIfChanged('mobile');
    } else if (e.pointerType === 'mouse' && detectDeviceProfile() === 'desktop') {
      lastInputOverride = 'desktop';
      emitIfChanged('desktop');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
      return;
    }
    lastInputOverride = 'desktop';
    emitIfChanged('desktop');
  };

  const mq = window.matchMedia?.('(pointer: coarse)');
  mq?.addEventListener?.('change', handleEnvironmentChange);
  window.addEventListener('resize', handleEnvironmentChange);
  window.addEventListener('orientationchange', handleEnvironmentChange);
  window.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('pointerdown', handlePointerDown, { passive: true });
  window.addEventListener('keydown', handleKeyDown, { passive: true });

  return () => {
    mq?.removeEventListener?.('change', handleEnvironmentChange);
    window.removeEventListener('resize', handleEnvironmentChange);
    window.removeEventListener('orientationchange', handleEnvironmentChange);
    window.removeEventListener('touchstart', handleTouchStart);
    window.removeEventListener('pointerdown', handlePointerDown);
    window.removeEventListener('keydown', handleKeyDown);
  };
}
