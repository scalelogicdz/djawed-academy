'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type ModuleRow = { id: string; title: string; description: string | null; thumbnail_url: string | null; position: number };
type LessonRow = { id: string; title: string; module_id: string; position: number };

export default function CourseAccordion({
  modules,
  lessons,
  completedIds,
  lockedIds,
  highlightedLessonId,
  defaultOpenModuleId,
}: {
  modules: ModuleRow[];
  lessons: LessonRow[];
  completedIds: string[];
  lockedIds: string[];
  highlightedLessonId: string | null;
  defaultOpenModuleId: string | null;
}) {
  const [openModuleId, setOpenModuleId] = useState<string | null>(defaultOpenModuleId);
  const completedSet = new Set(completedIds);
  const lockedSet = new Set(lockedIds);
  const highlightedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlightedLessonId) return;
    const timer = window.setTimeout(() => {
      highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [highlightedLessonId]);

  function toggleModule(moduleId: string) {
    setOpenModuleId((current) => (current === moduleId ? null : moduleId));
  }

  return (
    <div className="space-y-4">
      {modules.map((module, moduleIndex) => {
        const isOpen = openModuleId === module.id;
        const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id);
        const completedInModule = moduleLessons.filter((lesson) => completedSet.has(lesson.id)).length;

        return (
          <div key={module.id} className="card overflow-hidden border border-border/90">
            <button
              type="button"
              onClick={() => toggleModule(module.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-4 px-5 sm:px-6 py-5 text-right hover:bg-white/[0.02] transition"
            >
              <div className="w-10 h-10 rounded-xl border border-border bg-surface2 flex items-center justify-center text-gold font-heading font-bold flex-shrink-0">
                {moduleIndex + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-heading font-bold text-[16px] sm:text-[17px]">{module.title}</div>
                <div className="text-muted2 text-[12px] mt-1">
                  {completedInModule}/{moduleLessons.length} دروس مكتملة
                </div>
              </div>
              <svg
                width="18"
                height="18"
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
                <div className="border-t border-border px-3 sm:px-4 py-2">
                  {module.description && (
                    <p className="text-muted2 text-[12.5px] leading-relaxed px-2 sm:px-3 py-3">{module.description}</p>
                  )}

                  <div className="space-y-2 pb-2">
                    {moduleLessons.map((lesson, lessonIndex) => {
                      const done = completedSet.has(lesson.id);
                      const locked = lockedSet.has(lesson.id);
                      const isHighlighted = lesson.id === highlightedLessonId;

                      const row = (
                        <div
                          ref={isHighlighted ? highlightedRef : undefined}
                          className={`flex items-center gap-3 sm:gap-4 rounded-xl px-3 py-3 transition border ${
                            locked
                              ? 'opacity-55 border-transparent bg-white/[0.015]'
                              : 'border-transparent hover:border-border hover:bg-white/[0.025]'
                          } ${isHighlighted ? '!border-gold/50 !bg-gold/[0.08] shadow-[0_0_0_1px_rgba(212,177,94,0.08)]' : ''}`}
                        >
                          <div className="relative w-[92px] sm:w-[120px] aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-surface2 to-[#070A10] border border-border flex-shrink-0">
                            {module.thumbnail_url ? (
                              <img
                                src={module.thumbnail_url}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                            ) : null}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                              <div className="w-8 h-8 rounded-full bg-black/40 border border-white/15 flex items-center justify-center">
                                {locked ? (
                                  <span className="text-[13px]">🔒</span>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gold translate-x-[1px]">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <span className="absolute bottom-1.5 right-2 text-[10px] text-white/80 drop-shadow">درس {lessonIndex + 1}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className={`text-[14px] sm:text-[15px] leading-relaxed ${isHighlighted ? 'font-bold text-gold' : 'text-text'}`}>
                              {lesson.title}
                            </p>
                            {isHighlighted && <p className="text-[11.5px] text-gold mt-1">متابعة من هنا</p>}
                          </div>

                          <div className="flex-shrink-0 w-6 text-center">
                            {done ? (
                              <span className="inline-flex w-5 h-5 rounded-full bg-success/15 text-success items-center justify-center text-[12px]">✓</span>
                            ) : locked ? (
                              <span className="text-[12px]">🔒</span>
                            ) : (
                              <span className="text-muted">‹</span>
                            )}
                          </div>
                        </div>
                      );

                      return locked ? (
                        <div key={lesson.id}>{row}</div>
                      ) : (
                        <Link key={lesson.id} href={`/lesson/${lesson.id}`} className="block">
                          {row}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
