'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type NotificationRow = {
  id: string;
  type: 'new_question' | 'new_reply';
  question_id: string;
  is_read: boolean;
  created_at: string;
  actor_id: string | null;
  actor_display_name?: string | null;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

export default function NotificationBell({ currentUserId }: { currentUserId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    let active = true;

    async function loadInitial() {
      const { data } = await supabase
        .from('notifications')
        .select('id, type, question_id, is_read, created_at, actor_id, profiles!notifications_actor_id_fkey(display_name)')
        .eq('recipient_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!active || !data) return;
      setNotifications(
        (data as any[]).map((n) => ({
          ...n,
          actor_display_name: Array.isArray(n.profiles) ? n.profiles[0]?.display_name : n.profiles?.display_name,
        }))
      );
    }
    loadInitial();

    const channel = supabase
      .channel('notifications-' + currentUserId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${currentUserId}` },
        async (payload) => {
          const row = payload.new as NotificationRow;
          let actorName: string | null = null;
          if (row.actor_id) {
            const { data: actorProfile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('id', row.actor_id)
              .single();
            actorName = actorProfile?.display_name ?? null;
          }
          setNotifications((prev) => [{ ...row, actor_display_name: actorName }, ...prev]);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleClickNotification(n: NotificationRow) {
    setOpen(false);
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    }
    router.push(`/community?q=${n.question_id}`);
  }

  function messageFor(n: NotificationRow) {
    const name = n.actor_display_name ?? 'شخص ما';
    if (n.type === 'new_question') return `${name} طرح سؤالًا جديدًا`;
    return `${name} ردّ على سؤالك`;
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-muted hover:text-text transition"
        aria-label="الإشعارات"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 left-0 min-w-[16px] h-4 px-1 rounded-full bg-gold text-[#0A0F1A] text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-3.5rem)] max-h-96 overflow-y-auto bg-surface2 border border-border rounded-xl shadow-2xl z-50">
          {notifications.length === 0 ? (
            <div className="p-5 text-center text-muted text-sm">لا توجد إشعارات بعد</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClickNotification(n)}
                className={`w-full text-right px-4 py-3 border-b border-border last:border-b-0 hover:bg-white/[0.03] transition ${
                  !n.is_read ? 'bg-gold/[0.06]' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-gold mt-1.5 flex-shrink-0" />}
                  <div className="flex-1">
                    <p className="text-[13.5px] leading-snug">{messageFor(n)}</p>
                    <span className="text-[11.5px] text-muted2">{timeAgo(n.created_at)}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
