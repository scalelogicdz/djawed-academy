'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const links = [
  { href: '/dashboard', label: 'لوحة التحكم' },
  { href: '/community', label: 'المجتمع' },
];

export default function StudentNav({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between gap-2 px-6 py-4 bg-bg/85 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-2 overflow-x-auto">
        <span className="font-cairo font-extrabold text-gold text-sm ml-4 whitespace-nowrap">
          DK Academy
        </span>
        {links.map((l) => (
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
        {isAdmin && (
          <Link
            href="/admin"
            className={`font-cairo font-semibold text-[13.5px] px-4 py-2 rounded-lg whitespace-nowrap transition ${
              pathname.startsWith('/admin')
                ? 'bg-gradient-to-br from-gold to-goldSoft text-[#0A0F1A]'
                : 'text-muted hover:text-text'
            }`}
          >
            لوحة الإدارة
          </Link>
        )}
      </div>
      <button onClick={handleLogout} className="btn-ghost !py-2 !px-4 text-xs whitespace-nowrap">
        تسجيل الخروج
      </button>
    </nav>
  );
}
