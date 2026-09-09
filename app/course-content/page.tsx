import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import StudentNav from '@/components/StudentNav';
import { computeLockedLessonIds } from '@/lib/lessonLocking';
import CourseAccordion from '@/components/CourseAccordion';

export default async function CourseContentPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { lesson: requestedLessonId } = await searchParams;
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

  const enrollment: any = (enrollments ?? [])[0];
  if (!enrollment) {
    return (
      <>
        <StudentNav isAdmin={profile?.is_admin} currentUserId={user.id} />
        <section className="max-w-[900px] mx-auto px-5 sm:px-6 py-10 sm:py-14">
          <div className="card p-8 text-muted text-sm">لا يوجد لديك وصول لأي دورة حاليًا.</div>
        </section>
      </>
    );
  }

  const course = enrollment.courses;
  const adminClient = createAdminClient();

  const { data: modules } = await adminClient
    .from('modules')
    .select('id, title, description, thumbnail_url, position')
    .eq('course_id', course.id)
    .order('position', { ascending: true });

  const moduleIds = (modules ?? []).map((module) => module.id);
  const { data: lessons } = moduleIds.length
    ? await adminClient
        .from('lessons')
        .select('id, title, module_id, position')
        .in('module_id', moduleIds)
        .order('position', { ascending: true })
    : { data: [] as { id: string; title: string; module_id: string; position: number }[] };

  const { data: progressRows } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('student_id', user.id);

  const completedIds = new Set((progressRows ?? []).map((row) => row.lesson_id));
  const flatLessons = lessons ?? [];
  const lockedIds = computeLockedLessonIds(flatLessons, completedIds);
  const nextLesson = flatLessons.find((lesson) => !completedIds.has(lesson.id)) ?? flatLessons[flatLessons.length - 1] ?? null;

  const requestedLesson = requestedLessonId
    ? flatLessons.find((lesson) => lesson.id === requestedLessonId) ?? null
    : null;

  const highlightedLesson = requestedLesson ?? nextLesson;
  const defaultOpenModuleId = highlightedLesson?.module_id ?? modules?.[0]?.id ?? null;
  const totalLessons = flatLessons.length;
  const completedLessons = flatLessons.filter((lesson) => completedIds.has(lesson.id)).length;
  const remainingLessons = Math.max(totalLessons - completedLessons, 0);
  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const isComplete = totalLessons > 0 && completedLessons === totalLessons;

  return (
    <>
      <StudentNav isAdmin={profile?.is_admin} currentUserId={user.id} />
      <section className="max-w-[940px] mx-auto px-5 sm:px-6 py-8 sm:py-12">
        <div className="mb-7 sm:mb-9">
          <div className="eyebrow">محتوى الدورة</div>
          <h1 className="font-heading font-extrabold text-[28px] sm:text-[34px] leading-tight mb-2">{course.title}</h1>
          {course.description && (
            <p className="text-muted text-[14px] sm:text-[15px] leading-7 max-w-[760px]">{course.description}</p>
          )}
        </div>

        <div className="card p-5 sm:p-6 mb-6 sm:mb-8 border border-white/[0.08] overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/35 to-transparent" />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <div className="text-[12px] font-bold text-gold mb-1.5">تقدمك في الدورة</div>
              <div className="flex items-end gap-2">
                <span className="font-heading font-extrabold text-[34px] sm:text-[38px] leading-none text-text">{progressPct}%</span>
                <span className="text-muted2 text-[12px] pb-1">مكتمل</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 min-w-0 sm:min-w-[330px]">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-center">
                <div className="text-[17px] font-bold text-success">{completedLessons}</div>
                <div className="text-[10.5px] text-muted2 mt-1">مكتمل</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-center">
                <div className="text-[17px] font-bold text-gold">{remainingLessons}</div>
                <div className="text-[10.5px] text-muted2 mt-1">متبقي</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-center">
                <div className="text-[17px] font-bold text-text">{totalLessons}</div>
                <div className="text-[10.5px] text-muted2 mt-1">إجمالي</div>
              </div>
            </div>
          </div>

          <div className="h-2 bg-track rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-l from-goldDim via-gold to-[#E7CB82] rounded-full transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="mt-4 flex items-center gap-2 text-[12.5px]">
            <span className={`inline-flex h-2 w-2 rounded-full ${isComplete ? 'bg-success' : 'bg-gold'}`} />
            <span className={isComplete ? 'text-success' : 'text-muted'}>
              {isComplete ? 'أكملت جميع دروس الدورة' : 'واصل من الدرس المحدد بالأسفل'}
            </span>
          </div>
        </div>

        <CourseAccordion
          modules={modules ?? []}
          lessons={flatLessons}
          completedIds={Array.from(completedIds)}
          lockedIds={Array.from(lockedIds)}
          highlightedLessonId={highlightedLesson?.id ?? null}
          defaultOpenModuleId={defaultOpenModuleId}
        />
      </section>
    </>
  );
}
