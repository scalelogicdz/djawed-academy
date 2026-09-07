'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import QuizPanel from '@/components/QuizPanel';

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  video_id: string | null;
  video_provider: string | null;
  resource_url: string | null;
  module_id: string;
};
type ModuleRow = { id: string; title: string; description: string | null; position: number };
type LessonListItem = { id: string; title: string; module_id: string; position: number };
type QuizQuestion = { id: string; question: string; options: string[]; correct_index: number };

declare global {
  interface Window {
    playerjs?: any;
  }
}

export default function LessonBody({
  lesson,
  modules,
  lessons,
  completedIds,
  lockedIds,
  prevLessonId,
  nextLessonId,
  isCompleted,
  isLocked,
  requiredLessonTitle,
  requiredLessonId,
  quizQuestions,
}: {
  lesson: Lesson;
  modules: ModuleRow[];
  lessons: LessonListItem[];
  completedIds: string[];
  lockedIds: string[];
  prevLessonId: string | null;
  nextLessonId: string | null;
  isCompleted: boolean;
  isLocked: boolean;
  requiredLessonTitle: string | null;
  requiredLessonId: string | null;
  quizQuestions: QuizQuestion[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [completed, setCompleted] = useState(isCompleted);
  const [saving, setSaving] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const completedSet = new Set(completedIds);
  const lockedSet = new Set(lockedIds);

  const BUNNY_LIBRARY_ID = '744754';
  const embedUrl =
    lesson.video_provider === 'vimeo'
      ? `https://player.vimeo.com/video/${lesson.video_id}`
      : `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${lesson.video_id}`;

  // Load Bunny's Player.js library once, then attach an "ended" listener to this
  // lesson's iframe so we know for real that the student watched the video through.
  useEffect(() => {
    if (isLocked || !lesson.video_id || lesson.video_provider === 'vimeo') return;

    let player: any;
    let cancelled = false;

    function attachPlayer() {
      if (cancelled || !iframeRef.current || !window.playerjs) return;
      try {
        player = new window.playerjs.Player(iframeRef.current);
        player.on('ready', () => {
          if (cancelled) return;
          try {
            player.on('ended', () => {
              // Guard against a stray postMessage arriving after this lesson
              // has already been navigated away from (the iframe/player may
              // already be torn down at that point).
              if (cancelled) return;
              setVideoEnded(true);
            });
          } catch {
            // Never let a Player.js callback wiring issue crash the page.
          }
        });
      } catch {
        // Player.js failing to initialize shouldn't break the lesson page —
        // the student just won't get the auto-detected "watched" state.
      }
    }

    if (window.playerjs) {
      attachPlayer();
    } else {
      const existingScript = document.getElementById('bunny-playerjs-script');
      if (existingScript) {
        existingScript.addEventListener('load', attachPlayer);
      } else {
        const script = document.createElement('script');
        script.id = 'bunny-playerjs-script';
        script.src = '//assets.mediadelivery.net/playerjs/playerjs-latest.min.js';
        script.onload = attachPlayer;
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (player && typeof player.off === 'function') {
        try {
          player.off('ended');
          player.off('ready');
        } catch {
          // Tearing down a player that's already gone is fine to ignore.
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  function playCompletionSound() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // A short, pleasant two-note rising chime
      [523.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = now + i * 0.11;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });

      setTimeout(() => ctx.close(), 800);
    } catch {
      // Audio isn't critical — silently ignore if unsupported/blocked.
    }
  }

  async function toggleComplete() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (completed) {
      await supabase.from('lesson_progress').delete().eq('lesson_id', lesson.id).eq('student_id', user.id);
      setCompleted(false);
    } else {
      await supabase.from('lesson_progress').insert({ lesson_id: lesson.id, student_id: user.id });
      setCompleted(true);
      playCompletionSound();
    }
    setSaving(false);
    router.refresh();
  }

  // Only require watching the video through if a real video exists. Once marked
  // complete, always allow un-marking freely without needing to rewatch.
  const requiresWatch = !!lesson.video_id && lesson.video_provider !== 'vimeo';
  const canMarkComplete = completed || !requiresWatch || videoEnded;
  const showQuiz = quizQuestions.length > 0 && (!requiresWatch || videoEnded);

  const [activeTabId, setActiveTabId] = useState(lesson.module_id);
  const listRef = useRef<HTMLDivElement>(null);
  const moduleHeaderRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function scrollToModule(moduleId: string) {
    setActiveTabId(moduleId);
    const list = listRef.current;
    const header = moduleHeaderRefs.current[moduleId];
    if (!list || !header) return;
    const listRect = list.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    list.scrollTo({ top: list.scrollTop + (headerRect.top - listRect.top), behavior: 'smooth' });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div>
        {isLocked ? (
          <div className="aspect-video rounded-2xl border border-border overflow-hidden mb-5 bg-gradient-to-br from-surface2 to-[#070A10] flex flex-col items-center justify-center text-center px-8 gap-3">
            <span className="text-3xl">🔒</span>
            <p className="font-heading font-bold text-[16px]">هذا الدرس مغلق حاليًا</p>
            {requiredLessonTitle && (
              <p className="text-muted text-[13.5px]">
                أكمل درس <span className="text-text font-semibold">"{requiredLessonTitle}"</span> أولًا لفتح هذا الدرس
              </p>
            )}
            {requiredLessonId && (
              <Link href={`/lesson/${requiredLessonId}`} className="btn-primary mt-2">
                الذهاب إلى الدرس المطلوب
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="aspect-video rounded-2xl border border-border overflow-hidden mb-5 bg-gradient-to-br from-surface2 to-[#070A10]">
              {lesson.video_id ? (
                <iframe
                  ref={iframeRef}
                  src={embedUrl}
                  className="w-full h-full"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted text-sm">
                  لم يتم إضافة الفيديو بعد
                </div>
              )}
            </div>

            {lesson.description && (
              <p className="text-muted text-[14.5px] mb-5 leading-relaxed">{lesson.description}</p>
            )}

            {lesson.resource_url && (
              <a href={lesson.resource_url} target="_blank" rel="noreferrer" className="btn-ghost inline-block mb-5">
                📎 تحميل الملف المرفق
              </a>
            )}

            {showQuiz && <QuizPanel questions={quizQuestions} />}
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2.5 mt-5">
          <div className="justify-self-start">
            {prevLessonId && (
              <Link href={`/lesson/${prevLessonId}`} className="btn-ghost text-center inline-block">
                → الدرس السابق
              </Link>
            )}
          </div>

          <div className="justify-self-center">
            {!isLocked && (
              <div className="flex flex-col items-center gap-1.5">
                <button onClick={toggleComplete} disabled={saving || !canMarkComplete} className="btn-primary">
                  {completed ? '✓ مكتمل' : 'تحديد كمكتمل'}
                </button>
                {!canMarkComplete && (
                  <span className="text-muted2 text-[11.5px]">شاهد الفيديو كاملاً لتتمكن من تحديد الدرس كمكتمل</span>
                )}
              </div>
            )}
          </div>

          <div className="justify-self-end">
            {nextLessonId && canMarkComplete && (
              <Link href={`/lesson/${nextLessonId}`} className="btn-ghost text-center inline-block">
                الدرس التالي ←
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar: module tabs + scrollable lesson list, bounded on every screen size
          so this never becomes a long scroll on mobile like it used to. */}
      <div className="lg:sticky lg:top-20 max-h-[65vh] lg:max-h-[calc(100vh-6rem)] flex flex-col">
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
          {modules.map((m) => (
            <button
              key={m.id}
              onClick={() => scrollToModule(m.id)}
              className={`module-tab ${activeTabId === m.id ? 'active' : ''}`}
            >
              {m.title}
            </button>
          ))}
        </div>

        <div ref={listRef} className="overflow-y-auto flex-1 space-y-1 pr-0.5" style={{ scrollbarWidth: 'thin' }}>
          {modules.map((m) => (
            <div key={m.id}>
              <div
                ref={(el) => { moduleHeaderRefs.current[m.id] = el; }}
                className="font-heading font-bold text-[13px] text-gold uppercase tracking-wide pt-4 pb-2 first:pt-0"
              >
                {m.title}
              </div>
              {m.description && (
                <p className="text-muted2 text-[12px] mb-2 leading-relaxed">{m.description}</p>
              )}
              <div className="space-y-1.5">
                {lessons
                  .filter((l) => l.module_id === m.id)
                  .map((l) => {
                    const done = completedSet.has(l.id);
                    const active = l.id === lesson.id;
                    const locked = lockedSet.has(l.id);
                    return (
                      <Link
                        key={l.id}
                        href={`/lesson/${l.id}`}
                        className={`list-item ${active ? 'active' : ''} flex items-center gap-2.5 px-4 py-3 text-sm ${
                          (done || locked) && !active ? 'text-muted' : ''
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            active
                              ? 'bg-gold shadow-[0_0_10px_rgba(212,177,94,0.6)]'
                              : done
                              ? 'bg-success'
                              : 'bg-[#2A3444]'
                          }`}
                        />
                        <span className="flex-1">{l.title}</span>
                        {locked && !active && <span className="text-[12px] flex-shrink-0">🔒</span>}
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
