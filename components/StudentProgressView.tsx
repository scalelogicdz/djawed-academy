import type { StudentProgressSummary, FollowUpStatus } from '@/lib/studentProgress';

export const progressLabels: Record<FollowUpStatus, string> = {
  not_enrolled: 'دون دورة', no_lessons: 'لا توجد دروس متاحة', not_started: 'لم يُكمل درسًا بعد',
  inactive: 'لا نشاط منذ أسبوع', stalled: 'لم يُكمل درسًا منذ أسبوع',
  in_progress: 'يتقدم في الدورة', complete: 'أكمل الدروس',
};
const dateFormatter = new Intl.DateTimeFormat('ar-DZ', {
  timeZone: 'Africa/Algiers', day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});
export function activityDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : 'لا يوجد نشاط مسجّل';
}
export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
      className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-gold" style={{ width: percent + '%' }} />
    </div>
  );
}
export function StudentProgressDetails({ summary }: { summary: StudentProgressSummary }) {
  return (
    <div className="space-y-5 text-right">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <h3 className="text-xs text-muted mb-2">آخر درس مكتمل</h3>
          {summary.lastCompletedLesson ? <><p className="font-semibold">{summary.lastCompletedLesson.title}</p>
            <p className="mt-1 text-xs text-muted">{summary.lastCompletedLesson.moduleTitle}</p>
            <p className="mt-2 text-xs text-muted2">{activityDate(summary.lastCompletionAt)}</p></>
            : <p className="text-sm text-muted">لا يوجد درس مكتمل مسجّل</p>}
        </div>
        <div className="rounded-xl border border-border p-4">
          <h3 className="text-xs text-muted mb-2">الدرس التالي غير المكتمل</h3>
          {summary.nextLesson ? <><p className="font-semibold">{summary.nextLesson.title}</p>
            <p className="mt-1 text-xs text-muted">{summary.nextLesson.courseTitle} · {summary.nextLesson.moduleTitle}</p></>
            : <p className="text-sm text-muted">{summary.total > 0 ? 'جميع الدروس المتاحة مكتملة' : 'لا يوجد درس متاح'}</p>}
        </div>
      </div>
      {summary.courses.map(course => (
        <div key={course.id} className="rounded-xl border border-border p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{course.title}</h3>
            <span className="text-xs text-muted">{course.completed} / {course.total} درس · {course.percent}%</span>
          </div>
          <ProgressBar percent={course.percent} label={'التقدم في ' + course.title} />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {course.modules.map(module => <div key={module.id} className="flex justify-between gap-3 rounded-lg bg-white/[0.025] px-3 py-2 text-xs">
              <span>{module.title}</span><span className="shrink-0 text-muted">{module.completed} / {module.total}</span>
            </div>)}
          </div>
        </div>
      ))}
    </div>
  );
}
