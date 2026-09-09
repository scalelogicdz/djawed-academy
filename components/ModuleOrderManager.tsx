'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Course = { id: string; title: string };
type ModuleRow = {
  id: string;
  course_id: string;
  title: string;
  position: number;
};

export default function ModuleOrderManager({
  courses,
  initialModules,
}: {
  courses: Course[];
  initialModules: ModuleRow[];
}) {
  const router = useRouter();
  const [modules, setModules] = useState(initialModules);
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.id ?? '');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const beforeDragRef = useRef<ModuleRow[] | null>(null);
  const didDropRef = useRef(false);

  const courseModules = useMemo(
    () =>
      modules
        .filter((module) => module.course_id === selectedCourse)
        .sort((a, b) => a.position - b.position),
    [modules, selectedCourse]
  );

  function replaceCourseOrder(nextCourseModules: ModuleRow[]) {
    const positions = new Map(nextCourseModules.map((module, index) => [module.id, index]));
    setModules((current) =>
      current.map((module) => {
        const nextPosition = positions.get(module.id);
        return nextPosition === undefined ? module : { ...module, position: nextPosition };
      })
    );
  }

  function handleDragStart(moduleId: string) {
    beforeDragRef.current = modules.map((module) => ({ ...module }));
    didDropRef.current = false;
    setDraggingId(moduleId);
    setMessage('');
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();
    if (!draggingId || draggingId === targetId) return;

    const ordered = modules
      .filter((module) => module.course_id === selectedCourse)
      .sort((a, b) => a.position - b.position);
    const fromIndex = ordered.findIndex((module) => module.id === draggingId);
    const toIndex = ordered.findIndex((module) => module.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const next = [...ordered];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    replaceCourseOrder(next);
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!draggingId || saving) return;

    didDropRef.current = true;
    const ordered = modules
      .filter((module) => module.course_id === selectedCourse)
      .sort((a, b) => a.position - b.position)
      .map((module, index) => ({ ...module, position: index }));

    replaceCourseOrder(ordered);
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/modules/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse,
          moduleIds: ordered.map((module) => module.id),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر حفظ ترتيب الوحدات');

      beforeDragRef.current = null;
      setMessage('تم حفظ ترتيب الوحدات');
      router.refresh();
    } catch (error) {
      if (beforeDragRef.current) setModules(beforeDragRef.current);
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ ترتيب الوحدات');
    } finally {
      setSaving(false);
      setDraggingId(null);
    }
  }

  function handleDragEnd() {
    if (!didDropRef.current && beforeDragRef.current) {
      setModules(beforeDragRef.current);
    }
    beforeDragRef.current = null;
    didDropRef.current = false;
    setDraggingId(null);
  }

  return (
    <div className="card p-5 sm:p-6 mb-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-cairo font-bold text-base text-text">ترتيب الوحدات</h2>
          <p className="text-muted text-xs sm:text-[13px] mt-1">اسحب الوحدة وضعها في المكان الذي تريده. يتم حفظ الترتيب عند الإفلات.</p>
        </div>
        {saving && <span className="text-xs text-gold">جارٍ حفظ الترتيب...</span>}
      </div>

      {courses.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {courses.map((course) => (
            <button
              key={course.id}
              onClick={() => {
                setSelectedCourse(course.id);
                setMessage('');
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-cairo font-semibold transition ${
                selectedCourse === course.id
                  ? 'bg-gold/10 text-gold border border-gold/35'
                  : 'text-muted border border-border hover:text-text'
              }`}
            >
              {course.title}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {courseModules.map((module, index) => (
          <div
            key={module.id}
            draggable={!saving}
            onDragStart={() => handleDragStart(module.id)}
            onDragOver={(event) => handleDragOver(event, module.id)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 rounded-xl border px-3.5 sm:px-4 py-3 transition select-none ${
              draggingId === module.id
                ? 'border-gold/55 bg-gold/[0.08] opacity-70'
                : 'border-border bg-white/[0.015] hover:border-gold/30'
            } ${saving ? 'cursor-wait' : 'cursor-grab active:cursor-grabbing'}`}
          >
            <span className="text-muted2 text-lg leading-none" aria-hidden="true">⋮⋮</span>
            <span className="w-7 h-7 rounded-lg bg-gold/[0.08] border border-gold/20 text-gold text-xs font-semibold flex items-center justify-center flex-shrink-0">
              {index + 1}
            </span>
            <span className="font-cairo font-semibold text-sm flex-1 min-w-0 truncate">{module.title}</span>
          </div>
        ))}
      </div>

      {courseModules.length === 0 && <p className="text-muted text-sm">لا توجد وحدات لترتيبها حاليًا.</p>}
      {message && (
        <p className={`text-xs mt-4 ${message.startsWith('تم ') ? 'text-success' : 'text-[#E4756A]'}`}>{message}</p>
      )}
    </div>
  );
}
