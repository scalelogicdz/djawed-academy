'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useLanguage } from '@/components/LanguageProvider';

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
  const { language } = useLanguage();
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [instagram, setInstagram] = useState(profile.instagram_url ?? '');
  const [facebook, setFacebook] = useState(profile.facebook_url ?? '');
  const [tiktok, setTiktok] = useState(profile.tiktok_url ?? '');
  const [linkedin, setLinkedin] = useState(profile.linkedin_url ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const copy = language === 'fr'
    ? {
        saveError: 'Impossible d’enregistrer le profil',
        displayName: 'Nom affiché',
        displayHint: 'Visible dans la communauté et les réponses',
        displayPlaceholder: 'Saisissez le nom à afficher',
        bio: 'Courte bio',
        bioPlaceholder: 'Qui êtes-vous ? Qu’apprenez-vous ou que faites-vous ? Écrivez une courte présentation.',
        social: 'Liens sociaux',
        socialHint: 'Facultatif — ajoutez uniquement les comptes que vous souhaitez partager avec les membres.',
        saved: 'Modifications enregistrées avec succès.',
        saving: 'Enregistrement...',
        save: 'Enregistrer les modifications',
      }
    : language === 'en'
      ? {
          saveError: 'Could not save profile',
          displayName: 'Display name',
          displayHint: 'Shown in the community and replies',
          displayPlaceholder: 'Enter the name you want displayed',
          bio: 'Short bio',
          bioPlaceholder: 'Who are you? What are you learning or working on? Write a short introduction.',
          social: 'Social links',
          socialHint: 'Optional — only add accounts you want to share with platform members.',
          saved: 'Changes saved successfully.',
          saving: 'Saving...',
          save: 'Save changes',
        }
      : {
          saveError: 'تعذر حفظ الملف الشخصي',
          displayName: 'الاسم الظاهر',
          displayHint: 'يظهر في المجتمع والردود',
          displayPlaceholder: 'اكتب الاسم الذي تريد ظهوره',
          bio: 'نبذة قصيرة',
          bioPlaceholder: 'من أنت؟ ماذا تتعلم أو تعمل؟ اكتب نبذة قصيرة تساعد أعضاء المجتمع على معرفتك.',
          social: 'روابط التواصل',
          socialHint: 'اختياري — أضف فقط الحسابات التي تريد مشاركتها مع أعضاء المنصة.',
          saved: 'تم حفظ التعديلات بنجاح.',
          saving: 'جارٍ الحفظ...',
          save: 'حفظ التعديلات',
        };

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
      setError(data.error ?? copy.saveError);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  const inputClass =
    'w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-sm text-text outline-none transition focus:border-gold/55 focus:bg-white/[0.035] text-start placeholder:text-muted2/80';

  const fieldLabel = 'block text-[13px] font-bold mb-2 text-text';

  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-[#111925] p-5 sm:p-7 shadow-[0_18px_42px_-30px_rgba(0,0,0,0.9)]">
      <div className="grid gap-5">
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className={fieldLabel}>{copy.displayName}</label>
            <span className="text-[10.5px] text-muted2">{copy.displayHint}</span>
          </div>
          <input
            className={inputClass}
            value={displayName}
            maxLength={50}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={copy.displayPlaceholder}
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className={fieldLabel}>{copy.bio}</label>
            <span className="text-[10.5px] text-muted2">{bio.length}/240</span>
          </div>
          <textarea
            className={`${inputClass} min-h-[120px] resize-y leading-7`}
            value={bio}
            maxLength={240}
            onChange={(e) => setBio(e.target.value)}
            placeholder={copy.bioPlaceholder}
          />
        </div>

        <div className="pt-1">
          <div className="mb-4">
            <div className="text-[14px] font-bold">{copy.social}</div>
            <p className="text-muted2 text-[11.5px] mt-1">{copy.socialHint}</p>
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
            {error || copy.saved}
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
            {saving ? copy.saving : copy.save}
          </button>
        </div>
      </div>
    </div>
  );
}
