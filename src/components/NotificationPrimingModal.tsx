import { BellRing, Clock } from 'lucide-react';
import { ConsentModal } from './ui/ConsentModal';

interface NotificationPrimingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

// Tarayıcının native izin promptu öncesinde açıklayıcı bir ara adım —
// önceden `handleRequestNotificationPermission` doğrudan
// `Notification.requestPermission()` çağırıyordu; tarayıcı izni bir kez
// reddedilirse geri dönüşü zordur (bkz. premium denetim, bölüm 11), bu
// yüzden native promptu tetiklemeden önce kullanıcıya NEDEN gerektiğini
// gösteriyoruz (bkz. aynı desen: GpsConsentModal, paylaşılan ui/ConsentModal).
export function NotificationPrimingModal({ isOpen, onClose, onConfirm, isLoading }: NotificationPrimingModalProps) {
  return (
    <ConsentModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      title="Anlık Bildirimler"
      icon={<BellRing size={40} strokeWidth={1.5} />}
      iconIdleAnimate={{ scale: [1, 1.08, 1] }}
      iconLoadingAnimate={{ rotate: [0, -15, 15, 0] }}
      description="Nöbet vaktiniz yaklaştığında, size bir görev devredildiğinde veya mazeret talebiniz sonuçlandığında haberdar olabilmeniz için bildirim izni vermeniz gerekmektedir."
      noteIcon={<Clock size={18} strokeWidth={1.5} />}
      note="Hangi bildirimleri alacağınızı Ayarlar'dan istediğiniz zaman özelleştirebilirsiniz."
      confirmLabel="İZİN VER"
      loadingLabel="İSTEK GÖNDERİLİYOR..."
      cancelLabel="ŞİMDİ DEĞİL"
    />
  );
}
