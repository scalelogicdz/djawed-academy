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

type PanelPosition = {
  top: number;
  left: number;
  width: number;
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
  const [renderDropdown, setRenderDropdown] = useState(false);
  const [animatedOpen, setAnimatedOpen] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({ top: 68, left: 16, width: 320 });
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

  function updatePanelPosition() {
    const trigger = wrapRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const safeMargin = 16;
    const width = Math.min(320, window.innerWidth - safeMargin * 2);
    const preferredLeft = rect.left;
    const maxLeft = window.innerWidth - width - safeMargin;
    const left = Math.max(safeMargin, Math.min(preferredLeft, maxLeft));

    setPanelPosition({
      top: rect.bottom + 8,
      left,
      width,
    });
  }

  useEffect(() => {
    if (open) {
      updatePanelPosition();
      setRenderDropdown(true);
      setAnimatedOpen(false);

      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setAnimatedOpen(true));
      });

      return () => window.cancelAnimationFrame(frame);
    }

    setAnimatedOpen(false);
    const timeout = window.setTimeout(() => setRenderDropdown(false), 220);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleViewportChange() {
      updatePanelPosition();
    }
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open]);

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

  async function handleMarkAllRead() {
    if (unreadCount === 0 || markingAllRead) return;

    setMarkingAllRead(true);
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', currentUserId)
      .eq('is_read', false);

    if (error) setNotifications(previous);
    setMarkingAllRead(false);
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
        className={`relative p-2 rounded-lg transition duration-200 ${open ? 'text-gold bg-gold/[0.07]' : 'text-muted hover:text-text hover:bg-white/[0.025]'}`}
        aria-label="الإشعارات"
        aria-expanded={open}
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

      {renderDropdown && (
        <div
          style={{ top: panelPosition.top, left: panelPosition.left, width: panelPosition.width }}
          className={`fixed max-h-[min(24rem,calc(100vh-5.5rem))] overflow-y-auto overflow-x-hidden bg-surface2 border border-border rounded-2xl shadow-[0_22px_55px_-18px_rgba(0,0,0,0.72)] z-[80] origin-top-left transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            animatedOpen
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
              : 'opacity-0 -translate-y-2 scale-[0.975] pointer-events-none'
          }`}
        >
          {notifications.length > 0 && (
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-surface2/95 backdrop-blur-md border-b border-border">
              <span className="font-cairo font-bold text-sm">الإشعارات</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAllRead}
                  className="text-[12px] font-cairo text-gold hover:text-text transition disabled:opacity-50"
                >
                  {markingAllRead ? 'جارٍ التحديد...' : 'تحديد الكل كمقروء'}
                </button>
              )}
            </div>
          )}

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
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] leading-snug break-words">{messageFor(n)}</p>
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
