'use client';

import { useState } from 'react';
import type { GuidelinesPageContent, ServicesPageContent } from '@/lib/siteContent';

const fieldClass =
  'w-full bg-white/[0.02] border border-border rounded-lg px-4 py-3 text-[14px] sm:text-[15px] focus:outline-none focus:border-gold transition';
const textareaClass = `${fieldClass} min-h-[105px] resize-y leading-7`;

export default function SiteContentManager({
  initialServices,
  initialGuidelines,
}: {
  initialServices: ServicesPageContent;
  initialGuidelines: GuidelinesPageContent;
}) {
  const [tab, setTab] = useState<'services' | 'guidelines'>('services');
  const [services, setServices] = useState(initialServices);
  const [guidelines, setGuidelines] = useState(initialGuidelines);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(key: 'services' | 'guidelines') {
    setSaving(true);
    setMessage(null);
    setError(null);

    const content = key === 'services' ? services : guidelines;
    const res = await fetch('/api/admin/site-content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, content }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? 'حدث خطأ أثناء الحفظ');
      return;
    }

    setMessage('تم حفظ التغييرات بنجاح.');
  }

  function updateService(index: number, field: 'title' | 'description', value: string) {
    setServices((current) => ({
      ...current,
      services: current.services.map((service, serviceIndex) =>
        serviceIndex === index ? { ...service, [field]: value } : service
      ),
    }));
  }

  function updateGuidelineSection(index: number, value: string) {
    setGuidelines((current) => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, title: value } : section
      ),
    }));
  }

  function updateGuidelineItem(sectionIndex: number, itemIndex: number, value: string) {
    setGuidelines((current) => ({
      ...current,
      sections: current.sections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              items: section.items.map((item, currentItemIndex) =>
                currentItemIndex === itemIndex ? value : item
              ),
            }
          : section
      ),
    }));
  }

  return (
    <div dir="rtl">
      <div className="flex flex-wrap gap-2 mb-7">
        <button
          type="button"
          onClick={() => {
            setTab('services');
            setMessage(null);
            setError(null);
          }}
          className={`px-5 py-2.5 rounded-xl border text-sm font-bold transition ${
            tab === 'services'
              ? 'border-gold/40 bg-gold/[0.1] text-gold'
              : 'border-border text-muted hover:text-text hover:border-white/[0.12]'
          }`}
        >
          صفحة الخدمات
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('guidelines');
            setMessage(null);
            setError(null);
          }}
          className={`px-5 py-2.5 rounded-xl border text-sm font-bold transition ${
            tab === 'guidelines'
              ? 'border-gold/40 bg-gold/[0.1] text-gold'
              : 'border-border text-muted hover:text-text hover:border-white/[0.12]'
          }`}
        >
          القواعد والإرشادات
        </button>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-green-500/20 bg-green-500/[0.06] px-4 py-3 text-sm text-green-300">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {tab === 'services' ? (
        <div className="space-y-5">
          <section className="card p-5 sm:p-7">
            <h2 className="font-cairo font-extrabold text-lg mb-5">النص الرئيسي للصفحة</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-2">الكلمة الصغيرة أعلى العنوان</label>
                <input
                  value={services.eyebrow}
                  onChange={(e) => setServices({ ...services, eyebrow: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-2">العنوان الرئيسي</label>
                <input
                  value={services.heading}
                  onChange={(e) => setServices({ ...services, heading: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted mb-2">الوصف الرئيسي</label>
                <textarea
                  value={services.intro}
                  onChange={(e) => setServices({ ...services, intro: e.target.value })}
                  className={textareaClass}
                />
              </div>
            </div>
          </section>

          {services.services.map((service, index) => (
            <section key={service.image} className="card p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3 mb-5">
                <h2 className="font-cairo font-extrabold text-lg">الخدمة {index + 1}</h2>
                <span className="text-xs text-muted2">الصورة تبقى كما هي</span>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-muted mb-2">اسم الخدمة</label>
                  <input
                    value={service.title}
                    onChange={(e) => updateService(index, 'title', e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-2">وصف الخدمة</label>
                  <textarea
                    value={service.description}
                    onChange={(e) => updateService(index, 'description', e.target.value)}
                    className={textareaClass}
                  />
                </div>
              </div>
            </section>
          ))}

          <section className="card p-5 sm:p-7">
            <h2 className="font-cairo font-extrabold text-lg mb-5">النصوص الإضافية</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-muted mb-2">نص زر الخدمة</label>
                <input
                  value={services.cta}
                  onChange={(e) => setServices({ ...services, cta: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-2">النص أسفل بطاقات الخدمات</label>
                <textarea
                  value={services.footerNote}
                  onChange={(e) => setServices({ ...services, footerNote: e.target.value })}
                  className={textareaClass}
                />
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => save('services')}
              className="btn-primary min-w-[170px] disabled:opacity-60"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ تغييرات الخدمات'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <section className="card p-5 sm:p-7">
            <h2 className="font-cairo font-extrabold text-lg mb-5">رأس صفحة القواعد</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-2">الكلمة الصغيرة أعلى العنوان</label>
                <input
                  value={guidelines.eyebrow}
                  onChange={(e) => setGuidelines({ ...guidelines, eyebrow: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-2">العنوان الرئيسي</label>
                <input
                  value={guidelines.heading}
                  onChange={(e) => setGuidelines({ ...guidelines, heading: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted mb-2">الوصف</label>
                <textarea
                  value={guidelines.intro}
                  onChange={(e) => setGuidelines({ ...guidelines, intro: e.target.value })}
                  className={textareaClass}
                />
              </div>
            </div>
          </section>

          {guidelines.sections.map((section, sectionIndex) => (
            <section key={section.number} className="card p-5 sm:p-7">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 text-gold font-bold inline-flex items-center justify-center">
                  {section.number}
                </span>
                <h2 className="font-cairo font-extrabold text-lg">القسم {section.number}</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-muted mb-2">عنوان القسم</label>
                  <input
                    value={section.title}
                    onChange={(e) => updateGuidelineSection(sectionIndex, e.target.value)}
                    className={fieldClass}
                  />
                </div>

                {section.items.map((item, itemIndex) => (
                  <div key={`${section.number}-${itemIndex}`}>
                    <label className="block text-xs text-muted mb-2">النقطة {itemIndex + 1}</label>
                    <textarea
                      value={item}
                      onChange={(e) => updateGuidelineItem(sectionIndex, itemIndex, e.target.value)}
                      className={textareaClass}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => save('guidelines')}
              className="btn-primary min-w-[190px] disabled:opacity-60"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ تغييرات القواعد'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
