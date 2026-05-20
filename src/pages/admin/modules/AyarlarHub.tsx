import React from 'react';
import { lazy, Suspense } from 'react';
import { SplashLoader } from '../../../components/SplashLoader';

const EzanOnbellegi = lazy(() => import('./EzanOnbellegi'));
const SistemAyarlari = lazy(() => import('./SistemAyarlari'));
const SistemLoglari = lazy(() => import('./SistemLoglari'));

export default function AyarlarHub() {
  return (
    <div className="flex flex-col gap-8">
      <div className="relative">
        <Suspense fallback={<div className="h-64 flex items-center justify-center"><SplashLoader /></div>}>
          <SistemAyarlari />
        </Suspense>
      </div>
      <div className="relative">
        <Suspense fallback={<div className="h-64 flex items-center justify-center"><SplashLoader /></div>}>
          <EzanOnbellegi />
        </Suspense>
      </div>
      <div className="relative border-t border-[var(--glass-border)] pt-8">
        <Suspense fallback={<div className="h-64 flex items-center justify-center"><SplashLoader /></div>}>
          <SistemLoglari />
        </Suspense>
      </div>
    </div>
  );
}
