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

  const moduleIndex = (allModules ?? []).findIndex((module) => module.id === currentModule?.id);
  const moduleLessons = flatOrder.filter((item) => item.module_id === lesson.module_id);
  const lessonIndexInModule = moduleLessons.findIndex((item) => item.id === lesson.id);

  return (
    <section className="max-w-[1020px] mx-auto px-4 sm:px-6 py-5 sm:py-9">
      <div className="mb-5 sm:mb-7 rounded-[20px] border border-white/[0.07] bg-white/[0.018] px-4 sm:px-5 py-4 sm:py-5 shadow-[0_14px_34px_-28px_rgba(0,0,0,0.9)]">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2.5 text-[11.5px] sm:text-[12px] font-cairo">
              {currentModule?.title && (
                <span className="inline-flex items-center rounded-full border border-gold/20 bg-gold/[0.055] px-3 py-1.5 text-gold font-semibold">
                  {moduleIndex >= 0 ? `الوحدة ${moduleIndex + 1}` : 'الوحدة'} · {currentModule.title}
                </span>
              )}
              {lessonIndexInModule >= 0 && (
                <span className="text-muted2">
                  الدرس {lessonIndexInModule + 1} من {moduleLessons.length}
                </span>
              )}
            </div>

            <h1 className="font-cairo font-extrabold text-[22px] sm:text-[29px] leading-[1.45] text-text">
              {lesson.title}
            </h1>
          </div>

          <Link
            href={`/course-content?lesson=${lesson.id}`}
            aria-label="العودة إلى محتوى الدورة"
            title="العودة إلى محتوى الدورة"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-white/[0.09] bg-white/[0.025] flex items-center justify-center text-[23px] leading-none text-muted hover:border-gold/40 hover:text-gold hover:bg-gold/[0.04] transition flex-shrink-0"
          >
            ×
          </Link>
        </div>
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
