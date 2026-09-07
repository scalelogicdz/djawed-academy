import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import LessonsManager from '@/components/LessonsManager';
import LessonThumbnailManager from '@/components/LessonThumbnailManager';

export default async function AdminLessonsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: courses } = await supabase.from('courses').select('id, title').order('created_at');
  const { data: modules } = await supabase
    .from('modules')
    .select('id, course_id, title, description, position')
    .order('position');
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, module_id, title, description, video_id, video_provider, resource_url, thumbnail_url, position')
    .order('position');
  const { data: quizQuestions } = await supabase
    .from('quiz_questions')
    .select('id, lesson_id, question, options, correct_index, position')
    .order('position');

  return (
    <>
      <StudentNav isAdmin currentUserId={user.id} />
      <section className="max-w-[1140px] mx-auto px-6 py-14">
        <div className="eyebrow">لوحة الإدارة</div>
        <h1 className="font-cairo font-extrabold text-[26px] mb-8">إدارة الدروس</h1>

        <LessonsManager
          courses={courses ?? []}
          initialModules={modules ?? []}
          initialLessons={lessons ?? []}
          initialQuizQuestions={quizQuestions ?? []}
        />

        <LessonThumbnailManager
          lessons={(lessons ?? []).map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            thumbnail_url: lesson.thumbnail_url ?? null,
          }))}
        />
      </section>
    </>
  );
}
