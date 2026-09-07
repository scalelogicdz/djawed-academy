'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NotificationBell from '@/components/NotificationBell';
import LoadingSpinner from '@/components/LoadingSpinner';

const links = [
  { href: '/dashboard', label: 'لوحة التحكم' },
  { href: '/community', label: 'المجتمع' },
  { href: '/guidelines', label: 'قواعد وإرشادات المنصة' },
];

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  );
}

function DjawedLogicMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-9 w-9 sm:h-10 sm:w-10"
      role="img"
      aria-label="Djawed Logic"
    >
      <defs>
        <linearGradient id="djawedLogicGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0D58A" />
          <stop offset="52%" stopColor="#D4B15E" />
          <stop offset="100%" stopColor="#A9802F" />
        </linearGradient>
      </defs>
      <path
        d="M9 10H31C45 10 55 19.5 55 32S45 54 31 54H20V44H31C39.2 44 45 39.2 45 32S39.2 20 31 20H19V54H9V10Z"
        fill="url(#djawedLogicGold)"
      />
      <path
        d="M18 5H28V44H47V54H18V5Z"
        fill="url(#djawedLogicGold)"
      />
    </svg>
  );
}

export default function StudentNav({ isAdmin, currentUserId }: { isAdmin?: boolean; currentUserId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const allLinks = isAdmin ? [...links, { href: '/admin', label: 'لوحة الإدارة' }] : links;
  const profileHref = `/profile/${currentUserId}`;

  return (
    <nav className="sticky top-0 z-50 bg-bg/85 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 sm:py-4">
        <Link
          href="/dashboard"
          className="order-2 md:order-1 inline-flex items-center justify-center rounded-lg transition hover:opacity-90"
          aria-label="Djawed Logic"
          title="Djawed Logic"
        >
          <DjawedLogicMark />
        </Link>

        <div className="hidden md:flex md:order-2 items-center gap-2 flex-1 mx-4 overflow-x-auto">
          {allLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`font-cairo font-semibold text-[13.5px] px-4 py-2 rounded-lg whitespace-nowrap transition ${
                pathname.startsWith(l.href)
                  ? 'bg-gradient-to-br from-gold to-goldSoft text-[#0A0F1A]'
                  : 'text-muted hover:text-text'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="order-1 md:order-3 flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-muted hover:text-text transition"
            aria-label="القائمة"
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

          <Link
            href={profileHref}
            className={`w-9 h-9 rounded-full inline-flex items-center justify-center border transition ${pathname.startsWith('/profile') ? 'border-gold text-gold bg-gold/10' : 'border-border text-muted hover:text-gold hover:border-gold/40'}`}
            aria-label="ملفي الشخصي"
            title="ملفي الشخصي"
          >
            <UserIcon />
          </Link>

          <NotificationBell currentUserId={currentUserId} />

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className="hidden md:inline-flex items-center gap-2 btn-ghost !py-2 !px-4 text-xs whitespace-nowrap"
          >
            {loggingOut && <LoadingSpinner size={14} />}
            {loggingOut ? 'جارٍ الخروج...' : 'تسجيل الخروج'}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-border px-4 py-3 flex flex-col gap-1 bg-bg/95">
          {allLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={`font-cairo font-semibold text-[14px] px-4 py-3 rounded-lg transition ${
                pathname.startsWith(l.href)
                  ? 'bg-gradient-to-br from-gold to-goldSoft text-[#0A0F1A]'
                  : 'text-muted hover:bg-white/[0.03] hover:text-text'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href={profileHref}
            onClick={() => setMenuOpen(false)}
            className={`font-cairo font-semibold text-[14px] px-4 py-3 rounded-lg transition ${
              pathname.startsWith('/profile')
                ? 'bg-gradient-to-br from-gold to-goldSoft text-[#0A0F1A]'
                : 'text-muted hover:bg-white/[0.03] hover:text-text'
            }`}
          >
            ملفي الشخصي
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className="flex items-center justify-start gap-2 text-right font-cairo font-semibold text-[14px] px-4 py-3 rounded-lg text-muted hover:bg-white/[0.03] hover:text-text transition"
          >
            {loggingOut && <LoadingSpinner size={15} />}
            {loggingOut ? 'جارٍ الخروج...' : 'تسجيل الخروج'}
          </button>
        </div>
      )}
    </nav>
  );
}
