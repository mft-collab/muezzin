import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, ShieldAlert } from 'lucide-react';
import { Modal } from './ui/Modal';
import { useGpsVakitStore } from '../store/useGpsVakitStore';
import { useSystemSettingsStore } from '../store/useSystemSettingsStore';
import { kibleAcisiHesapla, kibleMesafesiHesapla } from '../services/gpsVakitServisi';
import { hapticLight, hapticQiblaLock } from '../lib/haptic';
import { playQiblaLock } from '../lib/sounds';

interface KiblePusulasiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FALLBACK_KOORDINATLAR: Record<string, { lat: number; lng: number }> = {
  "ceyhan": { lat: 37.0298, lng: 35.8164 },
  "seyhan": { lat: 36.9934, lng: 35.3256 },
  "adana": { lat: 36.9914, lng: 35.3308 },
  "ankara": { lat: 39.9334, lng: 32.8597 },
  "istanbul": { lat: 41.0082, lng: 28.9784 },
  "izmir": { lat: 38.4192, lng: 27.1287 }
};

// Sub-component 1: Compact Compass Dial (Memoized structure prevents DOM reconciliation overhead)
interface CompassDialProps {
  dialRef: React.RefObject<HTMLDivElement | null>;
  qiblaAngle: number;
}

const CompactCompassDial = React.memo(({ dialRef, qiblaAngle }: CompassDialProps) => {
  return (
    <div
      ref={dialRef}
      className="w-full h-full rounded-full border border-[var(--glass-border)] bg-[var(--card-elevated-bg)] shadow-[inset_0_2px_8px_rgba(0,0,0,0.12),var(--spatial-shadow)] relative flex items-center justify-center will-change-transform"
      style={{ 
        transform: 'rotate(0deg)',
        backfaceVisibility: 'hidden'
      }}
    >
      {/* 4 Cardinal Directions only for Apple HIG Widget Minimalism */}
      <span className="absolute top-3.5 text-[11px] font-bold text-[var(--aura-ruby)] tracking-wide">K</span>
      <span className="absolute right-4.5 text-[11px] font-bold text-[var(--text-secondary)]/50">D</span>
      <span className="absolute bottom-3.5 text-[11px] font-bold text-[var(--text-secondary)]/50">G</span>
      <span className="absolute left-4.5 text-[11px] font-bold text-[var(--text-secondary)]/50">B</span>

      {/* Astro-Geometric Rings */}
      <div className="absolute w-[80%] h-[80%] rounded-full border border-[var(--glass-border)] opacity-10" />
      <div className="absolute w-px h-[85%] bg-gradient-to-b from-transparent via-[var(--glass-border)] to-transparent opacity-10" />
      <div className="absolute w-[85%] h-px bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent opacity-10" />

      {/* Golden Qibla Destination Marker on the Dial */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-start pt-6.5 z-10 pointer-events-none"
        style={{
          transform: `rotate(${qiblaAngle}deg)`,
        }}
      >
        {/* Glowing Golden Point */}
        <div className="w-2.5 h-2.5 rounded-full bg-[var(--aura-amber)] border border-[var(--aura-amber)]/40 shadow-[0_0_10px_color-mix(in_srgb,var(--aura-amber)_85%,transparent)] relative">
          <span className="absolute inset-[-4px] rounded-full border border-[var(--aura-amber)]/30 animate-ping-slow" />
        </div>
      </div>
    </div>
  );
});
CompactCompassDial.displayName = 'CompactCompassDial';

// Sub-component 2: Compact Compass Needle (Memoized structure prevents pointer lags)
interface CompassNeedleProps {
  needleRef: React.RefObject<HTMLDivElement | null>;
  qiblaAngle: number;
  isAligned: boolean;
}

const CompactCompassNeedle = React.memo(({ needleRef, qiblaAngle, isAligned }: CompassNeedleProps) => {
  return (
    <div
      ref={needleRef}
      className="absolute w-[200px] h-[200px] pointer-events-none flex items-center justify-center z-20 will-change-transform"
      style={{ 
        transform: `rotate(${qiblaAngle}deg)`,
        backfaceVisibility: 'hidden'
      }}
    >
      {/* Luxury Dual-Tone Prismatic Pointer Arrow */}
      <div className="absolute top-0 flex flex-col items-center">
        {/* Outer Alignment Halo (glowing green/amber ring) */}
        <div 
          className={`absolute w-6 h-6 rounded-full blur-[4px] -top-4 transition-all duration-[1s] ${
            isAligned 
              ? 'bg-[var(--aura-emerald)]/40 shadow-[0_0_12px_color-mix(in_srgb,var(--aura-emerald)_50%,transparent)]'
              : 'bg-[var(--aura-amber)]/10'
          }`}
        />

        {/* Compact Prismatic Arrow Geometry */}
        <svg
          viewBox="0 0 20 40"
          className={`w-3.5 h-10 transition-colors duration-500 drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)] ${
            isAligned ? 'text-[var(--aura-emerald)]' : 'text-[var(--aura-amber)]'
          }`}
        >
          {/* Left Prism Facet: Golden Amber */}
          <polygon points="10,0 10,40 0,12" fill="currentColor" opacity="0.9" />
          {/* Right Prism Facet: Dark Gold Shadow */}
          <polygon points="10,0 20,12 10,40" fill={isAligned ? 'color-mix(in srgb, var(--aura-emerald) 65%, black)' : 'color-mix(in srgb, var(--aura-amber) 65%, black)'} />
        </svg>

        {/* Minimalist Kaaba Medallion */}
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center border shadow-sm relative z-30 -top-[48px] transition-all duration-700 ${
            isAligned
              ? 'bg-[var(--aura-emerald)] border-[var(--aura-emerald)]/60 text-[var(--text-primary)] shadow-[var(--aura-emerald)]/30'
              : 'bg-zinc-900 border-[var(--aura-amber)]/40 text-[var(--aura-amber)]/80 shadow-black/50'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
            <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.5l7 3.8-7 3.8-7-3.8 7-3.8zM5 9.7l6 3.3V20l-6-3.3V9.7zm8 10.3v-7l6-3.3v7l-6 3.3z"/>
          </svg>
        </div>
      </div>

      {/* Standard Needle Counterweight (Matte Black/Steel disc at the bottom) */}
      <div className="absolute bottom-8 w-2 h-4 flex flex-col items-center">
        <div className="w-1 h-3 bg-zinc-600/40 rounded-full border border-zinc-500/30" />
      </div>
    </div>
  );
});
CompactCompassNeedle.displayName = 'CompactCompassNeedle';


export const KiblePusulasiModal: React.FC<KiblePusulasiModalProps> = ({ isOpen, onClose }) => {
  const { gpsEnabled, gpsCoords, gpsKonumAdi } = useGpsVakitStore();
  const { settings } = useSystemSettingsStore();

  // Refs for direct DOM manipulation (Bypasses React re-renders to maintain 0% CPU overhead)
  const dialRef = useRef<HTMLDivElement>(null);
  const needleRef = useRef<HTMLDivElement>(null);
  const lastUpdateRef = useRef<number>(0);
  
  // Vibration Lockout to prevent browser flooding/blocking
  const lastVibeTimeRef = useRef<number>(0);

  // Smooth Interpolation & Throttle Refs
  const headingRef = useRef<number | null>(null);
  const currentHeadingRef = useRef<number>(0);
  const rafIdRef = useRef<number>(0);

  // Throttled states (Updated at 10Hz, which is perfect for text labels and glows)
  const [headingState, setHeadingState] = useState<number | null>(null);
  const [isAligned, setIsAligned] = useState<boolean>(false);

  // iOS Safari'de requestPermission() zorunludur; bu tarayıcı özelliği
  // oturum boyunca sabittir, bir kez tespit edilip saklanır.
  const [isIOSDevice] = useState(() =>
    typeof window !== 'undefined' &&
    typeof DeviceOrientationEvent !== 'undefined' &&
    // @ts-expect-error requestPermission yalnızca iOS Safari'de mevcut, lib.dom.d.ts'te yok
    typeof DeviceOrientationEvent.requestPermission === 'function'
  );

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  // Modal her açıldığında izin durumunu render sırasında ayarla (iOS'ta izin
  // banner'ı gösterilir, diğerlerinde sensöre doğrudan izin varsayılır) —
  // bkz. useBugunkuGorevlerim.ts'teki aynı desen.
  const [lastPermCheckOpen, setLastPermCheckOpen] = useState(false);
  if (isOpen !== lastPermCheckOpen) {
    setLastPermCheckOpen(isOpen);
    if (isOpen) {
      setPermissionGranted(isIOSDevice ? false : true);
    }
  }

  // Resolve Active Coordinates (GPS or Fallback)
  const coords = useMemo(() => {
    if (gpsEnabled && gpsCoords) {
      return { lat: gpsCoords.latitude, lng: gpsCoords.longitude };
    }
    const normalized = settings.ilceAdi ? settings.ilceAdi.trim().toLowerCase() : "";
    const trNormalized = normalized
      .replace(/ı/g, 'i')
      .replace(/ş/g, 's')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
    return FALLBACK_KOORDINATLAR[trNormalized] || FALLBACK_KOORDINATLAR[normalized] || { lat: 37.0298, lng: 35.8164 }; // Default to Ceyhan base
  }, [gpsEnabled, gpsCoords, settings.ilceAdi]);

  // Calculate Qibla angle and distance
  const qiblaAngle = useMemo(() => kibleAcisiHesapla(coords.lat, coords.lng), [coords]);
  const distance = useMemo(() => kibleMesafesiHesapla(coords.lat, coords.lng), [coords]);

  // Gestures Alignment Haptic Trigger: Works inside standard React side-effect with a 2-second rate limit
  // Completely bypasses requestAnimationFrame blocking and vibration spam guards
  useEffect(() => {
    if (isAligned && isOpen) {
      const now = Date.now();
      if (now - lastVibeTimeRef.current > 2000) {
        lastVibeTimeRef.current = now;
        hapticQiblaLock(); // Stronger double tap vibration for Qibla alignment
        playQiblaLock(); // Crisp mechanical bell sound
      }
    }
  }, [isAligned, isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Warm up/Unlock vibration API upon user-initiated click opening the modal
      hapticLight();
    }
  }, [isOpen]);

  // Smooth Animation Frame Loop (lerped rotation at display refresh rate using independent compositor layer)
  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    const renderLoop = () => {
      if (!active) return;

      if (headingRef.current !== null) {
        // Calculate shortest angular distance for rotation interpolation
        let diff = headingRef.current - currentHeadingRef.current;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;

        // Adaptive lerp factor: smaller (0.025) for hand jitter filtering, larger (0.15) for fast responsiveness
        const absDiff = Math.abs(diff);
        const adaptiveLerp = 0.025 + Math.min(0.125, (absDiff / 45) * 0.09);
        currentHeadingRef.current += diff * adaptiveLerp;
        
        if (currentHeadingRef.current < 0) currentHeadingRef.current += 360;
        if (currentHeadingRef.current >= 360) currentHeadingRef.current -= 360;

        const curHeading = currentHeadingRef.current;

        // Apply hardware-accelerated transforms (translateZ(0) pushes it to the GPU compositor layer)
        if (dialRef.current) {
          dialRef.current.style.transform = `rotate(${-curHeading.toFixed(2)}deg) translateZ(0)`;
        }
        if (needleRef.current) {
          needleRef.current.style.transform = `rotate(${(qiblaAngle - curHeading).toFixed(2)}deg) translateZ(0)`;
        }

        // Throttle state updates to 10Hz to save CPU
        const nowTime = performance.now();
        if (nowTime - lastUpdateRef.current > 100) {
          lastUpdateRef.current = nowTime;
          
          const diffRaw = Math.abs(curHeading - qiblaAngle) % 360;
          const angleDiff = diffRaw > 180 ? 360 - diffRaw : diffRaw;
          const aligned = angleDiff <= 3.5;
          
          setHeadingState(Math.round(curHeading));
          setIsAligned(aligned);
        }
      }

      rafIdRef.current = requestAnimationFrame(renderLoop);
    };

    rafIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      active = false;
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [isOpen, qiblaAngle]);

  // Sensor Event Listeners (Write to Ref only, bypassing React re-renders)
  const handleOrientation = (e: DeviceOrientationEvent) => {
    // Dynamic self-healing: sensor works, set permission state to true
    setPermissionGranted(true);

    let currentHeading: number | null = null;
    // @ts-expect-error webkitCompassHeading Safari/iOS'a özgü, lib.dom.d.ts'te yok
    if (e.webkitCompassHeading !== undefined) {
      // @ts-expect-error webkitCompassHeading Safari/iOS'a özgü, lib.dom.d.ts'te yok
      currentHeading = e.webkitCompassHeading;
    } else if (e.alpha !== null) {
      currentHeading = (360 - e.alpha) % 360;
    } else {
      return;
    }

    if (currentHeading !== null) {
      headingRef.current = currentHeading;
    }
  };

  const handleOrientationAbsolute = (e: DeviceOrientationEvent) => {
    setPermissionGranted(true);

    let currentHeading: number | null = null;
    // @ts-expect-error webkitCompassHeading Safari/iOS'a özgü, lib.dom.d.ts'te yok
    if (e.webkitCompassHeading !== undefined) {
      // @ts-expect-error webkitCompassHeading Safari/iOS'a özgü, lib.dom.d.ts'te yok
      currentHeading = e.webkitCompassHeading;
    } else if (e.alpha !== null) {
      currentHeading = (360 - e.alpha) % 360;
    }

    if (currentHeading !== null) {
      headingRef.current = currentHeading;
    }
  };

  // Request Sensors Permission (iOS specific)
  const requestPermission = async () => {
    hapticLight();
    if (
      typeof window !== 'undefined' &&
      typeof DeviceOrientationEvent !== 'undefined' &&
      // @ts-expect-error requestPermission yalnızca iOS Safari'de mevcut, lib.dom.d.ts'te yok
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        // @ts-expect-error requestPermission yalnızca iOS Safari'de mevcut, lib.dom.d.ts'te yok
        const state = await DeviceOrientationEvent.requestPermission();
        if (state === 'granted') {
          setPermissionGranted(true);
          window.addEventListener('deviceorientation', handleOrientation, true);
        } else {
          setPermissionGranted(false);
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('iOS Sensor Permission Error:', err);
        }
        setPermissionGranted(false);
      }
    } else {
      setPermissionGranted(true);
    }
  };

  // Sensor Lifecycle management (Ensures 100% cleanup when closed)
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!isIOSDevice) {
      if ('ondeviceorientationabsolute' in (window as any)) {
        window.addEventListener('deviceorientationabsolute', handleOrientationAbsolute, true);
      } else {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    } else {
      // iOS: Show permission banner first, but also attempt immediate binding in case it's pre-granted
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientationAbsolute, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      // Kapanırken (veya yeniden çalışmadan önce) sensör durumunu sıfırla —
      // 0% aktif CPU kullanımı hedefi. Cleanup effect kapanış anında zaten
      // çalıştığı için ayrı bir "!isOpen" dalına gerek yok.
      setHeadingState(null);
      setIsAligned(false);
      headingRef.current = null;
      lastVibeTimeRef.current = 0;
    };
  }, [isOpen, isIOSDevice]);

  const locationText = gpsEnabled && gpsKonumAdi ? `${gpsKonumAdi} (GPS)` : `${settings.ilceAdi || 'Ceyhan'} İlçe Merkezi`;
  const needleRotation = headingState !== null ? qiblaAngle - headingState : qiblaAngle;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="KIBLE YÖNÜ PUSULASI"
    >
      <div className="flex flex-col items-center pt-6 pb-4 relative text-center">
        {/* Compact Circadian Aura Glow */}
        <div
          className="absolute w-[240px] h-[240px] rounded-full blur-[50px] pointer-events-none transition-all duration-[1.5s] z-0 top-2"
          style={{
            background: isAligned
              ? 'radial-gradient(circle, var(--aura-emerald) 0%, transparent 70%)'
              : 'radial-gradient(circle, var(--aura-amber) 0%, transparent 70%)',
            opacity: headingState !== null ? (isAligned ? 0.35 : 0.12) : 0.05
          }}
        />

        <p className="text-[11px] text-[var(--text-secondary)]/50 tracking-[0.18em] uppercase font-bold mb-1">
          Hassas Yön Tayini
        </p>
        <h3 className="text-sm font-light text-[var(--text-primary)] mb-5 tracking-tight">
          {locationText}
        </h3>

        {/* COMPASS COMPACT SCREEN - 220PX ULTRA-PREMIUM APPLE WIDGET DESIGN */}
        <div className="relative w-[220px] h-[220px] flex items-center justify-center z-10 mb-8 select-none">
          {/* Bezel Ring: Compact Matte Sandblasted Metal Frame */}
          <div className="absolute inset-[-4px] rounded-full bg-gradient-to-b from-zinc-200/90 to-zinc-400/90 dark:from-zinc-800/80 dark:to-zinc-950/80 border border-[var(--text-primary)]/5 dark:border-[var(--text-primary)]/10 shadow-[0_12px_28px_rgba(0,0,0,0.25),inset_0_1px_1.5px_rgba(255,255,255,0.12)] pointer-events-none z-0" />
          
          {/* Compass Dial Outer Ring */}
          <CompactCompassDial dialRef={dialRef} qiblaAngle={qiblaAngle} />

          {/* Golden Qibla Needle */}
          <CompactCompassNeedle needleRef={needleRef} qiblaAngle={qiblaAngle} isAligned={isAligned} />

          {/* Central Bearing: Red Ruby Jewel with Steel Bezel (Precision watches detail) */}
          <div className="absolute w-6.5 h-6.5 rounded-full bg-gradient-to-b from-zinc-300 to-zinc-500 dark:from-zinc-700 dark:to-zinc-900 border border-zinc-400/30 shadow-[0_2px_4px_rgba(0,0,0,0.3)] flex items-center justify-center z-30 pointer-events-none">
            {/* Jewel Cap */}
            <div 
              className="w-2.5 h-2.5 rounded-full border shadow-inner transition-all duration-[1s]" 
              style={{
                background: isAligned
                  ? 'radial-gradient(circle at 35% 35%, var(--aura-emerald) 0%, color-mix(in srgb, var(--aura-emerald) 70%, black) 60%, color-mix(in srgb, var(--aura-emerald) 40%, black) 100%)'
                  : 'radial-gradient(circle at 35% 35%, var(--aura-ruby) 0%, color-mix(in srgb, var(--aura-ruby) 70%, black) 60%, color-mix(in srgb, var(--aura-ruby) 40%, black) 100%)',
                borderColor: isAligned ? 'color-mix(in srgb, var(--aura-emerald) 60%, white)' : 'color-mix(in srgb, var(--aura-ruby) 60%, white)'
              }}
            />
          </div>
        </div>

        {/* SENSOR ACCESS REQUEST SCREEN (specifically for iOS) */}
        {permissionGranted === false && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full p-5 spatial-glass border-[var(--aura-amber)]/20 bg-[var(--aura-amber)]/[0.015] rounded-3xl flex flex-col items-center gap-3.5 mb-6 z-10"
          >
            <div className="flex items-center gap-2 text-[var(--aura-amber)]">
              <ShieldAlert size={16} />
              <span className="text-[11px] font-extrabold uppercase tracking-widest leading-none">HAREKET SENSÖRÜ İZNİ</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]/70 font-light leading-normal">
              Safari tarayıcısında pusulanın telefonunuzla birlikte dönmesi için cihaz sensörlerine erişim verilmelidir.
            </p>
            <motion.button
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={requestPermission}
              className="px-5 py-3 bg-[var(--aura-amber)] text-[var(--text-primary)] rounded-xl text-[11px] font-extrabold uppercase tracking-widest cursor-pointer border-none shadow-md shadow-[var(--aura-amber)]/20"
            >
              PUSULAYI ETKİNLEŞTİR
            </motion.button>
          </motion.div>
        )}

        {/* ALIGNMENT BADGE / NOTIFICATIONS */}
        <div className="w-full min-h-[44px] flex items-center justify-center mb-6 z-10 px-4">
          <AnimatePresence mode="wait">
            {isAligned ? (
              <motion.div
                key="aligned"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="px-5 py-2 rounded-full border border-[var(--aura-emerald)]/30 bg-[var(--aura-emerald)]/10 text-[var(--aura-emerald)] font-extrabold text-[11px] tracking-widest uppercase flex items-center gap-2 shadow-[0_0_20px_color-mix(in_srgb,var(--aura-emerald)_15%,transparent)]"
              >
                <span className="w-2 h-2 rounded-full bg-[var(--aura-emerald)] animate-ping-slow shadow-[0_0_10px_var(--aura-emerald)]" />
                KIBLE YÖNÜ HİZALANDI
              </motion.div>
            ) : headingState !== null ? (
              <motion.div
                key="rotating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-[var(--text-secondary)]/75 font-light"
              >
                Telefonunuzu çevirerek ibreyi <strong className="text-[var(--aura-amber)] font-medium">KIBLE (Altın Nokta)</strong> yönüne hizalayın.
              </motion.div>
            ) : (
              <motion.div
                key="static-fallback"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[11px] sm:text-[11px] text-[var(--aura-amber)]/85 bg-[var(--aura-amber)]/5 border border-[var(--aura-amber)]/15 p-4 rounded-2xl flex items-start gap-2.5 text-left leading-normal"
              >
                <Info size={16} className="text-[var(--aura-amber)] shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Masaüstü ve Statik Mod:</strong> Yön sensörü bulunmayan cihazlarda, Kabe haritadaki <strong>kuzeyden saat yönünde doğuya doğru {qiblaAngle.toFixed(1)}°</strong> açıda yer alır. Telefonunuzu bu açıya göre hizalayabilirsiniz.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ANGLE AND DISTANCE CARDS */}
        <div className="grid grid-cols-2 gap-3.5 w-full z-10 relative">
          {/* Qibla Angle Card */}
          <div className="p-4 rounded-3xl spatial-glass flex flex-col items-center">
            <span className="text-[11px] tracking-widest font-extrabold opacity-40 uppercase mb-1">KIBLE DERECESİ</span>
            <span className="text-lg font-mono font-medium text-[var(--text-primary)]">
              {qiblaAngle.toFixed(1)}°
            </span>
            <span className="text-[11px] font-medium opacity-35 mt-0.5">Kuzeyden Doğuya</span>
          </div>

          {/* Kaaba Distance Card */}
          <div className="p-4 rounded-3xl spatial-glass flex flex-col items-center">
            <span className="text-[11px] tracking-widest font-extrabold opacity-40 uppercase mb-1">KABE MESAFESİ</span>
            <span className="text-lg font-mono font-medium text-[var(--text-primary)]">
              {distance.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} km
            </span>
            <span className="text-[11px] font-medium opacity-35 mt-0.5">Kuş Uçuşu Hat</span>
          </div>
        </div>

        {/* Live Heading status when sensors active */}
        {headingState !== null && (
          <span className="text-[11px] text-[var(--text-secondary)]/30 uppercase tracking-widest font-mono mt-6">
            Pusula Sapma Açısı: {Math.round(headingState)}° • Kabe Bağıl Açısı: {Math.round(needleRotation)}°
          </span>
        )}
      </div>
    </Modal>
  );
};
export default KiblePusulasiModal;
