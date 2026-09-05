'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function LessonError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Lesson page error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
      <span className="text-4xl mb-4">⚠️</span>
      <h1 className="font-cairo font-extrabold text-xl mb-2">تعذّر تحميل هذا الدرس</h1>
      <p className="text-muted text-sm mb-6">حدث خطأ غير متوقع، يمكنك المحاولة مرة أخرى أو العودة إلى لوحة التحكم</p>
      <div className="flex gap-3">
        <button onClick={reset} className="btn-primary">
          إعادة المحاولة
        </button>
        <Link href="/dashboard" className="btn-ghost">
          العودة للوحة التحكم
        </Link>
      </div>
    </div>
  );
}
