import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MouseEvent as ReactMouseEvent } from 'react';

type Theme = 'light' | 'dark';

type ThemeToggleEvent = ReactMouseEvent | MouseEvent;

interface ThemeState {
 theme: Theme;
 setTheme: (theme: Theme) => void;
 toggleTheme: (event?: ThemeToggleEvent) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark', // Default to dark as requested in aesthetics
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.setAttribute('data-theme', theme);
      },
      toggleTheme: (event?: ThemeToggleEvent) => {
        const toggle = () => {
          set((state) => {
            const newTheme = state.theme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            return { theme: newTheme };
          });
        };

        if (!document.startViewTransition || !event) {
          toggle();
          return;
        }

        let x: number | undefined = event.clientX;
        let y: number | undefined = event.clientY;

        if (x === undefined && 'nativeEvent' in event) {
          x = event.nativeEvent.clientX;
          y = event.nativeEvent.clientY;
        }

        if (x === undefined && event.target instanceof Element) {
          const rect = event.target.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top + rect.height / 2;
        }

        if (x === undefined || y === undefined) {
          toggle();
          return;
        }

        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );

        const transition = document.startViewTransition(() => {
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
