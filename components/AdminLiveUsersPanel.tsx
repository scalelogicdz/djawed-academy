'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type StudentDirectoryItem = {
  presenceKey: string;
  name: string;
};

type OnlineStudent = StudentDirectoryItem & {
  page: string;
  seenAt: number;
  connections: number;
};

const PRESENCE_TOPIC = 'academy:student-presence';

function pageLabel(path: string) {
  if (path.startsWith('/lesson/')) return 'داخل درس';
  if (path.startsWith('/course-content')) return 'محتوى الدورة';
  if (path.startsWith('/community')) return 'المجتمع';
  if (path.startsWith('/services')) return 'الخدمات';
  if (path.startsWith('/support')) return 'الدعم';
  if (path.startsWith('/guidelines')) return 'القواعد والإرشادات';
  if (path.startsWith('/profile')) return 'الملف الشخصي';
  if (path.startsWith('/dashboard')) return 'دوراتي';
  return 'داخل المنصة';
}

export default function AdminLiveUsersPanel({ students }: { students: StudentDirectoryItem[] }) {
  const [online, setOnline] = useState<OnlineStudent[]>([]);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  if (!supabaseRef.current) supabaseRef.current = createClient();

  const directory = useMemo(
    () => new Map(students.map((student) => [student.presenceKey, student])),
    [students]
  );

  useEffect(() => {
    const supabase = supabaseRef.current;
    if (!supabase) return;

    const channel = supabase.channel(PRESENCE_TOPIC, {
      config: { private: true },
    });

    function syncPresence() {
      const state = channel.presenceState() as Record<
        string,
        Array<{ page?: unknown; seen_at?: unknown; phx_ref?: string }>
      >;

      const next: OnlineStudent[] = [];

      for (const [presenceKey, metas] of Object.entries(state)) {
        const student = directory.get(presenceKey);
        if (!student || !Array.isArray(metas) || metas.length === 0) continue;

        const safeMetas = metas.map((meta) => ({
          page: typeof meta.page === 'string' ? meta.page : '/dashboard',
          seenAt: typeof meta.seen_at === 'number' ? meta.seen_at : 0,
        }));

        const latest = safeMetas.reduce((best, item) =>
          item.seenAt > best.seenAt ? item : best
        );

        next.push({
          ...student,
          page: latest.page,
          seenAt: latest.seenAt,
          connections: metas.length,
        });
      }

      next.sort((a, b) => b.seenAt - a.seenAt || a.name.localeCompare(b.name, 'ar'));
      setOnline(next);
    }

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionState('connected');
          syncPresence();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionState('error');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [directory]);

  return (
    <section className="card overflow-hidden mb-9">
      <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-white/[0.07]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2.5 w-2.5">
              {connectionState === 'connected' && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-success/40 animate-ping" />
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  connectionState === 'connected'
                    ? 'bg-success'
                    : connectionState === 'error'
                      ? 'bg-[#E4756A]'
                      : 'bg-gold'
                }`}
              />
            </span>
            <h2 className="font-cairo font-extrabold text-[17px] sm:text-[18px]">
              المستخدمون المتصلون الآن
            </h2>
          </div>
          <p className="text-muted2 text-[11.5px] sm:text-xs">
            يتحدث تلقائيًا عند دخول أو خروج الطالب من المنصة.
          </p>
        </div>

        <div className="min-w-12 h-12 rounded-xl border border-success/20 bg-success/[0.07] flex items-center justify-center">
          <span className="font-mono font-bold text-[20px] text-success">{online.length}</span>
        </div>
      </div>

      {connectionState === 'error' ? (
        <div className="px-5 sm:px-6 py-6 text-sm text-[#E7A09A]">
          تعذر الاتصال بخدمة الحضور المباشر. تحقق من إعدادات Supabase Realtime.
        </div>
      ) : online.length === 0 ? (
        <div className="px-5 sm:px-6 py-7 text-center">
          <div className="text-muted text-sm">
            {connectionState === 'connecting' ? 'جارٍ الاتصال...' : 'لا يوجد طلاب متصلون الآن.'}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {online.map((student) => (
            <div key={student.presenceKey} className="flex items-center gap-3 px-5 sm:px-6 py-3.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success flex-shrink-0 shadow-[0_0_0_4px_rgba(63,203,130,0.08)]" />

              <div className="min-w-0 flex-1">
                <div className="font-cairo font-bold text-[13.5px] sm:text-sm truncate">
                  {student.name}
                </div>
                <div className="text-muted2 text-[11px] mt-0.5">{pageLabel(student.page)}</div>
              </div>

              {student.connections > 1 && (
                <span
                  className="text-[10px] text-muted2 border border-white/[0.07] rounded-full px-2 py-1"
                  title="الطالب فاتح المنصة في أكثر من تبويب أو جهاز"
                >
                  {student.connections} اتصالات
                </span>
              )}

              <span className="text-[10.5px] font-semibold text-success whitespace-nowrap">
                مباشر
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
