import { Compass, Navigation } from 'lucide-react';
import { ConsentModal } from './ui/ConsentModal';

interface GpsConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export function GpsConsentModal({ isOpen, onClose, onConfirm, isLoading }: GpsConsentModalProps) {
  return (
    <ConsentModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      title="Konum Hassasiyeti"
      icon={<Compass size={40} strokeWidth={1.5} />}
      iconIdleAnimate={{ rotate: [0, -10, 10, 0] }}
      iconLoadingAnimate={{ rotate: 360 }}
      description="Ezan vakitlerini bulunduğunuz koordinata göre fıkhi standartlarda milimetrik doğrulukla hesaplayabilmemiz için konum erişimine izin vermeniz gerekmektedir."
      noteIcon={<Navigation size={18} strokeWidth={1.5} />}
      note="Konum verileriniz hiçbir sunucuya kaydedilmez, tamamen cihazınızda (lokal) işlenir."
      confirmLabel="KONUMU EŞLEŞTİR"
      loadingLabel="SENKRONİZE EDİLİYOR..."
      cancelLabel="DAHA SONRA"
    />
  );
}
