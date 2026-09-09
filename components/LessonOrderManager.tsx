'use client';

import { useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useRouter } from 'next/navigation';

type ModuleRow = {
  id: string;
  course_id: string;
  title: string;
  position: number;
};

type LessonRow = {
  id: string;
  module_id: string;
  title: string;
  position: number;
};

export default function LessonOrderManager({
  initialModules,
  initialLessons,
}: {
  initialModules: ModuleRow[];
  initialLessons: LessonRow[];
}) {
  const router = useRouter();
  const modules = useMemo(
    () => [...initialModules].sort((a, b) => a.position - b.position),
    [initialModules]
  );
  const [lessons, setLessons] = useState(initialLessons);
  const [selectedModule, setSelectedModule] = useState(modules[0]?.id ?? '');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const beforeDragRef = useRef<LessonRow[] | null>(null);
  const didDropRef = useRef(false);

  const moduleLessons = useMemo(
    () =>
      lessons
        .filter((lesson) => lesson.module_id === selectedModule)
        .sort((a, b) => a.position - b.position),
    [lessons, selectedModule]
  );

  function replaceModuleOrder(nextLessons: LessonRow[]) {
    const positions = new Map(nextLessons.map((lesson, index) => [lesson.id, index]));
    setLessons((current) =>
      current.map((lesson) => {
        const nextPosition = positions.get(lesson.id);
        return nextPosition === undefined ? lesson : { ...lesson, position: nextPosition };
      })
    );
  }

  function handleDragStart(lessonId: string) {
    beforeDragRef.current = lessons.map((lesson) => ({ ...lesson }));
    didDropRef.current = false;
    setDraggingId(lessonId);
    setMessage('');
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();
    if (!draggingId || draggingId === targetId) return;

    const ordered = lessons
      .filter((lesson) => lesson.module_id === selectedModule)
      .sort((a, b) => a.position - b.position);
    const fromIndex = ordered.findIndex((lesson) => lesson.id === draggingId);
    const toIndex = ordered.findIndex((lesson) => lesson.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const next = [...ordered];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    replaceModuleOrder(next);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!draggingId || saving || !selectedModule) return;

    didDropRef.current = true;
    const ordered = lessons
      .filter((lesson) => lesson.module_id === selectedModule)
      .sort((a, b) => a.position - b.position)
      .map((lesson, index) => ({ ...lesson, position: index }));

    replaceModuleOrder(ordered);
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/lessons/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: selectedModule,
          lessonIds: ordered.map((lesson) => lesson.id),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر حفظ ترتيب الدروس');

      beforeDragRef.current = null;
      setMessage('تم حفظ ترتيب الدروس');
      router.refresh();
    } catch (error) {
      if (beforeDragRef.current) setLessons(beforeDragRef.current);
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ ترتيب الدروس');
    } finally {
      setSaving(false);
      setDraggingId(null);
    }
  }

  function handleDragEnd() {
    if (!didDropRef.current && beforeDragRef.current) {
      setLessons(beforeDragRef.current);
    }
    beforeDragRef.current = null;
    didDropRef.current = false;
    setDraggingId(null);
  }

  return (
    <div className="card p-5 sm:p-6 mb-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-cairo font-bold text-base text-text">ترتيب الدروس داخل الوحدة</h2>
          <p className="text-muted text-xs sm:text-[13px] mt-1">اختر الوحدة ثم اسحب الدرس إلى المكان الذي تريده. يتم الحفظ عند الإفلات.</p>
        </div>
        {saving && <span className="text-xs text-gold">جارٍ حفظ الترتيب...</span>}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => {
              setSelectedModule(module.id);
              setMessage('');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-cairo font-semibold transition ${
              selectedModule === module.id
                ? 'bg-gold/10 text-gold border border-gold/35'
                : 'text-muted border border-border hover:text-text'
            }`}
          >
            {module.title}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {moduleLessons.map((lesson, index) => (
          <div
            key={lesson.id}
            draggable={!saving}
            onDragStart={() => handleDragStart(lesson.id)}
            onDragOver={(event) => handleDragOver(event, lesson.id)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 rounded-xl border px-3.5 sm:px-4 py-3 transition select-none ${
              draggingId === lesson.id
                ? 'border-gold/55 bg-gold/[0.08] opacity-70'
                : 'border-border bg-white/[0.015] hover:border-gold/30'
            } ${saving ? 'cursor-wait' : 'cursor-grab active:cursor-grabbing'}`}
          >
            <span className="text-muted2 text-lg leading-none" aria-hidden="true">⋮⋮</span>
            <span className="w-7 h-7 rounded-lg bg-gold/[0.08] border border-gold/20 text-gold text-xs font-semibold flex items-center justify-center flex-shrink-0">
              {index + 1}
            </span>
            <span className="font-cairo font-semibold text-sm flex-1 min-w-0 truncate">{lesson.title}</span>
          </div>
        ))}
      </div>

      {modules.length === 0 && <p className="text-muted text-sm">لا توجد وحدات حاليًا.</p>}
      {modules.length > 0 && moduleLessons.length === 0 && <p className="text-muted text-sm">لا توجد دروس داخل هذه الوحدة.</p>}

      {message && (
        <p className={`text-xs mt-4 ${message.startsWith('تم ') ? 'text-success' : 'text-[#E4756A]'}`}>{message}</p>
      )}
    </div>
  );
}
