export interface VakitTheme {
  bg: string;
  accent1: string;
  accent2: string;
  text: string;
  icon: string;
}

export interface DynamicTheme {
  color: string;
  glow: string;
  bgGlow: string;
}

export const VAKIT_DYNAMIC_THEMES: Record<string, DynamicTheme> = {
  sabah: { 
    color: '#22D3EE', // Cyan 400
    glow: 'rgba(34, 211, 238, 0.5)', 
    bgGlow: 'rgba(34, 211, 238, 0.08)' 
  },
  ogle: { 
    color: '#F59E0B', // Amber 500
    glow: 'rgba(245, 158, 11, 0.5)', 
    bgGlow: 'rgba(245, 158, 11, 0.12)' 
  },
  ikindi: { 
    color: '#F97316', // Orange 500
    glow: 'rgba(249, 115, 22, 0.5)', 
    bgGlow: 'rgba(249, 115, 22, 0.12)' 
  },
  aksam: { 
    color: '#F43F5E', // Rose 500
    glow: 'rgba(244, 63, 94, 0.5)', 
    bgGlow: 'rgba(244, 63, 114, 0.15)' 
  },
  yatsi: { 
    color: '#818CF8', // Indigo 400
    glow: 'rgba(129, 140, 248, 0.5)', 
    bgGlow: 'rgba(129, 140, 248, 0.1)' 
  }
};

export const getDynamicTheme = (vakit: string | undefined): DynamicTheme => {
  if (!vakit || !VAKIT_DYNAMIC_THEMES[vakit]) {
    return { color: '#ffffff', glow: 'rgba(255,255,255,0.5)', bgGlow: 'rgba(255,255,255,0.04)' };
  }
  return VAKIT_DYNAMIC_THEMES[vakit];
};

export const getVakitTheme = (vakit: string): VakitTheme => {
  switch (vakit) {
    case 'sabah':
      return {
        bg: 'bg-gradient-to-br from-[#1A0B2E] via-[#2D1B5E] to-[#1A0B2E]',
        accent1: 'bg-amber-400/20',
        accent2: 'bg-purple-400/10',
        text: 'Sabahın Aydınlığı',
        icon: 'mosque'
      };
    case 'ogle':
      return {
        bg: 'bg-gradient-to-br from-[#0F2027] via-[#203A43] to-[#2C5364]',
        accent1: 'bg-yellow-400/20',
        accent2: 'bg-blue-300/10',
        text: 'Öğlenin Bereketi',
        icon: 'sun'
      };
    case 'ikindi':
      return {
        bg: 'bg-gradient-to-br from-[#3D2B1F] via-[#5C3A1B] to-[#3D2B1F]',
        accent1: 'bg-orange-400/20',
        accent2: 'bg-yellow-600/10',
        text: 'İkindinin Huzuru',
        icon: 'leaves'
      };
    case 'aksam':
      return {
        bg: 'bg-gradient-to-br from-[#230707] via-[#3E1B1B] to-[#230707]',
        accent1: 'bg-red-500/20',
        accent2: 'bg-pink-600/10',
        text: 'Akşamın Sükuneti',
        icon: 'moon'
      };
    case 'yatsi':
      return {
        bg: 'bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617]',
        accent1: 'bg-indigo-500/10',
        accent2: 'bg-blue-600/10',
        text: 'Yatsının Derinliği',
        icon: 'star'
      };
    default:
      return {
        bg: 'bg-blue-950',
        accent1: 'bg-blue-500/10',
        accent2: 'bg-yellow-500/5',
        text: 'Sıradaki Vakit',
        icon: 'none'
      };
  }
};
