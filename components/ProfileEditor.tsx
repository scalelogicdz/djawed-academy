'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

  const inputClass = 'w-full rounded-xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-text outline-none transition focus:border-gold text-right';

  return (
    <div className="card p-6 sm:p-7 space-y-5" dir="rtl">
      <div>
        <label className="block text-sm font-bold mb-2">الاسم الظاهر</label>
        <input className={inputClass} value={displayName} maxLength={50} onChange={(e) => setDisplayName(e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-bold mb-2">نبذة قصيرة</label>
        <textarea className={`${inputClass} min-h-[110px] resize-y`} value={bio} maxLength={240} onChange={(e) => setBio(e.target.value)} placeholder="اكتب نبذة قصيرة عنك..." />
        <div className="text-[11px] text-muted2 mt-1">{bio.length}/240</div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold mb-2">Instagram</label>
          <input className={inputClass} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/..." />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Facebook</label>
          <input className={inputClass} value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/..." />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">TikTok</label>
          <input className={inputClass} value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="https://tiktok.com/@..." />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">LinkedIn</label>
          <input className={inputClass} value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." />
        </div>
      </div>

      {error && <p className="text-[#E4756A] text-sm">{error}</p>}
      {saved && <p className="text-gold text-sm">تم حفظ التعديلات بنجاح.</p>}

      <div className="flex justify-start">
        <button type="button" onClick={save} disabled={saving || displayName.trim().length < 2} className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-gold to-goldSoft text-[#0A0F1A] font-bold text-sm disabled:opacity-50">
          {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>
    </div>
  );
}
