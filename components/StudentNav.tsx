'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NotificationBell from '@/components/NotificationBell';

const links = [
  { href: '/dashboard', label: 'لوحة التحكم' },
  { href: '/community', label: 'المجتمع' },
];

export default function StudentNav({ isAdmin, currentUserId }: { isAdmin?: boolean; currentUserId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const allLinks = isAdmin ? [...links, { href: '/admin', label: 'لوحة الإدارة' }] : links;

  return (
    <nav className="sticky top-0 z-50 bg-bg/85 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 sm:py-4">
        <span className="order-2 md:order-1 font-cairo font-extrabold text-gold text-sm whitespace-nowrap">
          DK Academy
        </span>

        {/* Desktop nav links — hidden on mobile */}
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
          <NotificationBell currentUserId={currentUserId} />

          {/* Desktop logout — hidden on mobile, moved into the menu instead */}
          <button
            onClick={handleLogout}
            className="hidden md:inline-flex btn-ghost !py-2 !px-4 text-xs whitespace-nowrap"
          >
            تسجيل الخروج
          </button>

          {/* Mobile menu toggle — hidden on desktop */}
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
        </div>
      </div>

      {/* Mobile dropdown menu */}
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
          <button
            onClick={handleLogout}
            className="text-right font-cairo font-semibold text-[14px] px-4 py-3 rounded-lg text-muted hover:bg-white/[0.03] hover:text-text transition"
          >
            تسجيل الخروج
          </button>
        </div>
      )}
    </nav>
  );
}
