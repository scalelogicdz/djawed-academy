export type ProgressStudent = { id: string; created_at: string };
export type ProgressEnrollment = { student_id: string; course_id: string; created_at?: string };
export type ProgressCourse = { id: string; title: string };
export type ProgressModule = { id: string; course_id: string; title: string; position: number };
export type ProgressLesson = { id: string; module_id: string; title: string; position: number };
export type ProgressCompletion = { student_id: string; lesson_id: string; completed_at: string };
export type FollowUpStatus = 'not_enrolled' | 'no_lessons' | 'not_started' | 'inactive' | 'stalled' | 'in_progress' | 'complete';
export type StudentProgressSummary = {
  completed: number; total: number; percent: number;
  lastActivityAt: string | null; lastCompletionAt: string | null;
  lastCompletedLesson: { title: string; moduleTitle: string } | null;
  nextLesson: { title: string; moduleTitle: string; courseTitle: string } | null;
  status: FollowUpStatus; needsFollowUp: boolean;
  courses: {
    id: string; title: string; completed: number; total: number; percent: number;
    modules: { id: string; title: string; completed: number; total: number }[];
  }[];
};
export type ProgressInput = {
  students: ProgressStudent[]; courses: ProgressCourse[];
  enrollments: ProgressEnrollment[]; modules: ProgressModule[];
  lessons: ProgressLesson[]; completions: ProgressCompletion[];
  activityByStudent: Record<string, (string | null | undefined)[]>;
  hiddenModuleIds: Set<string>; now: number;
};
const WEEK = 7 * 24 * 60 * 60 * 1000;
function timestamp(value: string | null | undefined, now: number): number | null {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time <= now ? time : null;
}
function percentage(completed: number, total: number) {
  return total === 0 ? 0 : completed === total ? 100 : Math.min(99, Math.round(completed * 100 / total));
}
function byPosition<T extends { position: number; id: string }>(a: T, b: T) {
  return a.position - b.position || a.id.localeCompare(b.id);
}
/** Only current enrollments and visible modules contribute to the denominator.
 * These are recorded lesson completions, not quiz grades or watch-time estimates.
 */
export function buildStudentProgress(input: ProgressInput): Record<string, StudentProgressSummary> {
  const modulesByCourse = new Map<string, ProgressModule[]>();
  for (const module of input.modules) {
    if (input.hiddenModuleIds.has(module.id)) continue;
    const list = modulesByCourse.get(module.course_id) ?? [];
    list.push(module); modulesByCourse.set(module.course_id, list);
  }
  for (const modules of modulesByCourse.values()) modules.sort(byPosition);
  const lessonsByModule = new Map<string, ProgressLesson[]>();
  for (const lesson of input.lessons) {
    const list = lessonsByModule.get(lesson.module_id) ?? [];
    list.push(lesson); lessonsByModule.set(lesson.module_id, list);
  }
  for (const lessons of lessonsByModule.values()) lessons.sort(byPosition);
  const completionsByStudent = new Map<string, ProgressCompletion[]>();
  for (const row of input.completions) {
    const list = completionsByStudent.get(row.student_id) ?? [];
    list.push(row); completionsByStudent.set(row.student_id, list);
  }
  const enrollmentsByStudent = new Map<string, ProgressEnrollment[]>();
  for (const row of input.enrollments) {
    const list = enrollmentsByStudent.get(row.student_id) ?? [];
    list.push(row); enrollmentsByStudent.set(row.student_id, list);
  }
  const coursesById = new Map(input.courses.map(course => [course.id, course]));
  const result: Record<string, StudentProgressSummary> = {};
  for (const student of input.students) {
    const enrollments = enrollmentsByStudent.get(student.id) ?? [];
    const courseIds = [...new Set(enrollments.map(row => row.course_id))];
    const completions = completionsByStudent.get(student.id) ?? [];
    const completedIds = new Set(completions.map(row => row.lesson_id));
    const eligibleLessons = new Map<string, { lesson: ProgressLesson; module: ProgressModule }>();
    let nextLesson: StudentProgressSummary['nextLesson'] = null;
    const courses: StudentProgressSummary['courses'] = [];
    for (const courseId of courseIds) {
      const course = coursesById.get(courseId);
      if (!course) continue;
      const modules = (modulesByCourse.get(courseId) ?? []).map(module => {
        const lessons = lessonsByModule.get(module.id) ?? [];
        let completed = 0;
        for (const lesson of lessons) {
          eligibleLessons.set(lesson.id, { lesson, module });
          if (completedIds.has(lesson.id)) completed++;
          else if (!nextLesson) nextLesson = { title: lesson.title, moduleTitle: module.title, courseTitle: course.title };
        }
        return { id: module.id, title: module.title, completed, total: lessons.length };
      });
      const total = modules.reduce((sum, module) => sum + module.total, 0);
      const completed = modules.reduce((sum, module) => sum + module.completed, 0);
      courses.push({ id: course.id, title: course.title, total, completed, percent: percentage(completed, total), modules });
    }
    const total = courses.reduce((sum, course) => sum + course.total, 0);
    const completed = courses.reduce((sum, course) => sum + course.completed, 0);
    let lastCompletion: number | null = null;
    let lastCompletedLesson: StudentProgressSummary['lastCompletedLesson'] = null;
    for (const row of completions) {
      const eligible = eligibleLessons.get(row.lesson_id);
      const time = timestamp(row.completed_at, input.now);
      if (eligible && time !== null && (lastCompletion === null || time > lastCompletion)) {
        lastCompletion = time;
        lastCompletedLesson = { title: eligible.lesson.title, moduleTitle: eligible.module.title };
      }
    }
    const activity = (input.activityByStudent[student.id] ?? [])
      .map(value => timestamp(value, input.now)).filter((time): time is number => time !== null);
    if (lastCompletion !== null) activity.push(lastCompletion);
    const lastActivity = activity.length ? Math.max(...activity) : null;
    const enrollmentDates = enrollments.map(row => timestamp(row.created_at, input.now))
      .filter((time): time is number => time !== null);
    const baseline = enrollmentDates.length ? Math.max(...enrollmentDates) : timestamp(student.created_at, input.now);
    const activityBaseline = lastActivity === null ? baseline : Math.max(lastActivity, baseline ?? lastActivity);
    const learningBaseline = lastCompletion === null ? baseline : Math.max(lastCompletion, baseline ?? lastCompletion);
    const inactive = activityBaseline !== null && input.now - activityBaseline >= WEEK;
    const stalled = learningBaseline !== null && input.now - learningBaseline >= WEEK;
    let status: FollowUpStatus;
    if (courses.length === 0) status = 'not_enrolled';
    else if (total === 0) status = 'no_lessons';
    else if (completed === total) status = 'complete';
    else if (inactive) status = 'inactive';
    else if (completed === 0) status = 'not_started';
    else if (stalled) status = 'stalled';
    else status = 'in_progress';
    result[student.id] = {
      completed, total, percent: percentage(completed, total),
      lastActivityAt: lastActivity === null ? null : new Date(lastActivity).toISOString(),
      lastCompletionAt: lastCompletion === null ? null : new Date(lastCompletion).toISOString(),
      lastCompletedLesson, nextLesson, courses, status,
      needsFollowUp: total > completed && total > 0 && (inactive || stalled),
    };
  }
  return result;
}
