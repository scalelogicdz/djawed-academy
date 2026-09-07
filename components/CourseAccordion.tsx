'use client';

import { useState } from 'react';
import Link from 'next/link';

type ModuleRow = { id: string; title: string; description: string | null; position: number };
type LessonRow = { id: string; title: string; module_id: string; position: number };

export default function CourseAccordion({
  modules,
  lessons,
  completedIds,
  lockedIds,
  nextLessonId,
  defaultOpenModuleId,
}: {
  modules: ModuleRow[];
  lessons: LessonRow[];
  completedIds: string[];
  lockedIds: string[];
  nextLessonId: string | null;
  defaultOpenModuleId: string | null;
}) {
  // Classic accordion: only one module open at a time. Opening a new one closes the previous.
  const [openModuleId, setOpenModuleId] = useState<string | null>(defaultOpenModuleId);
  const completedSet = new Set(completedIds);
  const lockedSet = new Set(lockedIds);

  function toggleModule(moduleId: string) {
    setOpenModuleId((current) => (current === moduleId ? null : moduleId));
  }

  return (
    <div className="space-y-3">
      {modules.map((m) => {
        const isOpen = openModuleId === m.id;
        const moduleLessons = lessons.filter((l) => l.module_id === m.id);
        return (
          <div key={m.id} className="card overflow-hidden">
            <button
              onClick={() => toggleModule(m.id)}
              className="w-full flex items-center justify-between px-6 py-5 text-right"
            >
              <span className="font-heading font-bold text-[16px]">{m.title}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`text-muted flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="border-t border-border">
                  {moduleLessons.map((l) => {
                    const done = completedSet.has(l.id);
                    const locked = lockedSet.has(l.id);
                    const isNext = l.id === nextLessonId;
                    const content = (
                      <div
                        className={`flex items-center gap-4 px-6 py-4 border-b border-border last:border-0 transition ${
                          locked ? 'opacity-50' : 'hover:bg-white/[0.02]'
                        } ${isNext ? 'bg-gold/[0.06]' : ''}`}
                      >
                        <div className="w-16 h-11 rounded-lg bg-surface2 border border-border flex-shrink-0 flex items-center justify-center">
                          {locked ? (
                            <span className="text-sm">🔒</span>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-muted">
                              <path d="M8 5v14l11-7z" fill="currentColor" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[14.5px] ${isNext ? 'font-semibold text-gold' : ''}`}>{l.title}</p>
                          {isNext && <p className="text-[11.5px] text-gold mt-0.5">التالي في طريقك</p>}
                        </div>
                        {done && <span className="text-success text-[13px] flex-shrink-0">✓</span>}
                      </div>
                    );
                    return locked ? (
                      <div key={l.id}>{content}</div>
                    ) : (
                      <Link key={l.id} href={`/lesson/${l.id}`}>
                        {content}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
