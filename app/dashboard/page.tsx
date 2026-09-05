import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, is_admin')
    .eq('id', user.id)
    .single();

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('course_id, courses(id, title, description)')
    .eq('student_id', user.id);

  // For each enrolled course, compute progress
  const courseCards = await Promise.all(
    (enrollments ?? []).map(async (enr: any) => {
      const course = enr.courses;
      const { data: modules } = await supabase.from('modules').select('id').eq('course_id', course.id);
      const moduleIds = (modules ?? []).map((m) => m.id);

      const { count: totalLessons } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .in('module_id', moduleIds.length ? moduleIds : ['00000000-0000-0000-0000-000000000000']);

      const { data: lessonsInCourse } = await supabase
        .from('lessons')
        .select('id')
        .in('module_id', moduleIds.length ? moduleIds : ['00000000-0000-0000-0000-000000000000']);
      const lessonIds = (lessonsInCourse ?? []).map((l) => l.id);

      const { count: completedCount } = await supabase
        .from('lesson_progress')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', user.id)
        .in('lesson_id', lessonIds.length ? lessonIds : ['00000000-0000-0000-0000-000000000000']);

      const total = totalLessons ?? 0;
      const completed = completedCount ?? 0;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

      // find the first not-completed lesson to "continue" into, else the first lesson
      const { data: firstLesson } = await supabase
        .from('lessons')
        .select('id')
        .in('module_id', moduleIds.length ? moduleIds : ['00000000-0000-0000-0000-000000000000'])
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle();

      return { course, total, completed, pct, continueLessonId: firstLesson?.id };
    })
  );

  return (
    <>
      <StudentNav isAdmin={profile?.is_admin} currentUserId={user.id} />
      <section className="max-w-[1140px] mx-auto px-6 py-14">
        <div className="mb-9">
          <div className="eyebrow">مرحبًا بعودتك</div>
          <h1 className="font-cairo font-extrabold text-[28px] mb-1.5">
            أهلاً، {profile?.display_name ?? 'بك'}
          </h1>
          <p className="text-muted">أكمل من حيث توقفت</p>
        </div>

        {courseCards.length === 0 && (
          <div className="card p-8 text-muted text-sm">
            لا يوجد لديك وصول لأي دورة حاليًا. تواصل مع الدعم إذا كنت قد أتممت الدفع.
          </div>
        )}

        {courseCards.map(({ course, pct, total, completed, continueLessonId }) => (
          <div
            key={course.id}
            className="flex gap-6 items-center card p-7 mb-5 hover:border-goldDim transition"
          >
            <div className="w-[140px] h-[94px] rounded-xl flex-shrink-0 flex items-center justify-center font-cairo font-bold text-gold text-[12.5px] text-center p-2 border border-goldDim bg-gradient-to-br from-[rgba(212,177,94,0.1)] to-[#070A10]">
              {course.title}
            </div>
            <div className="flex-1">
              <h3 className="text-[19px] font-bold mb-1.5">{course.title}</h3>
              <p className="text-muted text-[13px]">
                {total} درس · {completed} مكتمل
              </p>
              <div className="h-[5px] bg-border rounded-full mt-3.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-goldDim to-gold rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[12.5px] text-muted mt-2">{pct}% مكتمل</div>
            </div>
            <Link
              href={continueLessonId ? `/lesson/${continueLessonId}` : '#'}
              className="btn-primary whitespace-nowrap"
            >
              متابعة التعلم
            </Link>
          </div>
        ))}
      </section>
    </>
  );
}
