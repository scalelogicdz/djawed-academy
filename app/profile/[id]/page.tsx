import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import ProfileEditor from '@/components/ProfileEditor';
import LocalizedText from '@/components/LocalizedText';

function initial(name: string) {
  return name?.trim()?.[0] ?? '؟';
}

function SocialLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 text-[13px] font-semibold text-muted hover:text-gold hover:border-gold/35 hover:bg-gold/[0.04] transition"
    >
      <span>{label}</span>
      <span className="text-[11px] opacity-70">↗</span>
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

      <section className="max-w-[900px] mx-auto px-5 sm:px-6 py-9 sm:py-12">
        <div className="mb-5">
          <Link href="/community" className="inline-flex items-center gap-2 text-sm text-muted hover:text-gold transition">
            <span>←</span>
            <span><LocalizedText ar="العودة إلى المجتمع" fr="Retour à la communauté" en="Back to community" /></span>
          </Link>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-gradient-to-br from-[#111925] to-[#0D141F] shadow-[0_24px_54px_-34px_rgba(0,0,0,0.9)] mb-8">
          <div className="h-1 bg-gradient-to-l from-gold/20 via-gold/70 to-transparent" />

          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
              <div className={`avatar-ring ${profile.is_admin ? 'admin' : ''} flex-shrink-0 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.85)]`} style={{ width: 82, height: 82, fontSize: 26 }}>
                {profile.is_admin ? 'DK' : initial(profile.display_name)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h1 className="font-cairo font-extrabold text-[24px] sm:text-[29px] leading-tight">{profile.display_name}</h1>
                  {profile.is_admin && (
                    <span className="coach-badge"><LocalizedText ar="✓ المدرب" fr="✓ Formateur" en="✓ Coach" /></span>
                  )}
                  {isOwnProfile && (
                    <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[10.5px] font-semibold text-muted2">
                      <LocalizedText ar="ملفك الشخصي" fr="Votre profil" en="Your profile" />
                    </span>
                  )}
                </div>

                <p className="text-muted text-[13.5px] sm:text-[14.5px] leading-7 whitespace-pre-wrap max-w-[700px]">
                  {profile.bio?.trim() || (isOwnProfile ? (
                    <LocalizedText
                      ar="أضف نبذة قصيرة عنك ليعرفك أعضاء المجتمع أكثر."
                      fr="Ajoutez une courte bio pour que les membres de la communauté puissent mieux vous connaître."
                      en="Add a short bio so community members can get to know you better."
                    />
                  ) : (
                    <LocalizedText
                      ar="لم يضف هذا المستخدم نبذة بعد."
                      fr="Cet utilisateur n’a pas encore ajouté de bio."
                      en="This user has not added a bio yet."
                    />
                  ))}
                </p>
              </div>
            </div>

            {hasSocialLinks ? (
              <div className="flex flex-wrap gap-2.5 mt-6 pt-5 border-t border-white/[0.06]">
                <SocialLink href={profile.instagram_url} label="Instagram" />
                <SocialLink href={profile.facebook_url} label="Facebook" />
                <SocialLink href={profile.tiktok_url} label="TikTok" />
                <SocialLink href={profile.linkedin_url} label="LinkedIn" />
              </div>
            ) : isOwnProfile ? (
              <div className="mt-6 pt-5 border-t border-white/[0.06] text-[12.5px] text-muted2">
                <LocalizedText
                  ar="يمكنك إضافة روابط حساباتك الاجتماعية من قسم التعديل بالأسفل."
                  fr="Vous pouvez ajouter vos liens sociaux dans la section de modification ci-dessous."
                  en="You can add your social links in the edit section below."
                />
              </div>
            ) : null}
          </div>
        </div>

        {isOwnProfile && (
          <div>
            <div className="eyebrow mb-2"><LocalizedText ar="إعدادات الملف" fr="Paramètres du profil" en="Profile settings" /></div>
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <h2 className="font-cairo font-extrabold text-[21px] sm:text-[23px]">
                  <LocalizedText ar="تعديل معلوماتك" fr="Modifier vos informations" en="Edit your information" />
                </h2>
                <p className="text-muted2 text-[12.5px] mt-1">
                  <LocalizedText
                    ar="هذه المعلومات تظهر لأعضاء المجتمع عند فتح ملفك الشخصي."
                    fr="Ces informations sont visibles par les membres de la communauté lorsqu’ils ouvrent votre profil."
                    en="This information is visible to community members when they open your profile."
                  />
                </p>
              </div>
            </div>
            <ProfileEditor profile={profile} />
          </div>
        )}
      </section>
    </>
  );
}
