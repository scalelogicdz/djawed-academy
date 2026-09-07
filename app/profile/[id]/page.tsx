import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import ProfileEditor from '@/components/ProfileEditor';

function initial(name: string) {
  return name?.trim()?.[0] ?? '؟';
}

function SocialLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-xl border border-border bg-white/[0.02] px-4 py-2.5 text-sm font-semibold text-muted hover:text-gold hover:border-gold/40 transition">
      {label}
    </a>
  );
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: viewer }, { data: profile }] = await Promise.all([
    supabase.from('profiles').select('is_admin').eq('id', user.id).single(),
    supabase
      .from('profiles')
      .select('id, display_name, bio, instagram_url, facebook_url, tiktok_url, linkedin_url, is_admin')
      .eq('id', id)
      .single(),
  ]);

  if (!profile) notFound();

  const isOwnProfile = user.id === profile.id;
  const hasSocialLinks = !!(profile.instagram_url || profile.facebook_url || profile.tiktok_url || profile.linkedin_url);

  return (
    <>
      <StudentNav isAdmin={!!viewer?.is_admin} currentUserId={user.id} />

      <section className="max-w-[900px] mx-auto px-5 sm:px-6 py-10 sm:py-14">
        <div className="mb-5">
          <Link href="/community" className="text-sm text-muted hover:text-gold transition">← العودة إلى المجتمع</Link>
        </div>

        <div className="card p-6 sm:p-8 mb-7" dir="rtl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className={`avatar-ring ${profile.is_admin ? 'admin' : ''} flex-shrink-0`} style={{ width: 76, height: 76, fontSize: 24 }}>
              {profile.is_admin ? 'DK' : initial(profile.display_name)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="font-cairo font-extrabold text-[24px] sm:text-[28px]">{profile.display_name}</h1>
                {profile.is_admin && <span className="coach-badge">✓ المدرب</span>}
              </div>
              <p className="text-muted leading-7 whitespace-pre-wrap">
                {profile.bio?.trim() || (isOwnProfile ? 'أضف نبذة قصيرة عنك ليعرفك أعضاء المجتمع أكثر.' : 'لم يضف هذا المستخدم نبذة بعد.')}
              </p>
            </div>
          </div>

          {hasSocialLinks && (
            <div className="flex flex-wrap gap-2.5 mt-6 pt-5 border-t border-border">
              <SocialLink href={profile.instagram_url} label="Instagram" />
              <SocialLink href={profile.facebook_url} label="Facebook" />
              <SocialLink href={profile.tiktok_url} label="TikTok" />
              <SocialLink href={profile.linkedin_url} label="LinkedIn" />
            </div>
          )}
        </div>

        {isOwnProfile && (
          <div>
            <div className="eyebrow mb-2">الملف الشخصي</div>
            <h2 className="font-cairo font-extrabold text-[21px] mb-4">تعديل معلوماتك</h2>
            <ProfileEditor profile={profile} />
          </div>
        )}
      </section>
    </>
  );
}
