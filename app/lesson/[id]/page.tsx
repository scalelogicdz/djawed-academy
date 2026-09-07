import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LessonBody from '@/components/LessonBody';
import { computeLockedLessonIds, findRequiredLesson } from '@/lib/lessonLocking';

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, title, video_id, video_provider, module_id, position')
    .eq('id', id)
    .single();

  if (!lesson) notFound();

  const { data: currentModule } = await supabase
    .from('modules')
    .select('id, title, course_id, thumbnail_url')
    .eq('id', lesson.module_id)
    .single();

  const { data: allModules } = await supabase
    .from('modules')
    .select('id, title, position')
    .eq('course_id', currentModule?.course_id)
    .order('position', { ascending: true });

  const moduleIds = (allModules ?? []).map((module) => module.id);
  const { data: allLessons } = await supabase
    .from('lessons')
    .select('id, title, module_id, position')
    .in('module_id', moduleIds.length ? moduleIds : ['00000000-0000-0000-0000-000000000000'])
    .order('position', { ascending: true });

  const { data: progressRows } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('student_id', user.id);
  const completedIds = new Set((progressRows ?? []).map((row) => row.lesson_id));

  const flatOrder = allLessons ?? [];
  const currentIndex = flatOrder.findIndex((item) => item.id === lesson.id);
  const prevLesson = currentIndex > 0 ? flatOrder[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < flatOrder.length - 1 ? flatOrder[currentIndex + 1] : null;

  const lockedIds = computeLockedLessonIds(flatOrder, completedIds);
  const isCurrentLocked = lockedIds.has(lesson.id);
  const requiredLesson = isCurrentLocked ? findRequiredLesson(lesson.id, flatOrder, completedIds) : null;

  return (
    <section className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 sm:py-10">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1 min-w-0">
          {currentModule?.title && <div className="eyebrow mb-2">{currentModule.title}</div>}
          <h1 className="font-cairo font-extrabold text-[23px] sm:text-[28px] leading-snug">{lesson.title}</h1>
        </div>

        <Link
          href={`/course-content?lesson=${lesson.id}`}
          aria-label="العودة إلى محتوى الدورة"
          className="w-11 h-11 rounded-xl border border-border bg-surface flex items-center justify-center text-[25px] leading-none hover:border-gold/50 hover:text-gold transition flex-shrink-0"
        >
          ×
        </Link>
      </div>

      <LessonBody
        key={lesson.id}
        lesson={lesson}
        thumbnailUrl={currentModule?.thumbnail_url ?? null}
        prevLessonId={prevLesson?.id ?? null}
        nextLessonId={nextLesson?.id ?? null}
        isCompleted={completedIds.has(lesson.id)}
        isLocked={isCurrentLocked}
        requiredLessonTitle={requiredLesson?.title ?? null}
        requiredLessonId={requiredLesson?.id ?? null}
      />
    </section>
  );
}
