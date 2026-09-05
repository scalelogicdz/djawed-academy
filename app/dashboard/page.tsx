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

  const { data: progressRows } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('student_id', user.id);
  const completedIds = new Set((progressRows ?? []).map((p) => p.lesson_id));

  const courseCards = await Promise.all(
    (enrollments ?? []).map(async (enr: any) => {
      const course = enr.courses;

      const { data: modules } = await supabase.from('modules').select('id').eq('course_id', course.id);
      const moduleIds = (modules ?? []).map((m) => m.id);
      const moduleCount = moduleIds.length;

      const { data: lessonsInCourse } = await supabase
        .from('lessons')
        .select('id, title, position')
        .in('module_id', moduleIds.length ? moduleIds : ['00000000-0000-0000-0000-000000000000'])
        .order('position', { ascending: true });

      const lessons = lessonsInCourse ?? [];
      const total = lessons.length;
      const completed = lessons.filter((l) => completedIds.has(l.id)).length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

      // The actual next lesson to continue into: the first one NOT yet completed, in order.
      // If everything is completed, fall back to the last lesson so the button still goes somewhere.
      const nextLesson = lessons.find((l) => !completedIds.has(l.id)) ?? lessons[lessons.length - 1] ?? null;
      const isFullyCompleted = total > 0 && completed === total;

      return { course, total, completed, pct, moduleCount, nextLesson, isFullyCompleted };
    })
  );

  // Aggregate stats across every enrolled course, shown in the top stats row
  const totalLessonsAll = courseCards.reduce((sum, c) => sum + c.total, 0);
  const completedLessonsAll = courseCards.reduce((sum, c) => sum + c.completed, 0);
  const overallPct = totalLessonsAll > 0 ? Math.round((completedLessonsAll / totalLessonsAll) * 100) : 0;

  return (
    <>
      <StudentNav isAdmin={profile?.is_admin} currentUserId={user.id} />
      <section className="max-w-[1140px] mx-auto px-6 py-14">
        <div className="mb-7">
          <div className="eyebrow">مرحبًا بعودتك</div>
          <h1 className="font-cairo font-extrabold text-[28px] mb-1.5">
            أهلاً، {profile?.display_name ?? 'بك'}
          </h1>
          <p className="text-muted mb-6">أكمل من حيث توقفت</p>

          {courseCards.length > 0 && (
            <div className="flex items-center gap-10">
              <div className="text-center sm:text-right">
                <div className="font-cairo font-extrabold text-[26px]">{totalLessonsAll}</div>
                <div className="text-muted text-[12.5px] mt-0.5">إجمالي الدروس</div>
              </div>
              <div className="text-center sm:text-right">
                <div className="font-cairo font-extrabold text-[26px]">
                  {String(completedLessonsAll).padStart(2, '0')}
                </div>
                <div className="text-muted text-[12.5px] mt-0.5">دروس مكتملة</div>
              </div>
              <div className="text-center sm:text-right">
                <div className="font-cairo font-extrabold text-[26px] text-gold">{overallPct}%</div>
                <div className="text-muted text-[12.5px] mt-0.5">التقدم</div>
              </div>
            </div>
          )}
        </div>

        {courseCards.length === 0 && (
          <div className="card p-8 text-muted text-sm">
            لا يوجد لديك وصول لأي دورة حاليًا. تواصل مع الدعم إذا كنت قد أتممت الدفع.
          </div>
        )}

        {courseCards.map(({ course, pct, total, completed, moduleCount, nextLesson, isFullyCompleted }) => (
          <div key={course.id} className="card p-7 mb-5">
            <div className="inline-block px-6 py-3.5 rounded-xl border border-goldDim text-center mb-6">
              <span className="font-cairo font-bold text-gold text-[14.5px]">دورة السبونسور</span>
            </div>

            <h3 className="text-[20px] font-bold mb-2 leading-snug">{course.title}</h3>
            <p className="text-muted text-[13.5px] mb-4">
              {total} درس · {moduleCount} وحدات
            </p>

            <div className="h-[5px] bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-goldDim to-gold rounded-full"
                style={{ width: `${pct}%`, transition: 'width 0.6s ease' }}
              />
            </div>
            <div className="text-[12.5px] text-muted mt-2 mb-1">{pct}% مكتمل</div>

            {!isFullyCompleted && nextLesson && (
              <p className="text-[13px] text-muted mb-5">
                الدرس القادم: <span className="text-text font-semibold">{nextLesson.title}</span>
              </p>
            )}
            {isFullyCompleted && (
              <p className="text-[13px] text-gold font-semibold mb-5">🎉 أكملت هذه الدورة بالكامل</p>
            )}

            <Link
              href={nextLesson ? `/lesson/${nextLesson.id}` : '#'}
              className="btn-primary block text-center w-full"
            >
              {isFullyCompleted ? 'مراجعة الدورة' : 'متابعة التعلم'}
            </Link>
          </div>
        ))}
      </section>
    </>
  );
}
