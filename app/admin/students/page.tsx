import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import StudentsManager from '@/components/StudentsManager';

export default async function AdminStudentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: students } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, created_at')
    .eq('is_admin', false)
    .order('created_at', { ascending: false });

  const { data: courses } = await supabase.from('courses').select('id, title');

  const { data: enrollments } = await supabase.from('enrollments').select('student_id, course_id');

  return (
    <>
      <StudentNav isAdmin />
      <section className="max-w-[1140px] mx-auto px-6 py-14">
        <div className="eyebrow">لوحة الإدارة</div>
        <h1 className="font-cairo font-extrabold text-[26px] mb-8">إدارة الطلاب</h1>

        <StudentsManager
          initialStudents={students ?? []}
          courses={courses ?? []}
          initialEnrollments={enrollments ?? []}
        />
      </section>
    </>
  );
}
