export type Language = 'ar' | 'fr' | 'en';

export const languageLabels: Record<Language, string> = {
  ar: 'العربية',
  fr: 'Français',
  en: 'English',
};

export const translations = {
  ar: {
    navCourses: 'دوراتي',
    navCommunity: 'المجتمع',
    navServices: 'خدماتنا',
    navSupport: 'تواصل مع الإدارة',
    navGuidelines: 'قواعد وإرشادات المنصة',
    navAdmin: 'لوحة الإدارة',
    navProfile: 'ملفي الشخصي',
    navMenu: 'القائمة',
    logout: 'تسجيل الخروج',
    loggingOut: 'جارٍ الخروج...',
    language: 'اللغة',
  },
  fr: {
    navCourses: 'Mes cours',
    navCommunity: 'Communauté',
    navServices: 'Nos services',
    navSupport: "Contacter l'administration",
    navGuidelines: 'Règles de la plateforme',
    navAdmin: "Tableau d'administration",
    navProfile: 'Mon profil',
    navMenu: 'Menu',
    logout: 'Se déconnecter',
    loggingOut: 'Déconnexion...',
    language: 'Langue',
  },
  en: {
    navCourses: 'My courses',
    navCommunity: 'Community',
    navServices: 'Our services',
    navSupport: 'Contact administration',
    navGuidelines: 'Platform guidelines',
    navAdmin: 'Admin dashboard',
    navProfile: 'My profile',
    navMenu: 'Menu',
    logout: 'Log out',
    loggingOut: 'Logging out...',
    language: 'Language',
  },
} as const;

export type TranslationKey = keyof typeof translations.ar;
