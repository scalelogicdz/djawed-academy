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
      // If everything is completed, fall back to the last lesson (so the button still goes somewhere sensible).
      const nextLesson = lessons.find((l) => !completedIds.has(l.id)) ?? lessons[lessons.length - 1] ?? null;
      const isFullyCompleted = total > 0 && completed === total;

      return { course, total, completed, pct, nextLesson, isFullyCompleted };
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

        {courseCards.map(({ course, pct, total, completed, nextLesson, isFullyCompleted }) => {
          const radius = 34;
          const circumference = 2 * Math.PI * radius;
          const dashOffset = circumference * (1 - pct / 100);

          return (
            <div
              key={course.id}
              className="card p-7 mb-5 hover:border-goldDim transition"
            >
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                {/* Circular progress graph */}
                <div className="relative w-[92px] h-[92px] flex-shrink-0">
                  <svg width="92" height="92" viewBox="0 0 92 92">
                    <circle cx="46" cy="46" r={radius} fill="none" stroke="#1c2534" strokeWidth="7" />
                    <circle
                      cx="46"
                      cy="46"
                      r={radius}
                      fill="none"
                      stroke="url(#progressGradient)"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 46 46)"
                      style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                    />
                    <defs>
                      <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#d4b15e" />
                        <stop offset="100%" stopColor="#c9a84c" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-cairo font-extrabold text-[17px]">
                    {pct}%
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-right w-full">
                  <h3 className="text-[19px] font-bold mb-1.5">{course.title}</h3>
                  <p className="text-muted text-[13px] mb-3">
                    {total} درس · {completed} مكتمل
                  </p>

                  {isFullyCompleted ? (
                    <div className="inline-flex items-center gap-1.5 text-[13px] text-gold font-semibold">
                      🎉 أكملت هذه الدورة بالكامل
                    </div>
                  ) : nextLesson ? (
                    <div className="text-[13px] text-muted">
                      الدرس القادم:{' '}
                      <span className="text-text font-semibold">{nextLesson.title}</span>
                    </div>
                  ) : null}
                </div>

                <Link
                  href={nextLesson ? `/lesson/${nextLesson.id}` : '#'}
                  className="btn-primary whitespace-nowrap w-full sm:w-auto text-center"
                >
                  {isFullyCompleted ? 'مراجعة الدورة' : 'متابعة التعلم'}
                </Link>
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
