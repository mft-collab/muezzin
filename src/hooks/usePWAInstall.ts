import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
 prompt: () => Promise<void>;
 userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type PWAWindow = Window & { __pwaInstallPrompt?: BeforeInstallPromptEvent };

export function usePWAInstall() {
 const [isInstallable, setIsInstallable] = useState(false);
 const [isInstalled, setIsInstalled] = useState(false);
 const [isIosPrompt, setIsIosPrompt] = useState(false);

 useEffect(() => {
 // Standalone (yüklü) mod kontrolü (iOS ve diğerleri)
 const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
 ('standalone' in window.navigator && (window.navigator as any).standalone === true);
 
 if (isStandalone) {
 setIsInstalled(true);
 return;
 }

 // iOS kontrolü
 const userAgent = window.navigator.userAgent.toLowerCase();
 const isIos = /iphone|ipad|ipod/.test(userAgent);
 
 if (isIos) {
 setIsIosPrompt(true);
 // iOS'te beforeinstallprompt desteklenmediği için burada bitiriyoruz
 return;
 }

 // Android / Desktop için beforeinstallprompt dinleme
 if ((window as PWAWindow).__pwaInstallPrompt) {
 setIsInstallable(true);
 }

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
 }, []);

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

 return { isInstallable, isInstalled, isIosPrompt, install, dismissIosPrompt: () => setIsIosPrompt(false) };
}

