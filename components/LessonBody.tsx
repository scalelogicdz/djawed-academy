'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Lesson = {
  id: string;
  title: string;
  video_id: string | null;
  video_provider: string | null;
};

declare global {
  interface Window {
    playerjs?: any;
  }
}

export default function LessonBody({
  lesson,
  prevLessonId,
  nextLessonId,
  isCompleted,
  isLocked,
  requiredLessonTitle,
  requiredLessonId,
}: {
  lesson: Lesson;
  prevLessonId: string | null;
  nextLessonId: string | null;
  isCompleted: boolean;
  isLocked: boolean;
  requiredLessonTitle: string | null;
  requiredLessonId: string | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [completed, setCompleted] = useState(isCompleted);
  const [saving, setSaving] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const BUNNY_LIBRARY_ID = '744754';
  const embedUrl =
    lesson.video_provider === 'vimeo'
      ? `https://player.vimeo.com/video/${lesson.video_id}`
      : `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${lesson.video_id}`;

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
              if (!cancelled) setVideoEnded(true);
            });
          } catch {}
        });
      } catch {}
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
        } catch {}
      }
    };
  }, [isLocked, lesson.id, lesson.video_id, lesson.video_provider]);

  function playCompletionSound() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
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
    } catch {}
  }

  async function toggleComplete() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      return;
    }

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

  const requiresWatch = !!lesson.video_id && lesson.video_provider !== 'vimeo';
  const canMarkComplete = completed || !requiresWatch || videoEnded;
  const navButtonClass =
    'text-center inline-block px-6 py-3 rounded-xl bg-surface2 border border-border text-text font-semibold shadow-sm hover:bg-surface hover:border-gold/40 hover:text-gold transition';

  if (isLocked) {
    return (
      <div className="aspect-video rounded-2xl border border-border overflow-hidden bg-gradient-to-br from-surface2 to-[#070A10] flex flex-col items-center justify-center text-center px-8 gap-3">
        <span className="text-3xl">🔒</span>
        <p className="font-heading font-bold text-[16px]">هذا الدرس مغلق حاليًا</p>
        {requiredLessonTitle && (
          <p className="text-muted text-[13.5px]">
            أكمل درس <span className="text-text font-semibold">"{requiredLessonTitle}"</span> أولًا لفتح هذا الدرس
          </p>
        )}
        {requiredLessonId && (
          <Link href={`/lesson/${requiredLessonId}`} className="btn-primary mt-2">الذهاب إلى الدرس المطلوب</Link>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="aspect-video rounded-2xl border border-border overflow-hidden bg-gradient-to-br from-surface2 to-[#070A10]">
        {lesson.video_id ? (
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-sm">لم يتم إضافة الفيديو بعد</div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-3 mt-6">
        <div className="justify-self-start">
          {prevLessonId && (
            <Link href={`/lesson/${prevLessonId}`} className={navButtonClass}>→ الدرس السابق</Link>
          )}
        </div>

        <div className="justify-self-center">
          <div className="flex flex-col items-center gap-1.5">
            <button onClick={toggleComplete} disabled={saving || !canMarkComplete} className="btn-primary">
              {completed ? '✓ مكتمل' : 'تحديد كمكتمل'}
            </button>
            {!canMarkComplete && (
              <span className="text-muted2 text-[11.5px] text-center">شاهد الفيديو كاملاً لتتمكن من تحديد الدرس كمكتمل</span>
            )}
          </div>
        </div>

        <div className="justify-self-end">
          {nextLessonId && canMarkComplete && (
            <Link href={`/lesson/${nextLessonId}`} className={navButtonClass}>الدرس التالي ←</Link>
          )}
        </div>
      </div>
    </div>
  );
}
