'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/components/LoadingSpinner';

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
  thumbnailUrl,
  prevLessonId,
  nextLessonId,
  isCompleted,
  isLocked,
  requiredLessonTitle,
  requiredLessonId,
}: {
  lesson: Lesson;
  thumbnailUrl: string | null;
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
  const [hasStarted, setHasStarted] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<any>(null);

  const BUNNY_LIBRARY_ID = '744754';
  const embedUrl =
    lesson.video_provider === 'vimeo'
      ? `https://player.vimeo.com/video/${lesson.video_id}?autoplay=0`
      : `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${lesson.video_id}?autoplay=false`;

  useEffect(() => {
    setHasStarted(false);
    setPlayerReady(false);
    setIsPlaying(false);
    setVideoEnded(false);
    playerRef.current = null;
  }, [lesson.id]);

  useEffect(() => {
    if (!hasStarted || isLocked || !lesson.video_id || lesson.video_provider === 'vimeo') return;

    let cancelled = false;

    function attachPlayer() {
      if (cancelled || !iframeRef.current || !window.playerjs) return;
      try {
        const player = new window.playerjs.Player(iframeRef.current);
        playerRef.current = player;

        player.on('ready', () => {
          if (cancelled) return;
          setPlayerReady(true);
          try {
            player.on('play', () => !cancelled && setIsPlaying(true));
            player.on('pause', () => !cancelled && setIsPlaying(false));
            player.on('ended', () => {
              if (!cancelled) {
                setIsPlaying(false);
                setVideoEnded(true);
              }
            });
            player.play();
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
      const player = playerRef.current;
      if (player && typeof player.off === 'function') {
        try {
          player.off('play');
          player.off('pause');
          player.off('ended');
          player.off('ready');
        } catch {}
      }
      playerRef.current = null;
      setPlayerReady(false);
    };
  }, [hasStarted, isLocked, lesson.id, lesson.video_id, lesson.video_provider]);

  function togglePlayback() {
    const player = playerRef.current;
    if (!playerReady || !player) return;
    try {
      if (isPlaying) player.pause(); else player.play();
    } catch {}
  }

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
    if (saving) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

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
    'text-center inline-flex items-center justify-center min-h-12 px-5 py-3 rounded-xl bg-surface2 border border-border text-text font-semibold shadow-sm hover:bg-surface hover:border-gold/40 hover:text-gold transition';

  if (isLocked) {
    return (
      <div className="aspect-video rounded-2xl border border-border overflow-hidden bg-gradient-to-br from-surface2 to-[#070A10] flex flex-col items-center justify-center text-center px-8 gap-3">
        <span className="text-3xl">🔒</span>
        <p className="font-heading font-bold text-[16px]">هذا الدرس مغلق حاليًا</p>
        {requiredLessonTitle && (
          <p className="text-muted text-[13.5px]">أكمل درس <span className="text-text font-semibold">"{requiredLessonTitle}"</span> أولًا لفتح هذا الدرس</p>
        )}
        {requiredLessonId && <Link href={`/lesson/${requiredLessonId}`} className="btn-primary mt-2">الذهاب إلى الدرس المطلوب</Link>}
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface2 to-[#070A10]">
        {lesson.video_id ? (
          hasStarted ? (
            <iframe
              ref={iframeRef}
              src={embedUrl}
              className="w-full h-full rounded-2xl"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setHasStarted(true)}
              className="absolute inset-0 w-full h-full rounded-2xl flex flex-col items-center justify-center gap-3 overflow-hidden text-text group"
            >
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt="صورة الدرس"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-surface2 to-[#070A10]" />
              )}
              <div className="absolute inset-0 bg-black/35" />
              <span className="relative z-10 w-16 h-16 rounded-full bg-[#C9A84C] text-[#100C02] flex items-center justify-center shadow-[0_8px_28px_rgba(201,168,76,0.35)] transition-transform duration-200 group-hover:scale-105">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="translate-x-[1px]">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span className="relative z-10 font-heading font-bold text-[16px] drop-shadow-md">ابدأ الفيديو</span>
            </button>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-sm">لم يتم إضافة الفيديو بعد</div>
        )}
      </div>

      {hasStarted && lesson.video_id && lesson.video_provider !== 'vimeo' && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={togglePlayback}
            disabled={!playerReady}
            aria-busy={!playerReady}
            className="min-w-[170px] inline-flex items-center justify-center gap-2 rounded-xl bg-surface2 border border-border px-5 py-3 text-text font-semibold shadow-sm hover:border-gold/40 hover:text-gold transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {!playerReady ? <LoadingSpinner size={16} /> : <span className="text-[17px]">{isPlaying ? 'Ⅱ' : '▶'}</span>}
            {!playerReady ? 'جارٍ تجهيز الفيديو...' : isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={toggleComplete}
            disabled={saving || !canMarkComplete}
            aria-busy={saving}
            className="min-w-[210px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A84C] px-7 py-3.5 font-heading text-[16px] font-bold text-[#100C02] shadow-[0_8px_24px_rgba(201,168,76,0.22)] transition hover:bg-[#D4B15E] disabled:bg-[#C9A84C] disabled:text-[#100C02] disabled:cursor-not-allowed"
          >
            {saving && <LoadingSpinner size={17} />}
            {saving ? 'جارٍ الحفظ...' : completed ? '✓ مكتمل' : 'تحديد كمكتمل'}
          </button>
          {!canMarkComplete && <span className="text-muted2 text-[11.5px] text-center px-3">شاهد الفيديو كاملاً لتتمكن من تحديد الدرس كمكتمل</span>}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <div className="flex justify-start">
            {prevLessonId && <Link href={`/lesson/${prevLessonId}`} className={`${navButtonClass} w-full sm:w-auto`}>→ الدرس السابق</Link>}
          </div>
          <div className="flex justify-end">
            {nextLessonId && canMarkComplete && <Link href={`/lesson/${nextLessonId}`} className={`${navButtonClass} w-full sm:w-auto`}>الدرس التالي ←</Link>}
          </div>
        </div>
      </div>
    </div>
  );
}
