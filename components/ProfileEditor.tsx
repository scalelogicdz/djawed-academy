'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

type EditableProfile = {
  id: string;
  display_name: string;
  bio: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  linkedin_url: string | null;
};

export default function ProfileEditor({ profile }: { profile: EditableProfile }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [instagram, setInstagram] = useState(profile.instagram_url ?? '');
  const [facebook, setFacebook] = useState(profile.facebook_url ?? '');
  const [tiktok, setTiktok] = useState(profile.tiktok_url ?? '');
  const [linkedin, setLinkedin] = useState(profile.linkedin_url ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!displayName.trim() || saving) return;
    setSaving(true);
    setError('');
    setSaved(false);

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName,
        bio,
        instagram_url: instagram,
        facebook_url: facebook,
        tiktok_url: tiktok,
        linkedin_url: linkedin,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? 'تعذر حفظ الملف الشخصي');
      return;
    }

    setSaved(true);
    router.refresh();
  }

  const inputClass =
    'w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-sm text-text outline-none transition focus:border-gold/55 focus:bg-white/[0.035] text-right placeholder:text-muted2/80';

  const fieldLabel = 'block text-[13px] font-bold mb-2 text-text';

  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-[#111925] p-5 sm:p-7 shadow-[0_18px_42px_-30px_rgba(0,0,0,0.9)]" dir="rtl">
      <div className="grid gap-5">
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className={fieldLabel}>الاسم الظاهر</label>
            <span className="text-[10.5px] text-muted2">يظهر في المجتمع والردود</span>
          </div>
          <input
            className={inputClass}
            value={displayName}
            maxLength={50}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="اكتب الاسم الذي تريد ظهوره"
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className={fieldLabel}>نبذة قصيرة</label>
            <span className="text-[10.5px] text-muted2">{bio.length}/240</span>
          </div>
          <textarea
            className={`${inputClass} min-h-[120px] resize-y leading-7`}
            value={bio}
            maxLength={240}
            onChange={(e) => setBio(e.target.value)}
            placeholder="من أنت؟ ماذا تتعلم أو تعمل؟ اكتب نبذة قصيرة تساعد أعضاء المجتمع على معرفتك."
          />
        </div>

        <div className="pt-1">
          <div className="mb-4">
            <div className="text-[14px] font-bold">روابط التواصل</div>
            <p className="text-muted2 text-[11.5px] mt-1">اختياري — أضف فقط الحسابات التي تريد مشاركتها مع أعضاء المنصة.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={fieldLabel}>Instagram</label>
              <input className={inputClass} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/..." inputMode="url" />
            </div>
            <div>
              <label className={fieldLabel}>Facebook</label>
              <input className={inputClass} value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/..." inputMode="url" />
            </div>
            <div>
              <label className={fieldLabel}>TikTok</label>
              <input className={inputClass} value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="https://tiktok.com/@..." inputMode="url" />
            </div>
            <div>
              <label className={fieldLabel}>LinkedIn</label>
              <input className={inputClass} value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." inputMode="url" />
            </div>
          </div>
        </div>

        {(error || saved) && (
          <div className={`rounded-xl border px-4 py-3 text-[12.5px] ${error ? 'border-[#E4756A]/25 bg-[#E4756A]/[0.06] text-[#F0A49C]' : 'border-success/20 bg-success/[0.06] text-success'}`}>
            {error || 'تم حفظ التعديلات بنجاح.'}
          </div>
        )}

        <div className="flex justify-start pt-1">
          <button
            type="button"
            onClick={save}
            disabled={saving || displayName.trim().length < 2}
            aria-busy={saving}
            className="inline-flex w-full sm:w-auto sm:min-w-[170px] items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-br from-gold to-goldSoft text-[#0A0F1A] font-bold text-sm shadow-[0_12px_26px_-18px_rgba(212,177,94,0.7)] disabled:opacity-50 transition"
          >
            {saving && <LoadingSpinner size={15} />}
            {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  );
}
