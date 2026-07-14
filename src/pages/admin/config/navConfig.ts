import type { ComponentType } from 'react';
import { LayoutDashboard, CalendarDays, Users, Settings, Home, Calendar, User, SlidersHorizontal } from 'lucide-react';

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

export interface AdminNavItemConfig {
  id: string;
  /** Kısa görünür etiket (SlimSidebar'da metin olarak gösterilir) */
  shortLabel: string;
  /** Tam betimleyici etiket (MobileDock'ta aria-label/title, SlimSidebar'da aria-label) */
  fullLabel: string;
  icon: IconComponent;
  badge: number;
}

export function getAdminNavItems(counts: { cozulmamisSayisi: number; pendingIzinler: number }): AdminNavItemConfig[] {
  return [
    { id: 'dashboard', shortLabel: 'Özet', fullLabel: 'Genel Bakış', icon: LayoutDashboard, badge: counts.cozulmamisSayisi },
    { id: 'planlama', shortLabel: 'Cetvel', fullLabel: 'Hizmet Cetveli', icon: CalendarDays, badge: 0 },
    { id: 'ekip', shortLabel: 'Kadro', fullLabel: 'Kadro Yönetimi', icon: Users, badge: counts.pendingIzinler },
    { id: 'ayarlar', shortLabel: 'Sistem', fullLabel: 'Sistem Ayarları', icon: Settings, badge: 0 },
  ];
}

export interface AppLinkConfig {
  path: string;
  label: string;
  icon: IconComponent;
}

export const APP_LINKS: AppLinkConfig[] = [
  { path: '/', label: 'Vakit', icon: Home },
  { path: '/takvim', label: 'Takvim', icon: Calendar },
  { path: '/profil', label: 'Profil', icon: User },
  { path: '/ayarlar', label: 'Ayarlar', icon: SlidersHorizontal },
];
