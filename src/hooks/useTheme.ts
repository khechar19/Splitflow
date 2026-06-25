import { useEffect, useState } from 'react';

export type ThemeType = 'indigo' | 'sunset' | 'emerald' | 'cyberpunk' | 'nordic';

export interface ThemeOption {
  id: ThemeType;
  name: string;
  colors: string[]; // Hex color array representing the primary and accent theme colors
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'indigo', name: 'Midnight Indigo', colors: ['#6366F1', '#8B5CF6'] },
  { id: 'sunset', name: 'Sunset Crimson', colors: ['#EC4899', '#F43F5E'] },
  { id: 'emerald', name: 'Emerald Forest', colors: ['#10B981', '#059669'] },
  { id: 'cyberpunk', name: 'Cyberpunk Gold', colors: ['#F59E0B', '#D946EF'] },
  { id: 'nordic', name: 'Nordic Frost (Light)', colors: ['#2563EB', '#0D9488'] },
];

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    return (localStorage.getItem('splitflow-theme') as ThemeType) || 'indigo';
  });

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem('splitflow-theme', newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    THEME_OPTIONS.forEach((t) => {
      root.classList.remove(`theme-${t.id}`);
    });
    
    // Add new theme class
    root.classList.add(`theme-${theme}`);
    
    // Handle Tailwind CSS v4 dark class toggle for the Nordic Frost light theme
    if (theme === 'nordic') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [theme]);

  return {
    theme,
    setTheme,
    themes: THEME_OPTIONS,
  };
}
