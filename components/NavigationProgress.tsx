'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearTimers() {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      if (finishTimer.current) clearTimeout(finishTimer.current);
    }

    function startProgress(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      const current = new URL(window.location.href);
      if (url.pathname === current.pathname && url.search === current.search && url.hash) return;

      clearTimers();
      setFinishing(false);
      setLoading(true);

      fallbackTimer.current = setTimeout(() => {
        setFinishing(true);
        finishTimer.current = setTimeout(() => {
          setLoading(false);
          setFinishing(false);
        }, 220);
      }, 8000);
    }

    document.addEventListener('click', startProgress, true);
    return () => {
      document.removeEventListener('click', startProgress, true);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (!loading) return;

    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    setFinishing(true);
    finishTimer.current = setTimeout(() => {
      setLoading(false);
      setFinishing(false);
    }, 220);

    return () => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
    };
  }, [pathname, searchParams]);

  if (!loading) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px] overflow-hidden" aria-hidden="true">
      <div
        className={`h-full bg-gradient-to-r from-goldDim via-gold to-[#F0D48C] shadow-[0_0_12px_rgba(212,177,94,0.75)] ${
          finishing ? 'nav-progress-finish' : 'nav-progress-active'
        }`}
      />
    </div>
  );
}
