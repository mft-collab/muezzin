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
 color: '#38BDF8', // Sky 400 (Vibrant Cyan)
 glow: 'rgba(56, 189, 248, 0.4)', 
 bgGlow: 'rgba(56, 189, 248, 0.06)' 
 },
 ogle: { 
 color: '#FCD34D', // Amber 300 (Soft Gold)
 glow: 'rgba(252, 211, 77, 0.4)', 
 bgGlow: 'rgba(252, 211, 77, 0.08)' 
 },
 ikindi: { 
 color: '#FB923C', // Orange 400 (Sunset Orange)
 glow: 'rgba(251, 146, 60, 0.4)', 
 bgGlow: 'rgba(251, 146, 60, 0.08)' 
 },
 aksam: { 
 color: '#FB7185', // Rose 400 (Soft Ruby)
 glow: 'rgba(251, 113, 133, 0.4)', 
 bgGlow: 'rgba(251, 113, 133, 0.1)' 
 },
 yatsi: { 
 color: '#A5B4FC', // Indigo 300 (Periwinkle Blue)
 glow: 'rgba(165, 180, 252, 0.4)', 
 bgGlow: 'rgba(165, 180, 252, 0.06)' 
 }
};

export const getDynamicTheme = (vakit: string | undefined): DynamicTheme => {
 if (!vakit || !VAKIT_DYNAMIC_THEMES[vakit]) {
 return { color: '#ffffff', glow: 'rgba(255,255,255,0.5)', bgGlow: 'rgba(255,255,255,0.04)' };
 }
 return VAKIT_DYNAMIC_THEMES[vakit];
};

export const VAKIT_TEXT_COLORS: Record<string, string> = {
 sabah: '#BAE6FD',
 ogle: '#FEF08A',
 ikindi: '#FED7AA',
 aksam: '#FECDD3',
 yatsi: '#C7D2FE',
};

export const VAKIT_SURFACE_TINTS: Record<string, string> = {
 sabah: 'rgba(56, 189, 248, 0.04)',
 ogle: 'rgba(252, 211, 77, 0.05)',
 ikindi: 'rgba(251, 146, 60, 0.05)',
 aksam: 'rgba(251, 113, 133, 0.06)',
 yatsi: 'rgba(165, 180, 252, 0.04)',
};
