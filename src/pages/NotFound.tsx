import { Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';

// `path="*"` rotası yoktu — bilinmeyen bir derin bağlantı (ör. paylaşılan
// eski bir link) boş bir ekran render ediyordu (bkz. premium denetim,
// bölüm 4).
export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-2xl mx-auto px-4 md:px-8 py-16 md:py-24">
      <EmptyState
        icon={<Compass size={32} strokeWidth={1.2} />}
        title="Sayfa Bulunamadı"
        description="Aradığınız sayfa taşınmış veya hiç var olmamış olabilir."
        tone="indigo"
        size="lg"
        action={{ label: 'ANA EKRANA DÖN', onClick: () => navigate('/') }}
      />
    </div>
  );
}
