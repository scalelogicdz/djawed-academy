import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hiddenModuleIds } from '@/lib/moduleVisibility';
import { buildStudentProgress } from '@/lib/studentProgress';
import type { ProgressModule, ProgressLesson, ProgressCompletion, ProgressEnrollment, ProgressCourse, StudentProgressSummary } from '@/lib/studentProgress';
import StudentsManager from '@/components/StudentsManager';
import AdminBackButton from '@/components/AdminBackButton';

export const dynamic = 'force-dynamic';

type StudentRow = { id: string; full_name: string; display_name: string; created_at: string };
type PageResult = { data: unknown[] | null; error: { code?: string; message: string } | null };
async function allRows<T>(page: (from: number, to: number) => PromiseLike<PageResult>, optionalPresence = false): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await page(from, from + 499);
    if (result.error) {
      // Heartbeat tracking was added after the original profile schema.
      if (optionalPresence && result.error.code === '42703') return [];
      throw new Error(result.error.message);
    }
    const batch = (result.data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}

export default async function AdminStudentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  // The page itself must check before using the service-role auth API;
  // parent layouts can execute concurrently with child pages.
  const { data: viewer } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!viewer?.is_admin) redirect('/dashboard');
  const adminClient = createAdminClient();

  async function authDirectory() {
    const users: { id: string; email: string; last_sign_in_at: string | null }[] = [];
    for (let page = 1; ; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 500 });
      if (error) throw new Error('Could not load student accounts');
      const batch = data?.users ?? [];
      users.push(...batch.map(account => ({
        id: account.id, email: account.email ?? '', last_sign_in_at: account.last_sign_in_at ?? null,
      })));
      if (batch.length < 500) return users;
    }
  }

  const [students, courses, enrollments, accounts] = await Promise.all([
    allRows<StudentRow>((from, to) => supabase.from('profiles')
      .select('id, full_name, display_name, created_at').eq('is_admin', false)
      .order('created_at', { ascending: false }).order('id').range(from, to)),
    allRows<ProgressCourse>((from, to) => supabase.from('courses').select('id, title').order('id').range(from, to)),
    allRows<ProgressEnrollment>((from, to) => supabase.from('enrollments')
      .select('student_id, course_id, created_at').order('id').range(from, to)),
    authDirectory(),
  ]);
  const accountById = new Map(accounts.map(account => [account.id, account]));
  const studentsWithEmail = students.map(student => ({ ...student, email: accountById.get(student.id)?.email ?? '' }));
  let progressByStudent: Record<string, StudentProgressSummary> = {};
  let progressError: string | null = null;
  try {
    const [modules, lessons, completions, hidden, presence] = await Promise.all([
      allRows<ProgressModule>((from, to) => supabase.from('modules')
        .select('id, course_id, title, position').order('id').range(from, to)),
      allRows<ProgressLesson>((from, to) => supabase.from('lessons')
        .select('id, module_id, title, position').order('id').range(from, to)),
      allRows<ProgressCompletion>((from, to) => supabase.from('lesson_progress')
        .select('student_id, lesson_id, completed_at').order('id').range(from, to)),
      hiddenModuleIds(supabase),
      allRows<{ id: string; last_seen_at: string | null }>((from, to) => supabase.from('profiles')
        .select('id, last_seen_at').eq('is_admin', false).order('id').range(from, to), true),
    ]);
    const presenceById = new Map(presence.map(profile => [profile.id, profile.last_seen_at]));
    const activityByStudent = Object.fromEntries(students.map(student => [
      student.id, [presenceById.get(student.id), accountById.get(student.id)?.last_sign_in_at],
    ]));
    progressByStudent = buildStudentProgress({
      students, courses, enrollments, modules, lessons, completions, activityByStudent,
      hiddenModuleIds: hidden, now: Date.now(),
    });
  } catch (error) {
    console.error('Student progress unavailable', error);
    progressError = 'تعذر تحميل بيانات التقدم. أعد تحديث الصفحة؛ لا يمكن تقييم المتابعة دون هذه البيانات.';
  }

  return (
    <section className="max-w-[1140px] mx-auto px-5 sm:px-6 py-10 sm:py-12">
      <div className="mb-5"><AdminBackButton /></div>
      <div className="eyebrow">لوحة الإدارة</div>
      <h1 className="font-cairo font-extrabold text-[27px] sm:text-[31px] mb-3">إدارة الطلاب ومتابعة التقدم</h1>
      <p className="text-sm text-muted leading-7 mb-8">
        تابع الدروس المكتملة وآخر نشاط مسجّل لتعرف من قد يحتاج إلى تواصلك.
      </p>
      <StudentsManager initialStudents={studentsWithEmail} courses={courses}
        initialEnrollments={enrollments} progressByStudent={progressByStudent} progressError={progressError} />
    </section>
  );
}
