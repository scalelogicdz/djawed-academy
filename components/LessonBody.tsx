'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useLanguage } from '@/components/LanguageProvider';

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
  const { language } = useLanguage();
  const [completed, setCompleted] = useState(isCompleted);
  const [saving, setSaving] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<any>(null);

  const copy = language === 'fr'
    ? {
        lockedTitle: 'Cette leçon est actuellement verrouillée',
        lockedText: (title: string) => <>Terminez d’abord la leçon <span className="text-text font-semibold">« {title} »</span> pour débloquer celle-ci.</>,
        goRequired: 'Aller à la leçon requise',
        imageAlt: 'Miniature de la leçon',
        startVideo: 'Démarrer la vidéo',
        pauseAnytime: 'Vous pouvez mettre en pause et reprendre à tout moment',
        noVideo: 'La vidéo n’a pas encore été ajoutée',
        preparing: 'Préparation de la vidéo...',
        pause: 'Pause',
        play: 'Lecture',
        completedTitle: 'Cette leçon est terminée',
        finishTitle: 'Terminez la leçon lorsque vous avez fini',
        completedText: 'Vous pouvez revoir la leçon à tout moment ou passer à la suivante.',
        canCompleteText: 'Lorsque vous êtes prêt, marquez la leçon comme terminée pour enregistrer votre progression.',
        mustWatchText: 'Regardez d’abord la vidéo jusqu’à la fin, puis vous pourrez marquer la leçon comme terminée.',
        saving: 'Enregistrement...',
        completed: '✓ Terminée',
        markComplete: 'Marquer comme terminée',
        back: 'Retour',
        previousLesson: 'Leçon précédente',
        continueLearning: 'Continuer',
        nextLesson: 'Leçon suivante',
        wellDone: 'Bravo',
        backToCourse: 'Retour au contenu du cours',
      }
    : language === 'en'
      ? {
          lockedTitle: 'This lesson is currently locked',
          lockedText: (title: string) => <>Complete <span className="text-text font-semibold">“{title}”</span> first to unlock this lesson.</>,
          goRequired: 'Go to required lesson',
          imageAlt: 'Lesson thumbnail',
          startVideo: 'Start video',
          pauseAnytime: 'You can pause and continue at any time',
          noVideo: 'The video has not been added yet',
          preparing: 'Preparing video...',
          pause: 'Pause',
          play: 'Play',
          completedTitle: 'This lesson is completed',
          finishTitle: 'Complete the lesson when you finish',
          completedText: 'You can rewatch the lesson at any time or continue to the next lesson.',
          canCompleteText: 'When you are ready, mark the lesson as completed to save your progress.',
          mustWatchText: 'Watch the full video first, then you will be able to mark the lesson as completed.',
          saving: 'Saving...',
          completed: '✓ Completed',
          markComplete: 'Mark as completed',
          back: 'Back',
          previousLesson: 'Previous lesson',
          continueLearning: 'Continue learning',
          nextLesson: 'Next lesson',
          wellDone: 'Well done',
          backToCourse: 'Back to course content',
        }
      : {
          lockedTitle: 'هذا الدرس مغلق حاليًا',
          lockedText: (title: string) => <>أكمل درس <span className="text-text font-semibold">"{title}"</span> أولًا لفتح هذا الدرس.</>,
          goRequired: 'الذهاب إلى الدرس المطلوب',
          imageAlt: 'صورة الدرس',
          startVideo: 'ابدأ الفيديو',
          pauseAnytime: 'يمكنك الإيقاف والمتابعة في أي وقت',
          noVideo: 'لم يتم إضافة الفيديو بعد',
          preparing: 'جارٍ تجهيز الفيديو...',
          pause: 'إيقاف مؤقت',
          play: 'تشغيل',
          completedTitle: 'تم إكمال هذا الدرس',
          finishTitle: 'أكمل الدرس عندما تنتهي',
          completedText: 'يمكنك إعادة مشاهدة الدرس في أي وقت، أو المتابعة إلى الدرس التالي.',
          canCompleteText: 'عندما تكون جاهزًا، حدّد الدرس كمكتمل لحفظ تقدمك.',
          mustWatchText: 'شاهد الفيديو كاملاً أولًا، وبعدها سيتاح لك تحديد الدرس كمكتمل.',
          saving: 'جارٍ الحفظ...',
          completed: '✓ مكتمل',
          markComplete: 'تحديد كمكتمل',
          back: 'العودة',
          previousLesson: 'الدرس السابق',
          continueLearning: 'متابعة التعلم',
          nextLesson: 'الدرس التالي',
          wellDone: 'أحسنت',
          backToCourse: 'العودة إلى محتوى الدورة',
        };

  const backArrow = language === 'ar' ? '→' : '←';
  const nextArrow = language === 'ar' ? '←' : '→';

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
    'group inline-flex min-h-14 w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 sm:px-5 py-3.5 text-text shadow-[0_12px_28px_-24px_rgba(0,0,0,0.9)] transition hover:border-gold/30 hover:bg-gold/[0.045] hover:text-gold';

  if (isLocked) {
    return (
      <div className="rounded-[22px] border border-white/[0.08] overflow-hidden bg-gradient-to-br from-surface2 to-[#070A10] px-6 sm:px-8 py-12 sm:py-16 text-center shadow-[0_20px_50px_-34px_rgba(0,0,0,0.9)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-2xl">🔒</div>
        <p className="font-heading font-bold text-[18px] sm:text-[20px] mb-2">{copy.lockedTitle}</p>
        {requiredLessonTitle && (
          <p className="mx-auto max-w-[560px] text-muted text-[13.5px] sm:text-[14px] leading-7">
            {copy.lockedText(requiredLessonTitle)}
          </p>
        )}
        {requiredLessonId && (
          <Link href={`/lesson/${requiredLessonId}`} className="btn-primary mt-6 inline-flex">
            {copy.goRequired}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-[22px] border border-white/[0.08] bg-[#0B111B] p-1.5 sm:p-2 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.95)]">
        <div className="relative aspect-video overflow-hidden rounded-[17px] sm:rounded-[18px] border border-white/[0.05] bg-gradient-to-br from-surface2 to-[#070A10]">
          {lesson.video_id ? (
            hasStarted ? (
              <iframe
                ref={iframeRef}
                src={embedUrl}
                className="w-full h-full rounded-[17px] sm:rounded-[18px]"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                onClick={() => setHasStarted(true)}
                className="absolute inset-0 w-full h-full rounded-[17px] sm:rounded-[18px] flex flex-col items-center justify-center gap-3 overflow-hidden text-text group"
              >
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={copy.imageAlt}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-surface2 to-[#070A10]" />
                )}
                <div className="absolute inset-0 bg-black/40" />
                <span className="relative z-10 w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full bg-[#C9A84C] text-[#100C02] flex items-center justify-center shadow-[0_10px_32px_rgba(201,168,76,0.35)] transition-transform duration-200 group-hover:scale-105">
                  <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor" className="translate-x-[1px]">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span className="relative z-10 font-heading font-bold text-[16px] sm:text-[17px] drop-shadow-md">{copy.startVideo}</span>
                <span className="relative z-10 text-[11.5px] sm:text-[12px] text-white/65">{copy.pauseAnytime}</span>
              </button>
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-sm">{copy.noVideo}</div>
          )}
        </div>
      </div>

      {hasStarted && lesson.video_id && lesson.video_provider !== 'vimeo' && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={togglePlayback}
            disabled={!playerReady}
            aria-busy={!playerReady}
            className="min-w-[180px] inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.025] border border-white/[0.08] px-5 py-3 text-text font-semibold shadow-sm hover:border-gold/35 hover:bg-gold/[0.035] hover:text-gold transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {!playerReady ? <LoadingSpinner size={16} /> : <span className="text-[17px]">{isPlaying ? 'Ⅱ' : '▶'}</span>}
            {!playerReady ? copy.preparing : isPlaying ? copy.pause : copy.play}
          </button>
        </div>
      )}

      <div className="mt-6 sm:mt-7 rounded-[20px] border border-white/[0.07] bg-white/[0.018] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold ${completed ? 'bg-success/15 text-success' : 'bg-gold/[0.08] text-gold'}`}>
                {completed ? '✓' : '•'}
              </span>
              <p className="font-cairo font-bold text-[15px] sm:text-[16px]">
                {completed ? copy.completedTitle : copy.finishTitle}
              </p>
            </div>
            <p className="text-muted2 text-[12px] sm:text-[12.5px] leading-6 ps-9">
              {completed
                ? copy.completedText
                : canMarkComplete
                  ? copy.canCompleteText
                  : copy.mustWatchText}
            </p>
          </div>

          <button
            onClick={toggleComplete}
            disabled={saving || !canMarkComplete}
            aria-busy={saving}
            className="w-full sm:w-auto sm:min-w-[210px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A84C] px-6 py-3.5 font-heading text-[15px] sm:text-[16px] font-bold text-[#100C02] shadow-[0_8px_24px_rgba(201,168,76,0.2)] transition hover:bg-[#D4B15E] disabled:bg-[#C9A84C] disabled:text-[#100C02] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {saving && <LoadingSpinner size={17} />}
            {saving ? copy.saving : completed ? copy.completed : copy.markComplete}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {prevLessonId ? (
          <Link href={`/lesson/${prevLessonId}`} className={navButtonClass}>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-muted group-hover:text-gold">{backArrow}</span>
            <span className="min-w-0 text-start">
              <span className="block text-[11px] text-muted2 mb-0.5">{copy.back}</span>
              <span className="block text-[13.5px] sm:text-[14px] font-bold">{copy.previousLesson}</span>
            </span>
          </Link>
        ) : (
          <div className="hidden sm:block" />
        )}

        {nextLessonId && canMarkComplete ? (
          <Link href={`/lesson/${nextLessonId}`} className={`${navButtonClass} sm:justify-end`}>
            <span className="min-w-0 text-start flex-1 sm:flex-none">
              <span className="block text-[11px] text-muted2 mb-0.5">{copy.continueLearning}</span>
              <span className="block text-[13.5px] sm:text-[14px] font-bold">{copy.nextLesson}</span>
            </span>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-muted group-hover:text-gold">{nextArrow}</span>
          </Link>
        ) : !nextLessonId && completed ? (
          <Link href={`/course-content?lesson=${lesson.id}`} className={`${navButtonClass} sm:justify-end`}>
            <span className="min-w-0 text-start flex-1 sm:flex-none">
              <span className="block text-[11px] text-success/80 mb-0.5">{copy.wellDone}</span>
              <span className="block text-[13.5px] sm:text-[14px] font-bold text-success">{copy.backToCourse}</span>
            </span>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-success/15 bg-success/[0.05] text-success">✓</span>
          </Link>
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>
    </div>
  );
}
