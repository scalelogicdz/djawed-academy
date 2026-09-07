'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function SupportForm({
  userId,
  defaultName,
  defaultEmail,
}: {
  userId: string;
  defaultName: string;
  defaultEmail: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (!cleanName || !cleanEmail || !cleanSubject || !cleanMessage) {
      setError('يرجى إكمال جميع الحقول.');
      return;
    }

    setSending(true);
    setError('');

    const { error: insertError } = await supabase.from('support_requests').insert({
      student_id: userId,
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
    });

    if (insertError) {
      setSending(false);
      setError('تعذر إرسال طلبك حاليًا. حاول مرة أخرى.');
      return;
    }

    router.push('/support/thank-you');
  }

  const inputClass =
    'w-full rounded-xl border border-border bg-[#111825] px-4 py-3.5 text-text outline-none transition placeholder:text-muted2 focus:border-gold/60';

  return (
    <form onSubmit={handleSubmit} className="card p-5 sm:p-7 space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block font-cairo font-semibold text-sm mb-2">الاسم</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
        </label>

        <label className="block">
          <span className="block font-cairo font-semibold text-sm mb-2">البريد الإلكتروني</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            dir="ltr"
            required
          />
        </label>
      </div>

      <label className="block">
        <span className="block font-cairo font-semibold text-sm mb-2">الموضوع</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={inputClass}
          placeholder="مثال: سؤال بخصوص الدورة"
          maxLength={160}
          required
        />
      </label>

      <label className="block">
        <span className="block font-cairo font-semibold text-sm mb-2">رسالتك</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${inputClass} min-h-[180px] resize-y`}
          placeholder="اكتب سؤالك أو طلبك بالتفصيل..."
          maxLength={3000}
          required
        />
      </label>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        aria-busy={sending}
        className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2"
      >
        {sending && <LoadingSpinner size={17} />}
        {sending ? 'جارٍ الإرسال...' : 'إرسال للإدارة'}
      </button>
    </form>
  );
}
