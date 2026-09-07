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
  { href: '/services', label: 'خدماتنا' },
  { href: '/support', label: 'تواصل مع الإدارة', support: true },
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

function SupportIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-6h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 13h4v6H6a2 2 0 0 1-2-2v-4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 19c0 1.1-.9 2-2 2h-2" strokeLinecap="round" />
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

  const baseLinks = isAdmin
    ? links.filter((link) => !link.support && link.href !== '/dashboard')
    : links;
  const allLinks = isAdmin ? [...baseLinks, { href: '/admin', label: 'لوحة الإدارة', support: false }] : baseLinks;
  const profileHref = `/profile/${currentUserId}`;

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
              {l.label}
            </Link>
          ))}
        </div>

        <div className="order-1 md:order-3 flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-xl text-muted border border-transparent hover:text-text hover:bg-white/[0.025] hover:border-white/[0.05] transition"
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
            className={`w-9 h-9 rounded-full inline-flex items-center justify-center border transition ${pathname.startsWith('/profile') ? 'border-gold/45 text-gold bg-gold/[0.08]' : 'border-white/[0.08] text-muted bg-white/[0.015] hover:text-gold hover:border-gold/30 hover:bg-gold/[0.04]'}`}
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
        <div className="md:hidden border-t border-white/[0.06] px-4 py-3 flex flex-col gap-1 bg-bg/98 shadow-[0_18px_30px_-24px_rgba(0,0,0,0.9)]">
          {allLinks.map((l) => (
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
              {l.label}
            </Link>
          ))}
          <Link
            href={profileHref}
            onClick={() => setMenuOpen(false)}
            className={`font-cairo font-semibold text-[14px] px-4 py-3 rounded-xl transition border ${
              pathname.startsWith('/profile')
                ? 'bg-gold/[0.08] border-gold/30 text-gold'
                : 'border-transparent text-muted hover:bg-white/[0.025] hover:border-white/[0.05] hover:text-text'
            }`}
          >
            ملفي الشخصي
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className="flex items-center justify-start gap-2 text-right font-cairo font-semibold text-[14px] px-4 py-3 rounded-xl border border-transparent text-muted hover:bg-white/[0.025] hover:border-white/[0.05] hover:text-text transition"
          >
            {loggingOut && <LoadingSpinner size={15} />}
            {loggingOut ? 'جارٍ الخروج...' : 'تسجيل الخروج'}
          </button>
        </div>
      )}
    </nav>
  );
}
