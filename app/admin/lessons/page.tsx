import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import LessonsManager from '@/components/LessonsManager';

export default async function AdminLessonsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: courses } = await supabase.from('courses').select('id, title').order('created_at');
  const { data: modules } = await supabase.from('modules').select('id, course_id, title, position').order('position');
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, module_id, title, description, video_id, video_provider, resource_url, position')
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
        />
      </section>
    </>
  );
}
