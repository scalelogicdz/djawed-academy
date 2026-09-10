'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Language, TranslationKey } from '@/lib/i18n';
import { translations } from '@/lib/i18n';

type LanguageContextValue = {
  language: Language;
  direction: 'rtl' | 'ltr';
  setLanguage: (language: Language) => Promise<void>;
  t: (key: TranslationKey) => string;
  loading: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLanguage(value: unknown): value is Language {
  return value === 'ar' || value === 'fr' || value === 'en';
}

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [language, setLanguageState] = useState<Language>('ar');
  const [loading, setLoading] = useState(true);
  const forceArabicLayout = pathname.startsWith('/admin') || pathname.startsWith('/login');
  const direction: 'rtl' | 'ltr' = forceArabicLayout || language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = forceArabicLayout ? 'ar' : language;
    document.documentElement.dir = direction;
  }, [language, direction, forceArabicLayout]);

  useEffect(() => {
    let active = true;

    const cached = window.localStorage.getItem('preferred_language');
    if (isLanguage(cached)) setLanguageState(cached);

    fetch('/api/profile/language', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!active || !isLanguage(data.language)) return;
        setLanguageState(data.language);
        window.localStorage.setItem('preferred_language', data.language);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function setLanguage(nextLanguage: Language) {
    const previous = language;
    setLanguageState(nextLanguage);
    window.localStorage.setItem('preferred_language', nextLanguage);

    try {
      const response = await fetch('/api/profile/language', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: nextLanguage }),
      });

      if (!response.ok) throw new Error('Unable to save language');
    } catch {
      setLanguageState(previous);
      window.localStorage.setItem('preferred_language', previous);
    }
  }

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      direction,
      setLanguage,
      t: (key) => translations[language][key],
      loading,
    }),
    [language, direction, loading]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
