'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';

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
  const { language } = useLanguage();
  const [openModuleId, setOpenModuleId] = useState<string | null>(defaultOpenModuleId);
  const completedSet = new Set(completedIds);
  const lockedSet = new Set(lockedIds);
  const highlightedRef = useRef<HTMLDivElement>(null);

  const copy = language === 'fr'
    ? {
        complete: 'Terminé',
        completedLessons: (done: number, total: number) => `${done} sur ${total} leçons terminées`,
        lesson: (index: number) => `Leçon ${index}`,
        locked: 'Terminez la leçon précédente pour débloquer celle-ci',
        continueHere: 'Reprendre ici',
        rewatch: 'Vous pouvez revoir cette leçon',
        ready: 'Prête à regarder',
      }
    : language === 'en'
      ? {
          complete: 'Completed',
          completedLessons: (done: number, total: number) => `${done} of ${total} lessons completed`,
          lesson: (index: number) => `Lesson ${index}`,
          locked: 'Complete the previous lesson to unlock this one',
          continueHere: 'Continue from here',
          rewatch: 'You can rewatch this lesson',
          ready: 'Ready to watch',
        }
      : {
          complete: 'مكتمل',
          completedLessons: (done: number, total: number) => `${done} من ${total} دروس مكتملة`,
          lesson: (index: number) => `درس ${index}`,
          locked: 'أكمل الدرس السابق لفتح هذا الدرس',
          continueHere: 'تابع من هنا',
          rewatch: 'يمكنك إعادة مشاهدة الدرس',
          ready: 'جاهز للمشاهدة',
        };

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
    <div className="space-y-4 sm:space-y-5">
      {modules.map((module, moduleIndex) => {
        const isOpen = openModuleId === module.id;
        const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id);
        const completedInModule = moduleLessons.filter((lesson) => completedSet.has(lesson.id)).length;
        const modulePct = moduleLessons.length > 0 ? Math.round((completedInModule / moduleLessons.length) * 100) : 0;
        const moduleDone = moduleLessons.length > 0 && completedInModule === moduleLessons.length;

        return (
          <div key={module.id} className="card overflow-hidden border border-border/90">
            <button
              type="button"
              onClick={() => toggleModule(module.id)}
              aria-expanded={isOpen}
              className="w-full text-start hover:bg-white/[0.02] transition"
            >
              <div className="flex items-center gap-4 px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center font-heading font-bold flex-shrink-0 ${
                    moduleDone
                      ? 'border-success/30 bg-success/[0.08] text-success'
                      : 'border-border bg-surface2 text-gold'
                  }`}
                >
                  {moduleDone ? '✓' : moduleIndex + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <div className="font-heading font-bold text-[16px] sm:text-[18px] leading-snug">{module.title}</div>
                    {moduleDone && (
                      <span className="inline-flex rounded-full border border-success/20 bg-success/[0.08] px-2 py-0.5 text-[10px] font-bold text-success">
                        {copy.complete}
                      </span>
                    )}
                  </div>
                  <div className="text-muted2 text-[11.5px] sm:text-[12px]">
                    {copy.completedLessons(completedInModule, moduleLessons.length)}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`hidden sm:inline text-[12px] font-bold ${moduleDone ? 'text-success' : 'text-muted'}`}>
                    {modulePct}%
                  </span>
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
                </div>
              </div>

              <div className="px-4 sm:px-6 pb-5">
                <div className="h-1.5 rounded-full overflow-hidden bg-track">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${
                      moduleDone ? 'bg-success' : 'bg-gradient-to-l from-goldDim to-gold'
                    }`}
                    style={{ width: `${modulePct}%` }}
                  />
                </div>
              </div>
            </button>

            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="border-t border-border px-3 sm:px-4 py-3">
                  {module.description && (
                    <p className="text-muted2 text-[12.5px] leading-7 px-2 sm:px-3 py-3">{module.description}</p>
                  )}

                  <div className="space-y-2.5 pb-2">
                    {moduleLessons.map((lesson, lessonIndex) => {
                      const done = completedSet.has(lesson.id);
                      const locked = lockedSet.has(lesson.id);
                      const isHighlighted = lesson.id === highlightedLessonId;

                      const row = (
                        <div
                          ref={isHighlighted ? highlightedRef : undefined}
                          className={`relative flex items-center gap-3 sm:gap-4 rounded-2xl px-3 sm:px-4 py-3.5 transition border ${
                            locked
                              ? 'opacity-55 border-white/[0.04] bg-white/[0.012]'
                              : done
                                ? 'border-success/[0.10] bg-success/[0.025] hover:border-success/[0.18] hover:bg-success/[0.04]'
                                : 'border-white/[0.04] bg-white/[0.012] hover:border-gold/20 hover:bg-white/[0.025]'
                          } ${
                            isHighlighted
                              ? '!border-gold/50 !bg-gold/[0.075] shadow-[0_0_0_1px_rgba(212,177,94,0.06),0_12px_28px_-24px_rgba(212,177,94,0.45)]'
                              : ''
                          }`}
                        >
                          {isHighlighted && (
                            <span className="absolute inset-y-3 start-0 w-[3px] rounded-full bg-gold" aria-hidden="true" />
                          )}

                          <div className="relative w-[86px] sm:w-[118px] aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-surface2 to-[#070A10] border border-border flex-shrink-0">
                            {module.thumbnail_url ? (
                              <img
                                src={module.thumbnail_url}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                            ) : null}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                              <div
                                className={`w-8 h-8 rounded-full border flex items-center justify-center ${
                                  done
                                    ? 'bg-success/15 border-success/25 text-success'
                                    : locked
                                      ? 'bg-black/45 border-white/10 text-white/70'
                                      : 'bg-black/40 border-white/15 text-gold'
                                }`}
                              >
                                {done ? (
                                  <span className="text-[13px] font-bold">✓</span>
                                ) : locked ? (
                                  <span className="text-[13px]">🔒</span>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="translate-x-[1px]">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <span className="absolute bottom-1.5 end-2 text-[10px] text-white/80 drop-shadow">{copy.lesson(lessonIndex + 1)}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p
                                className={`text-[13.5px] sm:text-[15px] leading-relaxed ${
                                  isHighlighted ? 'font-bold text-gold' : done ? 'font-semibold text-text' : 'text-text'
                                }`}
                              >
                                {lesson.title}
                              </p>
                              {done && !isHighlighted && (
                                <span className="inline-flex rounded-full bg-success/[0.08] px-2 py-0.5 text-[9.5px] font-bold text-success">
                                  {copy.complete}
                                </span>
                              )}
                            </div>

                            <p className={`text-[11px] sm:text-[11.5px] ${locked ? 'text-muted2' : isHighlighted ? 'text-gold' : 'text-muted2'}`}>
                              {locked ? copy.locked : isHighlighted ? copy.continueHere : done ? copy.rewatch : copy.ready}
                            </p>
                          </div>

                          <div className="flex-shrink-0 min-w-7 flex items-center justify-center">
                            {done ? (
                              <span className="inline-flex w-6 h-6 rounded-full bg-success/15 text-success items-center justify-center text-[12px] font-bold">✓</span>
                            ) : locked ? (
                              <span className="inline-flex w-6 h-6 rounded-full border border-white/[0.07] bg-white/[0.02] items-center justify-center text-[11px]">🔒</span>
                            ) : (
                              <span className="text-gold text-[20px] leading-none">{language === 'ar' ? '‹' : '›'}</span>
                            )}
                          </div>
                        </div>
                      );

                      return locked ? (
                        <div key={lesson.id}>{row}</div>
                      ) : (
                        <Link key={lesson.id} href={`/lesson/${lesson.id}`} className="block rounded-2xl">
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
