'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type LessonThumbnailRow = {
  id: string;
  title: string;
  thumbnail_url: string | null;
};

export default function LessonThumbnailManager({ lessons }: { lessons: LessonThumbnailRow[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(lessons.map((lesson) => [lesson.id, lesson.thumbnail_url ?? '']))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});

  async function saveThumbnail(lessonId: string) {
    setSavingId(lessonId);
    setMessage((current) => ({ ...current, [lessonId]: '' }));

    const res = await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'lessonThumbnail',
        id: lessonId,
        thumbnailUrl: values[lessonId]?.trim() || null,
      }),
    });

    const data = await res.json();
    setSavingId(null);

    if (!res.ok) {
      setMessage((current) => ({ ...current, [lessonId]: data.error ?? 'حدث خطأ أثناء الحفظ' }));
      return;
    }

    setMessage((current) => ({ ...current, [lessonId]: 'تم الحفظ ✓' }));
    router.refresh();
  }

  return (
    <div className="card p-6 mt-8">
      <div className="mb-5">
        <h2 className="font-cairo font-bold text-[18px]">الصور المصغرة للدروس</h2>
        <p className="text-muted text-[13px] mt-1">ألصق رابط صورة لكل درس. ترك الحقل فارغًا سيُبقي الشكل الافتراضي.</p>
      </div>

      <div className="space-y-4">
        {lessons.map((lesson) => (
          <div key={lesson.id} className="border-b border-border last:border-0 pb-4 last:pb-0">
            <div className="text-sm font-semibold mb-2">{lesson.title}</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={values[lesson.id] ?? ''}
                onChange={(e) => setValues((current) => ({ ...current, [lesson.id]: e.target.value }))}
                placeholder="https://example.com/thumbnail.jpg"
                className="flex-1 bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => saveThumbnail(lesson.id)}
                disabled={savingId === lesson.id}
                className="btn-primary !py-2.5 !px-5 text-sm"
              >
                {savingId === lesson.id ? 'جارٍ الحفظ...' : 'حفظ الصورة'}
              </button>
            </div>
            {message[lesson.id] && (
              <p className={`text-[12px] mt-2 ${message[lesson.id].includes('✓') ? 'text-success' : 'text-[#E4756A]'}`}>
                {message[lesson.id]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
