import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentsManager from '@/components/StudentsManager';
import AdminBackButton from '@/components/AdminBackButton';

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
    <section className="max-w-[1140px] mx-auto px-5 sm:px-6 py-10 sm:py-12">
      <div className="mb-5">
        <AdminBackButton />
      </div>
      <div className="eyebrow">لوحة الإدارة</div>
      <h1 className="font-cairo font-extrabold text-[27px] sm:text-[31px] mb-8">إدارة الطلاب</h1>

      <StudentsManager
        initialStudents={students ?? []}
        courses={courses ?? []}
        initialEnrollments={enrollments ?? []}
      />
    </section>
  );
}
