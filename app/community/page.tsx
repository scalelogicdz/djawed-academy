import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import CommunityFeed from '@/components/CommunityFeed';

export default async function CommunityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, is_admin')
    .eq('id', user.id)
    .single();

  const { data: rawQuestions } = await supabase
    .from('questions')
    .select('id, body, created_at, student_id, profiles(display_name, is_admin)')
    .order('created_at', { ascending: false });

  const { data: rawReplies } = await supabase
    .from('replies')
    .select('id, body, created_at, question_id, student_id, profiles(display_name, is_admin)')
    .order('created_at', { ascending: true });

  // Supabase's foreign-key select returns `profiles` as an array; normalize to a single object.
  const questions = (rawQuestions ?? []).map((q: any) => ({
    ...q,
    profiles: Array.isArray(q.profiles) ? q.profiles[0] ?? null : q.profiles,
  }));
  const replies = (rawReplies ?? []).map((r: any) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles,
  }));

  return (
    <>
      <StudentNav isAdmin={profile?.is_admin} />
      <section className="max-w-[1140px] mx-auto px-6 py-14">
        <div className="eyebrow">المجتمع</div>
        <h1 className="font-cairo font-extrabold text-[25px] mb-6">اسأل، شارك، وتعلم من الآخرين</h1>

        <CommunityFeed
          currentUserId={user.id}
          currentUserDisplayName={profile?.display_name ?? ''}
          initialQuestions={questions ?? []}
          initialReplies={replies ?? []}
        />
      </section>
    </>
  );
}
