import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
 theme: Theme;
 setTheme: (theme: Theme) => void;
 toggleTheme: (event?: any) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark', // Default to dark as requested in aesthetics
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.setAttribute('data-theme', theme);
      },
      toggleTheme: (event?: any) => {
        const toggle = () => {
          set((state) => {
            const newTheme = state.theme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            return { theme: newTheme };
          });
        };

        const doc = document as any;
        if (!doc.startViewTransition || !event) {
          toggle();
          return;
        }

        let x = event.clientX;
        let y = event.clientY;

        if (x === undefined && event.nativeEvent) {
          x = event.nativeEvent.clientX;
          y = event.nativeEvent.clientY;
        }

        if (x === undefined && event.target) {
          const rect = event.target.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top + rect.height / 2;
        }

        if (x === undefined) {
          toggle();
          return;
        }

        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );

        const transition = doc.startViewTransition(() => {
          toggle();
        });

        transition.ready.then(() => {
          const clipPath = [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`
          ];
          document.documentElement.animate(
            {
              clipPath: clipPath,
            },
            {
              duration: 400,
              easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
              pseudoElement: '::view-transition-new(root)',
            }
          );
        });
      },
    }),
    {
      name: 'muezzin-theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.setAttribute('data-theme', state.theme);
        }
      },
    }
  )
);
