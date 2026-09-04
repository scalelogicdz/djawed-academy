'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  video_id: string | null;
  video_provider: string | null;
  resource_url: string | null;
  module_id: string;
};
type ModuleRow = { id: string; title: string; position: number };
type LessonListItem = { id: string; title: string; module_id: string; position: number };

export default function LessonBody({
  lesson,
  modules,
  lessons,
  completedIds,
  prevLessonId,
  nextLessonId,
  isCompleted,
}: {
  lesson: Lesson;
  modules: ModuleRow[];
  lessons: LessonListItem[];
  completedIds: string[];
  prevLessonId: string | null;
  nextLessonId: string | null;
  isCompleted: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [completed, setCompleted] = useState(isCompleted);
  const [saving, setSaving] = useState(false);
  const completedSet = new Set(completedIds);

  async function toggleComplete() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (completed) {
      await supabase.from('lesson_progress').delete().eq('lesson_id', lesson.id).eq('student_id', user.id);
      setCompleted(false);
    } else {
      await supabase.from('lesson_progress').insert({ lesson_id: lesson.id, student_id: user.id });
      setCompleted(true);
    }
    setSaving(false);
    router.refresh();
  }

  const BUNNY_LIBRARY_ID = '744754';

  const embedUrl =
    lesson.video_provider === 'vimeo'
      ? `https://player.vimeo.com/video/${lesson.video_id}`
      : `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${lesson.video_id}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div>
        <div className="aspect-video rounded-2xl border border-border overflow-hidden mb-5 bg-gradient-to-br from-surface2 to-[#070A10]">
          {lesson.video_id ? (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-sm">
              لم يتم إضافة الفيديو بعد
            </div>
          )}
        </div>

        {lesson.description && (
          <p className="text-muted text-[14.5px] mb-5 leading-relaxed">{lesson.description}</p>
        )}

        {lesson.resource_url && (
          <a href={lesson.resource_url} target="_blank" rel="noreferrer" className="btn-ghost inline-block mb-5">
            📎 تحميل الملف المرفق
          </a>
        )}

        <div className="flex flex-col sm:flex-row justify-between gap-2.5 mt-5">
          {prevLessonId ? (
            <Link href={`/lesson/${prevLessonId}`} className="btn-ghost text-center">
              → الدرس السابق
            </Link>
          ) : (
            <span />
          )}
          <button onClick={toggleComplete} disabled={saving} className="btn-primary">
            {completed ? '✓ مكتمل' : 'تحديد كمكتمل'}
          </button>
          {nextLessonId ? (
            <Link href={`/lesson/${nextLessonId}`} className="btn-ghost text-center">
              الدرس التالي ←
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>

      <div>
        {modules.map((m) => (
          <div key={m.id}>
            <div className="font-cairo font-bold text-[12.5px] text-gold mt-5 mb-2.5 uppercase tracking-wide first:mt-0">
              {m.title}
            </div>
            {lessons
              .filter((l) => l.module_id === m.id)
              .map((l) => {
                const done = completedSet.has(l.id);
                const active = l.id === lesson.id;
                return (
                  <Link
                    key={l.id}
                    href={`/lesson/${l.id}`}
                    className={`flex items-center gap-2.5 px-3.5 py-3 rounded-lg text-sm mb-0.5 border transition ${
                      active
                        ? 'bg-surface2 border-goldDim'
                        : 'border-transparent hover:bg-white/[0.02]'
                    } ${done && !active ? 'text-muted' : ''}`}
                  >
                    <span
                      className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${
                        active ? 'bg-gold shadow-[0_0_10px_rgba(212,177,94,0.6)]' : done ? 'bg-success' : 'bg-[#2A3444]'
                      }`}
                    />
                    {l.title}
                  </Link>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
