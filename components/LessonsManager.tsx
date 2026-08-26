'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Course = { id: string; title: string };
type ModuleRow = { id: string; course_id: string; title: string; position: number };
type LessonRow = {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_id: string | null;
  video_provider: string | null;
  resource_url: string | null;
  position: number;
};

export default function LessonsManager({
  courses,
  initialModules,
  initialLessons,
}: {
  courses: Course[];
  initialModules: ModuleRow[];
  initialLessons: LessonRow[];
}) {
  const router = useRouter();
  const [modules, setModules] = useState(initialModules);
  const [lessons, setLessons] = useState(initialLessons);
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.id ?? '');
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [lessonForms, setLessonForms] = useState<Record<string, boolean>>({});
  const [lessonDraft, setLessonDraft] = useState({
    title: '',
    description: '',
    videoId: '',
    videoProvider: 'bunny',
    resourceUrl: '',
  });

  async function addModule() {
    if (!newModuleTitle.trim() || !selectedCourse) return;
    const res = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'module',
        courseId: selectedCourse,
        title: newModuleTitle.trim(),
        position: modules.filter((m) => m.course_id === selectedCourse).length,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setModules([...modules, data.module]);
      setNewModuleTitle('');
      router.refresh();
    }
  }

  async function addLesson(moduleId: string) {
    if (!lessonDraft.title.trim()) return;
    const res = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'lesson',
        moduleId,
        title: lessonDraft.title.trim(),
        description: lessonDraft.description.trim() || null,
        videoId: lessonDraft.videoId.trim() || null,
        videoProvider: lessonDraft.videoProvider,
        resourceUrl: lessonDraft.resourceUrl.trim() || null,
        position: lessons.filter((l) => l.module_id === moduleId).length,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setLessons([...lessons, data.lesson]);
      setLessonDraft({ title: '', description: '', videoId: '', videoProvider: 'bunny', resourceUrl: '' });
      setLessonForms({ ...lessonForms, [moduleId]: false });
      router.refresh();
    }
  }

  const courseModules = modules.filter((m) => m.course_id === selectedCourse);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-8">
        {courses.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCourse(c.id)}
            className={`px-4 py-2 rounded-lg text-sm font-cairo font-semibold transition ${
              selectedCourse === c.id ? 'bg-gradient-to-br from-gold to-goldSoft text-[#0A0F1A]' : 'text-muted border border-border'
            }`}
          >
            {c.title}
          </button>
        ))}
      </div>

      <div className="card p-5 mb-7 flex gap-3">
        <input
          value={newModuleTitle}
          onChange={(e) => setNewModuleTitle(e.target.value)}
          placeholder="اسم الوحدة الجديدة (مثال: الوحدة 3: التحسين)"
          className="flex-1 bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold"
        />
        <button className="btn-primary !py-2.5" onClick={addModule}>
          + إضافة وحدة
        </button>
      </div>

      {courseModules.map((m) => (
        <div key={m.id} className="card p-6 mb-5">
          <h3 className="font-cairo font-bold text-gold text-sm uppercase tracking-wide mb-4">{m.title}</h3>

          {lessons
            .filter((l) => l.module_id === m.id)
            .map((l) => (
              <div key={l.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0 text-sm">
                <span>{l.title}</span>
                <span className="text-muted2 text-xs">{l.video_id ? '🎬 فيديو مضاف' : 'بلا فيديو'}</span>
              </div>
            ))}

          {lessonForms[m.id] ? (
            <div className="mt-4 space-y-3">
              <input
                value={lessonDraft.title}
                onChange={(e) => setLessonDraft({ ...lessonDraft, title: e.target.value })}
                placeholder="عنوان الدرس"
                className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold"
              />
              <textarea
                value={lessonDraft.description}
                onChange={(e) => setLessonDraft({ ...lessonDraft, description: e.target.value })}
                placeholder="وصف الدرس (اختياري)"
                rows={2}
                className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold resize-none"
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <select
                  value={lessonDraft.videoProvider}
                  onChange={(e) => setLessonDraft({ ...lessonDraft, videoProvider: e.target.value })}
                  className="bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold"
                >
                  <option value="bunny">Bunny Stream</option>
                  <option value="vimeo">Vimeo</option>
                </select>
                <input
                  value={lessonDraft.videoId}
                  onChange={(e) => setLessonDraft({ ...lessonDraft, videoId: e.target.value })}
                  placeholder="معرّف الفيديو (Video ID)"
                  className="bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <input
                value={lessonDraft.resourceUrl}
                onChange={(e) => setLessonDraft({ ...lessonDraft, resourceUrl: e.target.value })}
                placeholder="رابط الملف المرفق (اختياري)"
                className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold"
              />
              <div className="flex gap-2 justify-end">
                <button className="btn-ghost !py-2 !px-4 text-xs" onClick={() => setLessonForms({ ...lessonForms, [m.id]: false })}>
                  إلغاء
                </button>
                <button className="btn-primary !py-2 !px-4 text-xs" onClick={() => addLesson(m.id)}>
                  حفظ الدرس
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn-ghost !py-2 !px-4 text-xs mt-4"
              onClick={() => setLessonForms({ ...lessonForms, [m.id]: true })}
            >
              + إضافة درس
            </button>
          )}
        </div>
      ))}

      {courseModules.length === 0 && (
        <p className="text-muted text-sm">لا توجد وحدات بعد لهذه الدورة. أضف واحدة أعلاه.</p>
      )}
    </div>
  );
}
