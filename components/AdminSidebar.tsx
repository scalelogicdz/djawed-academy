'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/admin', label: 'نظرة عامة', exact: true },
  { href: '/admin/students', label: 'إدارة الطلاب' },
  { href: '/admin/lessons', label: 'إدارة الدروس' },
  { href: '/admin/support', label: 'طلبات الدعم' },
  { href: '/admin/site-content', label: 'إدارة المحتوى' },
];

function iconFor(href: string) {
  if (href === '/admin') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" />
      </svg>
    );
  }
  if (href.includes('students')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
        <path d="M16 7.5a2.5 2.5 0 1 1 0 5" strokeLinecap="round" />
        <path d="M17.5 15.5c2 .6 3 1.8 3 3.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (href.includes('lessons')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3V4.5Z" strokeLinejoin="round" />
        <path d="M8 20c0-1.7 1.3-3 3-3h7" strokeLinecap="round" />
        <path d="M9 9h5M9 12h5" strokeLinecap="round" />
      </svg>
    );
  }
  if (href.includes('support')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-6h4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 13h4v6H6a2 2 0 0 1-2-2v-4Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16M4 12h10M4 18h8" strokeLinecap="round" />
      <path d="m17 15 3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();

  function active(item: (typeof items)[number]) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  return (
    <>
      <div className="lg:hidden sticky top-[69px] sm:top-[77px] z-40 border-b border-white/[0.06] bg-bg/95 backdrop-blur-xl px-4 py-3 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] font-cairo font-semibold whitespace-nowrap transition ${
                active(item)
                  ? 'border-gold/35 bg-gold/[0.09] text-gold'
                  : 'border-white/[0.07] bg-white/[0.02] text-muted hover:text-text hover:border-white/[0.12]'
              }`}
            >
              {iconFor(item.href)}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <aside className="hidden lg:block w-[245px] flex-shrink-0 self-start sticky top-[98px]">
        <div className="rounded-[20px] border border-white/[0.07] bg-surface/80 p-3 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.9)]">
          <div className="px-3 pt-2 pb-4 border-b border-white/[0.06] mb-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-gold font-bold mb-1">ADMIN</div>
            <div className="font-cairo font-extrabold text-[17px]">لوحة الإدارة</div>
          </div>

          <nav className="space-y-1.5">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-[13.5px] font-cairo font-semibold transition ${
                  active(item)
                    ? 'border-gold/30 bg-gold/[0.08] text-gold'
                    : 'border-transparent text-muted hover:text-text hover:bg-white/[0.025] hover:border-white/[0.06]'
                }`}
              >
                <span className="w-8 h-8 rounded-lg border border-current/15 bg-current/[0.03] inline-flex items-center justify-center flex-shrink-0">
                  {iconFor(item.href)}
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
