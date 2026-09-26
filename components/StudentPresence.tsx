'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

const PRESENCE_TOPIC = 'academy:student-presence';

export default function StudentPresence() {
  const pathname = usePathname();
  const [presenceKey, setPresenceKey] = useState<string | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);

  if (!supabaseRef.current) supabaseRef.current = createClient();

  useEffect(() => {
    let cancelled = false;

    async function loadPresenceKey() {
      try {
        const response = await fetch('/api/presence/key', {
          method: 'GET',
          cache: 'no-store',
        });

        if (!response.ok) return;
        const data = await response.json();

        if (!cancelled && typeof data.presenceKey === 'string') {
          setPresenceKey(data.presenceKey);
        }
      } catch {
        // Presence is non-critical; the rest of the platform keeps working.
      }
    }

    loadPresenceKey();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!presenceKey || !supabaseRef.current) return;

    const supabase = supabaseRef.current;
    const channel = supabase.channel(PRESENCE_TOPIC, {
      config: {
        private: true,
        presence: { key: presenceKey },
      },
    });

    channelRef.current = channel;

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;

      subscribedRef.current = true;
      try {
        await channel.track({
          page: pathname,
          seen_at: Date.now(),
        });
      } catch {
        // Presence is non-critical; the rest of the platform keeps working.
      }
    });

    return () => {
      subscribedRef.current = false;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [presenceKey]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) return;

    channel.track({
      page: pathname,
      seen_at: Date.now(),
    }).catch(() => {
      // Non-critical analytics only.
    });
  }, [pathname]);

  return null;
}
