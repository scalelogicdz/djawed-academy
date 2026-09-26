'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const HEARTBEAT_MS = 20_000;

export default function StudentPresence() {
  const pathname = usePathname();

  useEffect(() => {
    let stopped = false;

    async function heartbeat() {
      if (stopped || document.visibilityState === 'hidden') return;

      try {
        await fetch('/api/presence/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: pathname }),
          cache: 'no-store',
        });
      } catch {
        // Presence is non-critical; the platform remains usable.
      }
    }

    heartbeat();

    const interval = window.setInterval(heartbeat, HEARTBEAT_MS);

    function handleVisibility() {
      if (document.visibilityState === 'visible') heartbeat();
    }

    window.addEventListener('focus', heartbeat);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [pathname]);

  return null;
}
