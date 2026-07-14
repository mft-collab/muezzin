import { useEffect } from 'react';

/**
 * useSpecularHighlight
 *
 * Mouse-move & mobile gyroscope listener that lerps global CSS variables
 * --specular-x and --specular-y toward the latest pointer/tilt position for
 * high-end volumetric glass reflections.
 *
 * The rAF loop only runs while actively interpolating toward a new target —
 * it stops itself once the lerp settles within epsilon, and restarts on the
 * next mousemove/deviceorientation event, instead of ticking every frame
 * forever regardless of input.
 */
export function useSpecularHighlight() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const EPSILON = 0.05;
    const docEl = document.documentElement;

    let rafId: number | null = null;
    let currentX = 50;
    let currentY = 0;
    let targetX = 50;
    let targetY = 0;

    const updateCSS = () => {
      // Interpolate values for buttery smooth transition (lerp)
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      docEl.style.setProperty('--specular-x', `${currentX.toFixed(2)}%`);
      docEl.style.setProperty('--specular-y', `${currentY.toFixed(2)}%`);

      const settled = Math.abs(targetX - currentX) < EPSILON && Math.abs(targetY - currentY) < EPSILON;
      if (settled) {
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(updateCSS);
    };

    const ensureLoopRunning = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(updateCSS);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth) * 100;
      targetY = (e.clientY / window.innerHeight) * 100;
      ensureLoopRunning();
    };

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // beta (-180 to 180): front-back tilt
      // gamma (-90 to 90): left-right tilt
      if (e.gamma === null || e.beta === null) return;

      // Clamp values and normalize to 0-100%
      const tiltX = Math.max(0, Math.min(100, ((e.gamma + 45) / 90) * 100));
      const tiltY = Math.max(0, Math.min(100, ((e.beta - 10) / 60) * 100));

      targetX = tiltX;
      targetY = tiltY;
      ensureLoopRunning();
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Work safely with DeviceOrientation API
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);
}
