import { create } from 'zustand';
import { NotificationType } from '../components/ui/NotificationToast';
import { playSuccess, playWarning } from '../lib/sounds';

interface Notification {
 id: string;
 title: string;
 message: string;
 type: NotificationType;
}

interface NotificationState {
 notifications: Notification[];
 showNotification: (title: string, message: string, type?: NotificationType) => void;
 removeNotification: (id: string) => void;
}

const VALID_NOTIFICATION_TYPES: NotificationType[] = ['info', 'success', 'warning', 'error'];

export const normalizeNotificationType = (type: unknown): NotificationType => {
 return VALID_NOTIFICATION_TYPES.includes(type as NotificationType)
 ? (type as NotificationType)
 : 'info';
};

// Global reference for the AudioContext
let globalAudioCtx: AudioContext | null = null;
const getAudioContext = () => {
 if (!globalAudioCtx && typeof window !== 'undefined') {
 const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
 if (AudioContextClass) {
 globalAudioCtx = new AudioContextClass();
 }
 }
 return globalAudioCtx;
};

export const unlockAudioContext = async () => {
 const audioCtx = getAudioContext();
 if (audioCtx && audioCtx.state === 'suspended') {
 try {
 await audioCtx.resume();
 } catch (e) {
 // Silently fail
 }
 }
};

// Pre-warm Turkish SpeechSynthesis voices list on module load
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
 window.speechSynthesis.getVoices();
 if (window.speechSynthesis.onvoiceschanged !== undefined) {
 window.speechSynthesis.onvoiceschanged = () => {
 window.speechSynthesis.getVoices();
 };
 }
}

const speechQueue: string[] = [];
let isSpeaking = false;

const processSpeechQueue = () => {
 if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
 if (isSpeaking || speechQueue.length === 0) return;

 const nextText = speechQueue.shift();
 if (!nextText) return;

 try {
 isSpeaking = true;
 const utterance = new SpeechSynthesisUtterance(nextText);
 utterance.lang = 'tr-TR';
 utterance.rate = 0.92; // Slightly calmer, majestic speed for readable Turkish
 utterance.pitch = 1.02; // Pleasant natural pitch

 // Pick highest quality Turkish natural voice
 let voices = window.speechSynthesis.getVoices();
 const findTrVoice = () => {
 return (
 voices.find(v => v.lang.includes('tr-TR') && v.name.toLowerCase().includes('natural')) ||
 voices.find(v => v.lang.includes('tr-TR')) ||
 voices.find(v => v.lang.toLowerCase().includes('tr'))
 );
 };

 const trVoice = findTrVoice();
 if (trVoice) {
 utterance.voice = trVoice;
 } else {
 window.speechSynthesis.onvoiceschanged = () => {
 voices = window.speechSynthesis.getVoices();
 const asyncTrVoice = findTrVoice();
 if (asyncTrVoice) {
 utterance.voice = asyncTrVoice;
 }
 };
 }

 utterance.onend = () => {
 isSpeaking = false;
 setTimeout(processSpeechQueue, 350); // Pause between sequential announcements
 };

 utterance.onerror = (e) => {
 console.warn("Konuşma sentezi öğesi hatası:", e);
 isSpeaking = false;
 setTimeout(processSpeechQueue, 200);
 };

 window.speechSynthesis.speak(utterance);
 } catch (err) {
 console.warn("Konuşma sentezi başlatılamadı:", err);
 isSpeaking = false;
 setTimeout(processSpeechQueue, 200);
 }
};

const speakNotification = (text: string) => {
 speechQueue.push(text);
 processSpeechQueue();
};

const playNotificationSound = async () => {
 try {
 let audioCtx = getAudioContext();
 if (!audioCtx) return;

 // Handle closed or suspended state
 if (audioCtx.state === 'closed') {
 globalAudioCtx = null;
 audioCtx = getAudioContext();
 if (!audioCtx) return;
 }

 if (audioCtx.state === 'suspended') {
 try {
 await audioCtx.resume();
 } catch (e) {
 console.warn("Tarayıcı politikası sesi engelledi (Kullanıcı etkileşimi bekleniyor).", e);
 return; // Sessizce çık
 }
 }

 const t = audioCtx.currentTime;

 // Master Gain (Premium soft attack and long decay)
 const masterGain = audioCtx.createGain();
 masterGain.connect(audioCtx.destination);
 
 masterGain.gain.setValueAtTime(0, t);
 masterGain.gain.linearRampToValueAtTime(0.25, t + 0.05);
 masterGain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);

 // Harmonious dual-tone (Major third: C5, E5) for a pleasant chime
 const freqs = [523.25, 659.25]; 

 const oscillators = freqs.map((freq) => {
 const osc = audioCtx!.createOscillator();
 osc.type = 'sine'; // Soft, pure tone
 osc.frequency.setValueAtTime(freq, t);
 osc.connect(masterGain);
 osc.start(t);
 osc.stop(t + 2.0);
 return osc;
 });

 // Cleanup nodes after playing
 setTimeout(() => {
 oscillators.forEach(osc => osc.disconnect());
 masterGain.disconnect();
 }, 2500);
 } catch (err) {
 console.warn("Ses çalınamadı:", err);
 }
};

export const useNotificationStore = create<NotificationState>((set) => ({
 notifications: [],
 showNotification: (title, message, type = 'info') => {
 const id = Math.random().toString(36).substring(2, 9);
 const safeType = normalizeNotificationType(type);
 set((state) => ({
 notifications: [...state.notifications, { id, title, message, type: safeType }],
 }));
 
 // Play dynamic localized feedback sounds based on type
 if (safeType === 'success') {
   playSuccess();
 } else if (safeType === 'error' || safeType === 'warning') {
   playWarning();
 } else {
   playNotificationSound();
 }

 // Voice announcement (Text-To-Speech) for fully free, premium accessible alerts
 const speakableText = `${title}. ${message}`;
 speakNotification(speakableText);
 },
 removeNotification: (id) => {
 set((state) => ({
 notifications: state.notifications.filter((n) => n.id !== id),
 }));
 },
}));
