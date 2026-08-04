import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
 prompt: () => Promise<void>;
 userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type PWAWindow = Window & { __pwaInstallPrompt?: BeforeInstallPromptEvent };

// Standalone/iOS tespiti sabit tarayıcı özellikleridir (oturum boyunca
// değişmez) — bunları bir effect'te setState ile değil, doğrudan lazy
// state initializer'larla hesaplıyoruz ki mount sırasında gereksiz bir
// senkron re-render tetiklenmesin.
function detectPwaEnvironment() {
 if (typeof window === 'undefined') {
 return { isStandalone: false, isIos: false };
 }
 const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
 ('standalone' in window.navigator && (window.navigator as any).standalone === true);
 const userAgent = window.navigator.userAgent.toLowerCase();
 const isIos = /iphone|ipad|ipod/.test(userAgent);
 return { isStandalone, isIos };
}

export function usePWAInstall() {
 const [{ isStandalone, isIos }] = useState(detectPwaEnvironment);
 const [isInstallable, setIsInstallable] = useState(() => !isStandalone && !isIos && !!(window as PWAWindow).__pwaInstallPrompt);
 const [isInstalled, setIsInstalled] = useState(isStandalone);
 const [isIosPrompt, setIsIosPrompt] = useState(isIos && !isStandalone);

 useEffect(() => {
 // Standalone veya iOS: beforeinstallprompt hiç desteklenmiyor/gerekmiyor.
 if (isStandalone || isIos) return;

 // Henüz gelmemişse, main.tsx'in dispatch ettiği event'i bekle
 const onReady = () => setIsInstallable(true);
 window.addEventListener('pwaInstallReady', onReady);

 // Uygulama yüklenince gizle
 const onInstalled = () => {
 setIsInstalled(true);
 setIsInstallable(false);
 delete (window as PWAWindow).__pwaInstallPrompt;
 };
 window.addEventListener('appinstalled', onInstalled);

 return () => {
 window.removeEventListener('pwaInstallReady', onReady);
 window.removeEventListener('appinstalled', onInstalled);
 };
 }, [isStandalone, isIos]);

 const install = async () => {
 const prompt = (window as PWAWindow).__pwaInstallPrompt;
 if (!prompt) return;
 await prompt.prompt();
 const { outcome } = await prompt.userChoice;
 if (outcome === 'accepted') {
 setIsInstallable(false);
 delete (window as PWAWindow).__pwaInstallPrompt;
 }
 };

 return {
 isInstallable,
 isInstalled,
 isIosPrompt,
 install,
 dismissIosPrompt: () => setIsIosPrompt(false),
 dismissInstallPrompt: () => setIsInstallable(false),
 };
}

