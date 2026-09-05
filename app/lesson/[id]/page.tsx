import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import LessonBody from '@/components/LessonBody';
import { computeLockedLessonIds, findRequiredLesson } from '@/lib/lessonLocking';

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, title, description, video_id, video_provider, resource_url, module_id, position')
    .eq('id', id)
    .single();

  if (!lesson) notFound(); // RLS also blocks this server-side if the student isn't enrolled

  const { data: currentModule } = await supabase
    .from('modules')
    .select('id, title, description, course_id')
    .eq('id', lesson.module_id)
    .single();

  const { data: allModules } = await supabase
    .from('modules')
    .select('id, title, description, position')
    .eq('course_id', currentModule?.course_id)
    .order('position', { ascending: true });

  const { data: allLessons } = await supabase
    .from('lessons')
    .select('id, title, module_id, position')
    .in('module_id', (allModules ?? []).map((m) => m.id))
    .order('position', { ascending: true });

  const { data: progressRows } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('student_id', user.id);
  const completedIds = new Set((progressRows ?? []).map((p) => p.lesson_id));

  const { data: quizQuestions } = await supabase
    .from('quiz_questions')
    .select('id, question, options, correct_index, position')
    .eq('lesson_id', lesson.id)
    .order('position', { ascending: true });

  const flatOrder = allLessons ?? [];
  const currentIndex = flatOrder.findIndex((l) => l.id === lesson.id);
  const prevLesson = currentIndex > 0 ? flatOrder[currentIndex - 1] : null;
  const nextLesson = currentIndex < flatOrder.length - 1 ? flatOrder[currentIndex + 1] : null;

  // Sequential per-module locking: a lesson stays locked until every earlier
  // lesson in the SAME module is completed. Modules never block each other.
  const lockedIds = computeLockedLessonIds(flatOrder, completedIds);
  const isCurrentLocked = lockedIds.has(lesson.id);
  const requiredLesson = isCurrentLocked ? findRequiredLesson(lesson.id, flatOrder, completedIds) : null;

  return (
    <>
      <StudentNav isAdmin={profile?.is_admin} currentUserId={user.id} />
      <section className="max-w-[1140px] mx-auto px-6 py-14">
        <div className="eyebrow">{currentModule?.title}</div>
        <h1 className="font-cairo font-extrabold text-[23px] mb-6">{lesson.title}</h1>

        <LessonBody
          key={lesson.id}
          lesson={lesson}
          modules={allModules ?? []}
          lessons={flatOrder}
          completedIds={Array.from(completedIds)}
          lockedIds={Array.from(lockedIds)}
          prevLessonId={prevLesson?.id ?? null}
          nextLessonId={nextLesson?.id ?? null}
          isCompleted={completedIds.has(lesson.id)}
          isLocked={isCurrentLocked}
          requiredLessonTitle={requiredLesson?.title ?? null}
          requiredLessonId={requiredLesson?.id ?? null}
          quizQuestions={quizQuestions ?? []}
        />
      </section>
    </>
  );
}
