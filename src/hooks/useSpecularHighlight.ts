import { useEffect } from 'react';

/**
 * useSpecularHighlight
 * 
 * Throttled requestAnimationFrame mouse-move & mobile gyroscope listener.
 * Dynamically updates global CSS variables --specular-x, --specular-y, and --specular-deg
 * on the document element to create high-end volumetric glass reflections.
 */
export function useSpecularHighlight() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number;
    let currentX = 50;
    let currentY = 0;
    let targetX = 50;
    let targetY = 0;

    const updateCSS = () => {
      // Interpolate values for buttery smooth transition (lerp)
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      const docEl = document.documentElement;
      docEl.style.setProperty('--specular-x', `${currentX.toFixed(2)}%`);
      docEl.style.setProperty('--specular-y', `${currentY.toFixed(2)}%`);
      
      // Calculate dynamic angle for linear specular gradients
      const angle = Math.atan2(currentY - 50, currentX - 50) * (180 / Math.PI) + 90;
      docEl.style.setProperty('--specular-deg', `${angle.toFixed(1)}deg`);

      rafId = requestAnimationFrame(updateCSS);
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth) * 100;
      targetY = (e.clientY / window.innerHeight) * 100;
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
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    // Work safely with DeviceOrientation API
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    }

    rafId = requestAnimationFrame(updateCSS);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
      cancelAnimationFrame(rafId);
    };
  }, []);
}
