import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LessonsManager from '@/components/LessonsManager';
import ModuleOrderManager from '@/components/ModuleOrderManager';
import LessonOrderManager from '@/components/LessonOrderManager';
import AdminBackButton from '@/components/AdminBackButton';

export default async function AdminLessonsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: courses } = await supabase.from('courses').select('id, title').order('created_at');
  const { data: modules } = await supabase
    .from('modules')
    .select('id, course_id, title, description, thumbnail_url, position')
    .order('position');
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, module_id, title, description, video_id, video_provider, resource_url, position')
    .order('position');
  const { data: quizQuestions } = await supabase
    .from('quiz_questions')
    .select('id, lesson_id, question, options, correct_index, position')
    .order('position');

  return (
    <section className="max-w-[1140px] mx-auto px-5 sm:px-6 py-10 sm:py-12">
      <div className="mb-5">
        <AdminBackButton />
      </div>
      <div className="eyebrow">لوحة الإدارة</div>
      <h1 className="font-cairo font-extrabold text-[27px] sm:text-[31px] mb-8">إدارة الدروس</h1>

      <ModuleOrderManager
        courses={courses ?? []}
        initialModules={(modules ?? []).map((module) => ({
          id: module.id,
          course_id: module.course_id,
          title: module.title,
          position: module.position,
        }))}
      />

      <LessonOrderManager
        initialModules={(modules ?? []).map((module) => ({
          id: module.id,
          course_id: module.course_id,
          title: module.title,
          position: module.position,
        }))}
        initialLessons={(lessons ?? []).map((lesson) => ({
          id: lesson.id,
          module_id: lesson.module_id,
          title: lesson.title,
          position: lesson.position,
        }))}
      />

      <LessonsManager
        courses={courses ?? []}
        initialModules={modules ?? []}
        initialLessons={lessons ?? []}
        initialQuizQuestions={quizQuestions ?? []}
      />
    </section>
  );
}
