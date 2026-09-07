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
    .select('id, title, description, position')
    .eq('course_id', course.id)
    .order('position', { ascending: true });

  const moduleIds = (modules ?? []).map((module) => module.id);
  const { data: lessons } = moduleIds.length
    ? await adminClient
        .from('lessons')
        .select('id, title, module_id, position, thumbnail_url')
        .in('module_id', moduleIds)
        .order('position', { ascending: true })
    : { data: [] as { id: string; title: string; module_id: string; position: number; thumbnail_url: string | null }[] };

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
  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <>
      <StudentNav isAdmin={profile?.is_admin} currentUserId={user.id} />
      <section className="max-w-[900px] mx-auto px-5 sm:px-6 py-10 sm:py-14">
        <div className="mb-8">
          <div className="eyebrow">محتوى الدورة</div>
          <h1 className="font-heading font-extrabold text-[28px] sm:text-[32px] mb-2">{course.title}</h1>
          {course.description && <p className="text-muted text-[14px] sm:text-[15px] leading-relaxed">{course.description}</p>}

          <div className="mt-6 flex items-center gap-4">
            <div className="h-1.5 bg-track rounded-full overflow-hidden flex-1">
              <div
                className="h-full bg-gradient-to-l from-goldDim to-gold rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[13px] text-muted flex-shrink-0">{progressPct}% مكتمل</span>
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
