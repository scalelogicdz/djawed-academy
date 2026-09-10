'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NotificationBell from '@/components/NotificationBell';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useLanguage } from '@/components/LanguageProvider';
import { languageLabels, type Language, type TranslationKey } from '@/lib/i18n';

const links: { href: string; key: TranslationKey; support?: boolean }[] = [
  { href: '/dashboard', key: 'navCourses' },
  { href: '/community', key: 'navCommunity' },
  { href: '/services', key: 'navServices' },
  { href: '/support', key: 'navSupport', support: true },
  { href: '/guidelines', key: 'navGuidelines' },
];

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M7.5 18.5 4 20l1-3.6A7.2 7.2 0 0 1 3 11.5C3 7.9 6.4 5 10.5 5S18 7.9 18 11.5 14.6 18 10.5 18c-1 0-2-.2-3-.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 8.2c2.6.5 4.5 2.4 4.5 4.8 0 1.5-.8 2.9-2.1 3.8l.7 2.7-2.7-1.2c-.7.2-1.4.3-2.2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SupportIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-6h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 13h4v6H6a2 2 0 0 1-2-2v-4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 19c0 1.1-.9 2-2 2h-2" strokeLinecap="round" />
    </svg>
  );
}

function LanguageSelector({ mobile = false }: { mobile?: boolean }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label
      className={
        mobile
          ? 'flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.018] text-sm'
          : 'inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-white/[0.06] bg-white/[0.018]'
      }
    >
      <span className="text-muted text-xs whitespace-nowrap">{t('language')}</span>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="bg-transparent text-text text-xs font-semibold outline-none cursor-pointer"
        aria-label={t('language')}
      >
        {(Object.keys(languageLabels) as Language[]).map((code) => (
          <option key={code} value={code} className="bg-[#111925] text-text">
            {languageLabels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function StudentNav({ isAdmin, currentUserId }: { isAdmin?: boolean; currentUserId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const baseLinks = isAdmin
    ? links.filter((link) => !link.support && link.href !== '/dashboard')
    : links;
  const allLinks = isAdmin
    ? [...baseLinks, { href: '/admin', key: 'navAdmin' as TranslationKey, support: false }]
    : baseLinks;
  const mobileLinks = allLinks.filter((link) => link.href !== '/community');
  const profileHref = `/profile/${currentUserId}`;
  const isAdminArea = pathname.startsWith('/admin');

  return (
    <nav className="sticky top-0 z-50 bg-bg/92 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_10px_30px_-24px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 sm:py-4">
        <Link
          href="/dashboard"
          className="order-2 md:order-1 inline-flex items-center justify-center rounded-lg transition hover:opacity-90"
          aria-label="Djawed Logic"
          title="Djawed Logic"
        >
          <img src="/djawed-logic-logo.png" alt="Djawed Logic" className="h-10 w-auto sm:h-11 block" />
        </Link>

        <div className="hidden md:flex md:order-2 items-center gap-1.5 flex-1 mx-4 overflow-x-auto">
          {allLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`font-cairo font-semibold text-[13.5px] px-4 py-2.5 rounded-xl whitespace-nowrap transition inline-flex items-center gap-2 border ${
                pathname.startsWith(l.href)
                  ? 'bg-gold/[0.08] border-gold/30 text-gold shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]'
                  : 'border-transparent text-muted hover:text-text hover:bg-white/[0.025] hover:border-white/[0.05]'
              }`}
            >
              {l.support && <SupportIcon />}
              {t(l.key)}
            </Link>
          ))}

          {!isAdminArea && <LanguageSelector />}
        </div>

        <div className="order-1 md:order-3 flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-xl text-muted border border-transparent hover:text-text hover:bg-white/[0.025] hover:border-white/[0.05] transition"
            aria-label={t('navMenu')}
          >
            {menuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            )}
          </button>

          {!isAdminArea && (
            <Link
              href={profileHref}
              className={`w-9 h-9 rounded-full inline-flex items-center justify-center border transition ${pathname.startsWith('/profile') ? 'border-gold/45 text-gold bg-gold/[0.08]' : 'border-white/[0.08] text-muted bg-white/[0.015] hover:text-gold hover:border-gold/30 hover:bg-gold/[0.04]'}`}
              aria-label={t('navProfile')}
              title={t('navProfile')}
            >
              <UserIcon />
            </Link>
          )}

          <Link
            href="/community"
            className={`md:hidden w-9 h-9 rounded-full inline-flex items-center justify-center border transition ${pathname.startsWith('/community') ? 'border-gold/45 text-gold bg-gold/[0.08]' : 'border-white/[0.08] text-muted bg-white/[0.015] hover:text-gold hover:border-gold/30 hover:bg-gold/[0.04]'}`}
            aria-label={t('navCommunity')}
            title={t('navCommunity')}
          >
            <CommunityIcon />
          </Link>

          <NotificationBell currentUserId={currentUserId} />

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className="hidden md:inline-flex items-center gap-2 btn-ghost !py-2 !px-4 text-xs whitespace-nowrap"
          >
            {loggingOut && <LoadingSpinner size={14} />}
            {loggingOut ? t('loggingOut') : t('logout')}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-white/[0.06] px-4 py-3 flex flex-col gap-1 bg-bg/98 shadow-[0_18px_30px_-24px_rgba(0,0,0,0.9)]">
          {mobileLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={`font-cairo font-semibold text-[14px] px-4 py-3 rounded-xl transition flex items-center gap-2 border ${
                pathname.startsWith(l.href)
                  ? 'bg-gold/[0.08] border-gold/30 text-gold'
                  : 'border-transparent text-muted hover:bg-white/[0.025] hover:border-white/[0.05] hover:text-text'
              }`}
            >
              {l.support && <SupportIcon size={18} />}
              {t(l.key)}
            </Link>
          ))}

          {!isAdminArea && <LanguageSelector mobile />}

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className="flex items-center justify-start gap-2 text-right font-cairo font-semibold text-[14px] px-4 py-3 rounded-xl border border-transparent text-muted hover:bg-white/[0.025] hover:border-white/[0.05] hover:text-text transition"
          >
            {loggingOut && <LoadingSpinner size={15} />}
            {loggingOut ? t('loggingOut') : t('logout')}
          </button>
        </div>
      )}
    </nav>
  );
}
