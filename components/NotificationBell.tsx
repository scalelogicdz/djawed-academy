'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/LanguageProvider';
import type { Language } from '@/lib/i18n';

type NotificationRow = {
  id: string;
  type: 'new_question' | 'new_reply' | 'admin_post' | 'admin_reply';
  source?: 'legacy' | 'community';
  reply_id?: string | null;
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

function timeAgo(iso: string, language: Language) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (language === 'fr') {
    if (mins < 1) return 'À l’instant';
    if (mins < 60) return `Il y a ${mins} min`;
    if (hrs < 24) return `Il y a ${hrs} h`;
    return `Il y a ${days} j`;
  }

  if (language === 'en') {
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    if (hrs < 24) return `${hrs} hr ago`;
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${days} يوم`;
}

export default function NotificationBell({ currentUserId }: { currentUserId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const { language } = useLanguage();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [renderDropdown, setRenderDropdown] = useState(false);
  const [animatedOpen, setAnimatedOpen] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({ top: 68, left: 16, width: 320 });
  const wrapRef = useRef<HTMLDivElement>(null);

  const copy = language === 'fr'
    ? {
        notifications: 'Notifications',
        marking: 'Mise à jour...',
        markAll: 'Tout marquer comme lu',
        empty: 'Aucune notification pour le moment',
        someone: 'Quelqu’un',
        newQuestion: (name: string) => `${name} a posé une nouvelle question`,
        newReply: (name: string) => `${name} a répondu à votre question`,
      }
    : language === 'en'
      ? {
          notifications: 'Notifications',
          marking: 'Updating...',
          markAll: 'Mark all as read',
          empty: 'No notifications yet',
          someone: 'Someone',
          newQuestion: (name: string) => `${name} posted a new question`,
          newReply: (name: string) => `${name} replied to your question`,
        }
      : {
          notifications: 'الإشعارات',
          marking: 'جارٍ التحديد...',
          markAll: 'تحديد الكل كمقروء',
          empty: 'لا توجد إشعارات بعد',
          someone: 'شخص ما',
          newQuestion: (name: string) => `${name} طرح سؤالًا جديدًا`,
          newReply: (name: string) => `${name} ردّ على سؤالك`,
        };

  const unreadCount = totalUnread;

  useEffect(() => {
    let active = true;

    let loading = false;
    async function loadInitial() {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch('/api/notifications', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (active) { setNotifications(data.notifications); setTotalUnread(data.unreadCount); }
          return;
        }
        if ((await response.json()).error !== 'migration_required') return;
        // Keep the existing bell usable until the database migration is applied.
        const { data } = await supabase.from('notifications')
          .select('id, type, question_id, is_read, created_at, actor_id, profiles!notifications_actor_id_fkey(display_name)')
          .eq('recipient_id', currentUserId).order('created_at', { ascending: false }).limit(30);
        if (active && data) {
          setNotifications((data as any[]).map(n => ({ ...n, source: 'legacy', actor_display_name: Array.isArray(n.profiles) ? n.profiles[0]?.display_name : n.profiles?.display_name })));
          setTotalUnread(data.filter(n => !n.is_read).length);
        }
      } catch { /* Retain the last successful inbox during network interruptions. */ }
      finally { loading = false; }
    }
    loadInitial();
    function refresh() { if (document.visibilityState === 'visible') void loadInitial(); }
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    const channel = supabase
      .channel('notifications-' + currentUserId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${currentUserId}` },
        () => { void loadInitial(); }
      )
      .subscribe();

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
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

  async function markRead(body: { id?: string; source?: string; all?: boolean }) {
    try {
      const response = await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (response.ok) return true;
      if (body.source === 'community' || (await response.json()).error !== 'migration_required') return false;
      let query = supabase.from('notifications').update({ is_read: true }).eq('recipient_id', currentUserId);
      if (body.id) query = query.eq('id', body.id);
      const { error } = await query;
      return !error;
    } catch { return false; }
  }
  async function handleClickNotification(n: NotificationRow) {
    setOpen(false);
    if (!n.is_read && await markRead({ id: n.id, source: n.source ?? 'legacy' })) {
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      setTotalUnread(prev => Math.max(0, prev - 1));
    }
    router.push(`/community?q=${n.question_id}${n.reply_id ? `#reply-${n.reply_id}` : ''}`);
  }
  async function handleMarkAllRead() {
    if (unreadCount === 0 || markingAllRead) return;
    setMarkingAllRead(true);
    if (await markRead({ all: true })) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setTotalUnread(0);
    }
    setMarkingAllRead(false);
  }

  function messageFor(n: NotificationRow) {
    const name = n.actor_display_name ?? copy.someone;
    if (n.type === 'admin_post') return language === 'ar' ? 'نشر جواد منشورًا جديدًا في المجتمع.' : language === 'fr' ? 'Djawed a publié dans la communauté.' : 'Djawed published a new community post.';
    if (n.type === 'admin_reply') return language === 'ar' ? 'ردّ جواد على تعليقك في المجتمع.' : language === 'fr' ? 'Djawed vous a répondu dans la communauté.' : 'Djawed replied to you in the community.';
    if (n.type === 'new_question') return copy.newQuestion(name);
    return copy.newReply(name);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative p-2 rounded-lg transition duration-200 ${open ? 'text-gold bg-gold/[0.07]' : 'text-muted hover:text-text hover:bg-white/[0.025]'}`}
        aria-label={copy.notifications}
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
              <span className="font-cairo font-bold text-sm">{copy.notifications}</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAllRead}
                  className="text-[12px] font-cairo text-gold hover:text-text transition disabled:opacity-50"
                >
                  {markingAllRead ? copy.marking : copy.markAll}
                </button>
              )}
            </div>
          )}

          {notifications.length === 0 ? (
            <div className="p-5 text-center text-muted text-sm">{copy.empty}</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClickNotification(n)}
                className={`w-full text-start px-4 py-3 border-b border-border last:border-b-0 hover:bg-white/[0.03] transition ${
                  !n.is_read ? 'bg-gold/[0.06]' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-gold mt-1.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] leading-snug break-words">{messageFor(n)}</p>
                    <span className="text-[11.5px] text-muted2">{timeAgo(n.created_at, language)}</span>
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
