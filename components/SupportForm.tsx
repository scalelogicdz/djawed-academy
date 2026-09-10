'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useLanguage } from '@/components/LanguageProvider';

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
  const { language } = useLanguage();
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const copy = language === 'fr'
    ? {
        required: 'Veuillez remplir tous les champs.',
        failed: 'Impossible d’envoyer votre demande pour le moment. Réessayez.',
        name: 'Nom',
        email: 'Adresse e-mail',
        subject: 'Sujet',
        subjectPlaceholder: 'Exemple : question concernant le cours',
        message: 'Votre message',
        messagePlaceholder: 'Décrivez votre question ou votre demande...',
        sending: 'Envoi...',
        send: "Envoyer à l'administration",
      }
    : language === 'en'
      ? {
          required: 'Please complete all fields.',
          failed: 'Your request could not be sent right now. Please try again.',
          name: 'Name',
          email: 'Email address',
          subject: 'Subject',
          subjectPlaceholder: 'Example: question about the course',
          message: 'Your message',
          messagePlaceholder: 'Describe your question or request...',
          sending: 'Sending...',
          send: 'Send to administration',
        }
      : {
          required: 'يرجى إكمال جميع الحقول.',
          failed: 'تعذر إرسال طلبك حاليًا. حاول مرة أخرى.',
          name: 'الاسم',
          email: 'البريد الإلكتروني',
          subject: 'الموضوع',
          subjectPlaceholder: 'مثال: سؤال بخصوص الدورة',
          message: 'رسالتك',
          messagePlaceholder: 'اكتب سؤالك أو طلبك بالتفصيل...',
          sending: 'جارٍ الإرسال...',
          send: 'إرسال للإدارة',
        };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (!cleanName || !cleanEmail || !cleanSubject || !cleanMessage) {
      setError(copy.required);
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
      setError(copy.failed);
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
          <span className="block font-cairo font-semibold text-sm mb-2">{copy.name}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
        </label>

        <label className="block">
          <span className="block font-cairo font-semibold text-sm mb-2">{copy.email}</span>
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
        <span className="block font-cairo font-semibold text-sm mb-2">{copy.subject}</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={inputClass}
          placeholder={copy.subjectPlaceholder}
          maxLength={160}
          required
        />
      </label>

      <label className="block">
        <span className="block font-cairo font-semibold text-sm mb-2">{copy.message}</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${inputClass} min-h-[180px] resize-y`}
          placeholder={copy.messagePlaceholder}
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
        {sending ? copy.sending : copy.send}
      </button>
    </form>
  );
}
