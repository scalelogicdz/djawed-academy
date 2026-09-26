'use client';

import { useEffect, useState } from 'react';

type OnlineStudent = {
  id: string;
  name: string;
  path: string;
  lastSeenAt: string;
};

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

export default function AdminLiveUsersPanel() {
  const [online, setOnline] = useState<OnlineStudent[]>([]);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');

  useEffect(() => {
    let active = true;

    async function loadOnlineUsers() {
      try {
        const response = await fetch('/api/admin/live-users', {
          method: 'GET',
          cache: 'no-store',
        });

        if (!active) return;

        if (!response.ok) {
          setConnectionState('error');
          return;
        }

        const data = await response.json();
        setOnline(Array.isArray(data.users) ? data.users : []);
        setConnectionState('connected');
      } catch {
        if (active) setConnectionState('error');
      }
    }

    loadOnlineUsers();
    const interval = window.setInterval(loadOnlineUsers, 10_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

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
            يتحدث تلقائيًا حسب نشاط الطالب داخل المنصة.
          </p>
        </div>

        <div className="min-w-12 h-12 rounded-xl border border-success/20 bg-success/[0.07] flex items-center justify-center">
          <span className="font-mono font-bold text-[20px] text-success">{online.length}</span>
        </div>
      </div>

      {connectionState === 'error' ? (
        <div className="px-5 sm:px-6 py-6 text-sm text-[#E7A09A]">
          تعذر قراءة حالة المستخدمين المتصلين.
        </div>
      ) : online.length === 0 ? (
        <div className="px-5 sm:px-6 py-7 text-center">
          <div className="text-muted text-sm">
            {connectionState === 'connecting' ? 'جارٍ التحقق...' : 'لا يوجد طلاب متصلون الآن.'}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {online.map((student) => (
            <div key={student.id} className="flex items-center gap-3 px-5 sm:px-6 py-3.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success flex-shrink-0 shadow-[0_0_0_4px_rgba(63,203,130,0.08)]" />

              <div className="min-w-0 flex-1">
                <div className="font-cairo font-bold text-[13.5px] sm:text-sm truncate">
                  {student.name}
                </div>
                <div className="text-muted2 text-[11px] mt-0.5">{pageLabel(student.path)}</div>
              </div>

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
