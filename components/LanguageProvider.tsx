'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

function applyDocumentLanguage(language: Language) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
}

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const cached = window.localStorage.getItem('preferred_language');
    if (isLanguage(cached)) {
      setLanguageState(cached);
      applyDocumentLanguage(cached);
    }

    fetch('/api/profile/language', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!active || !isLanguage(data.language)) return;
        setLanguageState(data.language);
        window.localStorage.setItem('preferred_language', data.language);
        applyDocumentLanguage(data.language);
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
    applyDocumentLanguage(nextLanguage);

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
      applyDocumentLanguage(previous);
    }
  }

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      direction: language === 'ar' ? 'rtl' : 'ltr',
      setLanguage,
      t: (key) => translations[language][key],
      loading,
    }),
    [language, loading]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
