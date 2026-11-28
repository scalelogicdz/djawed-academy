import { communityProfiles } from '@/lib/communityProfiles';
import { getPlatformAccess } from '@/lib/trialAccess';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import CommunityFeed from '@/components/CommunityFeed';
import LocalizedText from '@/components/LocalizedText';

export default async function CommunityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if((await getPlatformAccess(supabase,user.id)).mode!=='full')redirect('/course-content');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, is_admin')
    .eq('id', user.id)
    .single();

  const { data: rawQuestions } = await supabase
    .from('questions')
    .select('id, body, image_url, created_at, student_id')
    .order('created_at', { ascending: false });

  const { data: rawReplies } = await supabase
    .from('replies')
    .select('id, body, created_at, question_id, student_id')
    .order('created_at', { ascending: true });

  const memberProfiles=await communityProfiles(supabase,[...(rawQuestions??[]),...(rawReplies??[])].map(row=>row.student_id));
  const byId=new Map(memberProfiles.map(profile=>[profile.id,profile]));
  const questions = (rawQuestions ?? []).map((q: any) => ({
    ...q,
    profiles: byId.get(q.student_id) ?? null,
  }));
  const replies = (rawReplies ?? []).map((r: any) => ({
    ...r,
    profiles: byId.get(r.student_id) ?? null,
  }));

  return (
    <>
      <StudentNav isAdmin={profile?.is_admin} currentUserId={user.id} />

      <section className="max-w-[1140px] mx-auto px-5 sm:px-6 py-9 sm:py-12">
        <div className="mb-7 sm:mb-9 rounded-[22px] border border-white/[0.07] bg-gradient-to-br from-[#111925] to-[#0D141F] px-5 sm:px-7 py-6 sm:py-7 shadow-[0_20px_46px_-32px_rgba(0,0,0,0.9)]">
          <div className="eyebrow mb-2">
            <LocalizedText ar="المجتمع" fr="Communauté" en="Community" />
          </div>
          <h1 className="font-cairo font-extrabold text-[25px] sm:text-[30px] leading-snug mb-2">
            <LocalizedText
              ar="اسأل، شارك، وتعلّم مع أعضاء المنصة"
              fr="Posez vos questions, partagez et apprenez avec la communauté"
              en="Ask, share, and learn with the community"
            />
          </h1>
          <p className="text-muted text-[13.5px] sm:text-[14.5px] leading-7 max-w-[720px]">
            <LocalizedText
              ar="اطرح سؤالك بوضوح، شارك تجربتك، وادخل في النقاشات التي تساعدك على التقدم بشكل أسرع."
              fr="Posez votre question clairement, partagez votre expérience et participez aux discussions qui vous aident à progresser plus vite."
              en="Ask clear questions, share your experience, and join discussions that help you progress faster."
            />
          </p>
        </div>

        <Suspense fallback={null}>
          <CommunityFeed
            currentUserId={user.id}
            currentUserDisplayName={profile?.display_name ?? ''}
            currentUserIsAdmin={!!profile?.is_admin}
            initialQuestions={questions ?? []}
            initialReplies={replies ?? []}
          />
        </Suspense>
      </section>
    </>
  );
}
