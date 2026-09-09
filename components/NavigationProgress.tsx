'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStarted = useRef(false);

  function clearTimers() {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }

  function finishProgress() {
    if (!hasStarted.current) return;

    clearTimers();
    setProgress(100);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
      hasStarted.current = false;
    }, 180);
  }

  useEffect(() => {
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
      if (
        url.pathname === current.pathname &&
        url.search === current.search &&
        url.hash === current.hash
      ) {
        return;
      }

      clearTimers();
      hasStarted.current = true;
      setVisible(true);
      setProgress(12);

      requestAnimationFrame(() => setProgress(34));
      advanceTimer.current = setTimeout(() => setProgress(72), 220);

      fallbackTimer.current = setTimeout(() => {
        finishProgress();
      }, 8000);
    }

    document.addEventListener('click', startProgress, true);
    return () => {
      document.removeEventListener('click', startProgress, true);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    finishProgress();
    // Route completion is represented by pathname/search params changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px] overflow-hidden bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-goldDim via-gold to-[#F0D48C] shadow-[0_0_12px_rgba(212,177,94,0.75)]"
        style={{
          width: `${progress}%`,
          transition:
            progress === 100
              ? 'width 160ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease'
              : 'width 380ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          opacity: progress === 100 ? 0.92 : 1,
        }}
      />
    </div>
  );
}
