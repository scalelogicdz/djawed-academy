import Link from 'next/link';
import type { PlatformAccess } from '@/lib/trialAccess';
import { createAdminClient } from '@/lib/supabase/admin';
import TrialNotice from './TrialNotice';
import StudentNav from './StudentNav';

export default async function TrialDashboard({ access, userId }: { access: PlatformAccess; userId: string }) {
  // Never load protected video IDs, downloads or lesson descriptions for the outline.
  const { data: lessons, error } = access.mode === 'trial'
    ? await createAdminClient().from('lessons').select('id,title,position').eq('module_id', access.moduleId!).order('position').order('id')
    : { data: [], error: null };
  if (error) throw new Error('Trial outline unavailable');
  return <><StudentNav currentUserId={userId} trial />
    <main className="max-w-[940px] mx-auto px-5 py-8">
      <TrialNotice expiresAt={access.expiresAt} expired={access.mode === 'expired'} />
      <h1 className="font-cairo text-2xl font-bold mb-5">الوحدة الأولى</h1>
      <div className="space-y-3">{(lessons ?? []).map((lesson, i) => <Link key={lesson.id} href={`/lesson/${lesson.id}`} className="card block p-4 hover:border-gold/40">
        <span className="text-gold text-sm">الدرس {i + 1}</span><h2 className="font-bold mt-1">{lesson.title}</h2>
      </Link>)}</div>
      <Link href="/course-content" className="btn-ghost inline-flex mt-6">شوف محتوى الدورة</Link>
    </main></>;
}
