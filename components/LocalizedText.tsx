'use client';

import { useLanguage } from '@/components/LanguageProvider';

export default function LocalizedText({ ar, fr, en }: { ar: string; fr: string; en: string }) {
  const { language } = useLanguage();
  return <>{language === 'fr' ? fr : language === 'en' ? en : ar}</>;
}
