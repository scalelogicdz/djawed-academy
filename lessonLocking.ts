export type LockableLesson = { id: string; module_id: string; position: number };

/**
 * Sequential per-module lesson locking.
 * Within each module, a lesson is locked until every earlier lesson
 * (by position) in that SAME module has been completed. The first lesson
 * of every module is always unlocked. Modules never block each other —
 * a student can jump straight into any module's first lesson at any time.
 */
export function computeLockedLessonIds(
  lessons: LockableLesson[],
  completedIds: Set<string>
): Set<string> {
  const byModule = new Map<string, LockableLesson[]>();
  for (const l of lessons) {
    const list = byModule.get(l.module_id) ?? [];
    list.push(l);
    byModule.set(l.module_id, list);
  }

  const locked = new Set<string>();
  for (const list of byModule.values()) {
    list.sort((a, b) => a.position - b.position);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      if (!completedIds.has(prev.id)) {
        for (let j = i; j < list.length; j++) locked.add(list[j].id);
        break;
      }
    }
  }
  return locked;
}

/** For a locked lesson, find the specific earlier lesson (same module) it's waiting on. */
export function findRequiredLesson(
  targetLessonId: string,
  lessons: LockableLesson[],
  completedIds: Set<string>
): LockableLesson | null {
  const target = lessons.find((l) => l.id === targetLessonId);
  if (!target) return null;
  const sameModule = lessons
    .filter((l) => l.module_id === target.module_id)
    .sort((a, b) => a.position - b.position);
  for (const l of sameModule) {
    if (l.id === targetLessonId) break;
    if (!completedIds.has(l.id)) return l;
  }
  return null;
}
