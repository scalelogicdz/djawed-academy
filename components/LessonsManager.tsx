'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Course = { id: string; title: string };
type ModuleRow = { id: string; course_id: string; title: string; description: string | null; thumbnail_url: string | null; position: number };
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
type QuizQuestionRow = {
  id: string;
  lesson_id: string;
  question: string;
  options: string[];
  correct_index: number;
  position: number;
};

const emptyLessonDraft = { title: '', description: '', videoId: '', videoProvider: 'bunny', resourceUrl: '' };
const emptyModuleDraft = { title: '', description: '', thumbnailUrl: '' };
const emptyQuizDraft = { question: '', options: ['', ''], correctIndex: 0 };

export default function LessonsManager({
  courses,
  initialModules,
  initialLessons,
  initialQuizQuestions,
}: {
  courses: Course[];
  initialModules: ModuleRow[];
  initialLessons: LessonRow[];
  initialQuizQuestions: QuizQuestionRow[];
}) {
  const router = useRouter();
  const [modules, setModules] = useState(initialModules);
  const [lessons, setLessons] = useState(initialLessons);
  const [quizQuestions, setQuizQuestions] = useState(initialQuizQuestions);
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.id ?? '');
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [lessonForms, setLessonForms] = useState<Record<string, boolean>>({});
  const [lessonDraft, setLessonDraft] = useState(emptyLessonDraft);

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editLessonDraft, setEditLessonDraft] = useState(emptyLessonDraft);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);

  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editModuleDraft, setEditModuleDraft] = useState(emptyModuleDraft);
  const [savingModuleEdit, setSavingModuleEdit] = useState(false);

  const [openQuizForLesson, setOpenQuizForLesson] = useState<string | null>(null);
  const [quizDraft, setQuizDraft] = useState(emptyQuizDraft);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuizDraft, setEditQuizDraft] = useState(emptyQuizDraft);

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

  function startEditingModule(m: ModuleRow) {
    setEditingModuleId(m.id);
    setEditModuleDraft({
      title: m.title,
      description: m.description ?? '',
      thumbnailUrl: m.thumbnail_url ?? '',
    });
  }

  async function saveModuleEdit(moduleId: string) {
    if (!editModuleDraft.title.trim()) return;
    setSavingModuleEdit(true);
    const res = await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'module',
        id: moduleId,
        title: editModuleDraft.title.trim(),
        description: editModuleDraft.description.trim() || null,
        thumbnailUrl: editModuleDraft.thumbnailUrl.trim() || null,
      }),
    });
    const data = await res.json();
    setSavingModuleEdit(false);
    if (res.ok) {
      setModules(modules.map((m) => (m.id === moduleId ? data.module : m)));
      setEditingModuleId(null);
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
      setLessonDraft(emptyLessonDraft);
      setLessonForms({ ...lessonForms, [moduleId]: false });
      router.refresh();
    }
  }

  function startEditingLesson(lesson: LessonRow) {
    setEditingLessonId(lesson.id);
    setEditLessonDraft({
      title: lesson.title,
      description: lesson.description ?? '',
      videoId: lesson.video_id ?? '',
      videoProvider: lesson.video_provider ?? 'bunny',
      resourceUrl: lesson.resource_url ?? '',
    });
  }

  function cancelEditingLesson() {
    setEditingLessonId(null);
    setEditLessonDraft(emptyLessonDraft);
  }

  async function saveLessonEdit(lessonId: string) {
    if (!editLessonDraft.title.trim()) return;
    setSavingEdit(true);
    const res = await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'lesson',
        id: lessonId,
        title: editLessonDraft.title.trim(),
        description: editLessonDraft.description.trim() || null,
        videoId: editLessonDraft.videoId.trim() || null,
        videoProvider: editLessonDraft.videoProvider,
        resourceUrl: editLessonDraft.resourceUrl.trim() || null,
      }),
    });
    const data = await res.json();
    setSavingEdit(false);
    if (res.ok) {
      setLessons(lessons.map((l) => (l.id === lessonId ? data.lesson : l)));
      setEditingLessonId(null);
      setEditLessonDraft(emptyLessonDraft);
      router.refresh();
    }
  }

  async function deleteLesson(lessonId: string, lessonTitle: string) {
    const confirmed = window.confirm(`هل أنت متأكد من حذف الدرس "${lessonTitle}"؟ لا يمكن التراجع عن هذا الإجراء.`);
    if (!confirmed) return;

    setDeletingLessonId(lessonId);
    const res = await fetch('/api/admin/content', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'lesson', id: lessonId }),
    });
    setDeletingLessonId(null);
    if (res.ok) {
      setLessons(lessons.filter((l) => l.id !== lessonId));
      router.refresh();
    }
  }

  function updateDraftOption(draft: typeof quizDraft, setDraft: (d: typeof quizDraft) => void, index: number, value: string) {
    const next = [...draft.options];
    next[index] = value;
    setDraft({ ...draft, options: next });
  }

  function addOptionField(draft: typeof quizDraft, setDraft: (d: typeof quizDraft) => void) {
    setDraft({ ...draft, options: [...draft.options, ''] });
  }

  function removeOptionField(draft: typeof quizDraft, setDraft: (d: typeof quizDraft) => void, index: number) {
    if (draft.options.length <= 2) return;
    const next = draft.options.filter((_, i) => i !== index);
    const newCorrect = draft.correctIndex >= next.length ? 0 : draft.correctIndex;
    setDraft({ ...draft, options: next, correctIndex: newCorrect });
  }

  async function addQuizQuestion(lessonId: string) {
    const cleanOptions = quizDraft.options.map((o) => o.trim()).filter(Boolean);
    if (!quizDraft.question.trim() || cleanOptions.length < 2) return;
    const res = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'quizQuestion',
        lessonId,
        question: quizDraft.question.trim(),
        options: cleanOptions,
        correctIndex: quizDraft.correctIndex,
        position: quizQuestions.filter((q) => q.lesson_id === lessonId).length,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setQuizQuestions([...quizQuestions, data.question]);
      setQuizDraft(emptyQuizDraft);
      router.refresh();
    }
  }

  function startEditingQuestion(q: QuizQuestionRow) {
    setEditingQuestionId(q.id);
    setEditQuizDraft({ question: q.question, options: [...q.options], correctIndex: q.correct_index });
  }

  async function saveQuestionEdit(questionId: string) {
    const cleanOptions = editQuizDraft.options.map((o) => o.trim()).filter(Boolean);
    if (!editQuizDraft.question.trim() || cleanOptions.length < 2) return;
    const res = await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'quizQuestion',
        id: questionId,
        question: editQuizDraft.question.trim(),
        options: cleanOptions,
        correctIndex: editQuizDraft.correctIndex,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setQuizQuestions(quizQuestions.map((q) => (q.id === questionId ? data.question : q)));
      setEditingQuestionId(null);
      router.refresh();
    }
  }

  async function deleteQuizQuestion(questionId: string) {
    const confirmed = window.confirm('هل أنت متأكد من حذف هذا السؤال؟');
    if (!confirmed) return;
    const res = await fetch('/api/admin/content', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'quizQuestion', id: questionId }),
    });
    if (res.ok) {
      setQuizQuestions(quizQuestions.filter((q) => q.id !== questionId));
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
          {editingModuleId === m.id ? (
            <div className="mb-4 space-y-3">
              <input
                value={editModuleDraft.title}
                onChange={(e) => setEditModuleDraft({ ...editModuleDraft, title: e.target.value })}
                placeholder="اسم الوحدة"
                className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold font-cairo font-bold"
              />
              <textarea
                value={editModuleDraft.description}
                onChange={(e) => setEditModuleDraft({ ...editModuleDraft, description: e.target.value })}
                placeholder="وصف الوحدة — ماذا سيتعلم الطالب هنا؟ (يظهر للطالب)"
                rows={2}
                className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold resize-none"
              />
              <input
                type="url"
                value={editModuleDraft.thumbnailUrl}
                onChange={(e) => setEditModuleDraft({ ...editModuleDraft, thumbnailUrl: e.target.value })}
                placeholder="رابط الصورة المصغرة للوحدة"
                dir="ltr"
                className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold"
              />
              {editModuleDraft.thumbnailUrl && (
                <div className="w-[180px] aspect-video rounded-lg overflow-hidden border border-border bg-surface2">
                  <img src={editModuleDraft.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button className="btn-ghost !py-2 !px-4 text-xs" onClick={() => setEditingModuleId(null)}>
                  إلغاء
                </button>
                <button
                  className="btn-primary !py-2 !px-4 text-xs"
                  onClick={() => saveModuleEdit(m.id)}
                  disabled={savingModuleEdit}
                >
                  {savingModuleEdit ? 'جارٍ الحفظ...' : 'حفظ'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-cairo font-bold text-gold text-sm uppercase tracking-wide">{m.title}</h3>
                {m.description && <p className="text-muted text-[13px] mt-1.5">{m.description}</p>}
              </div>
              <button
                onClick={() => startEditingModule(m)}
                className="text-xs px-2.5 py-1.5 rounded-md border border-border text-muted hover:text-gold hover:border-goldDim transition flex-shrink-0"
              >
                ✏️ تعديل الوحدة
              </button>
            </div>
          )}

          {lessons
            .filter((l) => l.module_id === m.id)
            .map((l) => {
              const lessonQuestions = quizQuestions.filter((q) => q.lesson_id === l.id);
              return (
                <div key={l.id} className="border-b border-border last:border-0">
                  {editingLessonId === l.id ? (
                    <div className="py-4 space-y-3">
                      <input
                        value={editLessonDraft.title}
                        onChange={(e) => setEditLessonDraft({ ...editLessonDraft, title: e.target.value })}
                        placeholder="عنوان الدرس"
                        className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold"
                      />
                      <textarea
                        value={editLessonDraft.description}
                        onChange={(e) => setEditLessonDraft({ ...editLessonDraft, description: e.target.value })}
                        placeholder="وصف الدرس (اختياري)"
                        rows={2}
                        className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold resize-none"
                      />
                      <div className="grid sm:grid-cols-2 gap-3">
                        <select
                          value={editLessonDraft.videoProvider}
                          onChange={(e) => setEditLessonDraft({ ...editLessonDraft, videoProvider: e.target.value })}
                          className="bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold"
                        >
                          <option value="bunny">Bunny Stream</option>
                          <option value="vimeo">Vimeo</option>
                        </select>
                        <input
                          value={editLessonDraft.videoId}
                          onChange={(e) => setEditLessonDraft({ ...editLessonDraft, videoId: e.target.value })}
                          placeholder="معرّف الفيديو (Video ID)"
                          className="bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold"
                        />
                      </div>
                      <input
                        value={editLessonDraft.resourceUrl}
                        onChange={(e) => setEditLessonDraft({ ...editLessonDraft, resourceUrl: e.target.value })}
                        placeholder="رابط الملف المرفق (اختياري)"
                        className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gold"
                      />
                      <div className="flex gap-2 justify-end">
                        <button className="btn-ghost !py-2 !px-4 text-xs" onClick={cancelEditingLesson}>
                          إلغاء
                        </button>
                        <button
                          className="btn-primary !py-2 !px-4 text-xs"
                          onClick={() => saveLessonEdit(l.id)}
                          disabled={savingEdit}
                        >
                          {savingEdit ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="flex-1">{l.title}</span>
                      <span className="text-muted2 text-xs whitespace-nowrap">{l.video_id ? '🎬 فيديو مضاف' : 'بلا فيديو'}</span>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => setOpenQuizForLesson(openQuizForLesson === l.id ? null : l.id)}
                          className="text-xs px-2.5 py-1.5 rounded-md border border-border text-muted hover:text-gold hover:border-goldDim transition"
                        >
                          📝 الأسئلة ({lessonQuestions.length})
                        </button>
                        <button
                          onClick={() => startEditingLesson(l)}
                          className="text-xs px-2.5 py-1.5 rounded-md border border-border text-muted hover:text-gold hover:border-goldDim transition"
                        >
                          ✏️ تعديل
                        </button>
                        <button
                          onClick={() => deleteLesson(l.id, l.title)}
                          disabled={deletingLessonId === l.id}
                          className="text-xs px-2.5 py-1.5 rounded-md border border-border text-muted hover:text-[#E4756A] hover:border-[#E4756A] transition"
                        >
                          {deletingLessonId === l.id ? '...' : '🗑️ حذف'}
                        </button>
                      </div>
                    </div>
                  )}

                  {openQuizForLesson === l.id && (
                    <div className="bg-white/[0.015] rounded-lg p-4 mb-4 space-y-4">
                      {lessonQuestions.map((q) =>
                        editingQuestionId === q.id ? (
                          <div key={q.id} className="space-y-2.5 pb-3 border-b border-border last:border-0">
                            <input
                              value={editQuizDraft.question}
                              onChange={(e) => setEditQuizDraft({ ...editQuizDraft, question: e.target.value })}
                              placeholder="نص السؤال"
                              className="w-full bg-white/[0.02] border border-border rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-gold"
                            />
                            {editQuizDraft.options.map((opt, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  checked={editQuizDraft.correctIndex === i}
                                  onChange={() => setEditQuizDraft({ ...editQuizDraft, correctIndex: i })}
                                />
                                <input
                                  value={opt}
                                  onChange={(e) => updateDraftOption(editQuizDraft, setEditQuizDraft, i, e.target.value)}
                                  placeholder={`خيار ${i + 1}`}
                                  className="flex-1 bg-white/[0.02] border border-border rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-gold"
                                />
                                <button
                                  onClick={() => removeOptionField(editQuizDraft, setEditQuizDraft, i)}
                                  className="text-muted2 text-xs px-1.5"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            <div className="flex gap-2 justify-between items-center">
                              <button
                                onClick={() => addOptionField(editQuizDraft, setEditQuizDraft)}
                                className="text-xs text-gold"
                              >
                                + إضافة خيار
                              </button>
                              <div className="flex gap-2">
                                <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={() => setEditingQuestionId(null)}>
                                  إلغاء
                                </button>
                                <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => saveQuestionEdit(q.id)}>
                                  حفظ
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div key={q.id} className="flex items-start justify-between gap-3 pb-3 border-b border-border last:border-0 text-sm">
                            <div className="flex-1">
                              <p className="font-semibold mb-1">{q.question}</p>
                              <ul className="text-muted text-[12.5px] space-y-0.5">
                                {q.options.map((opt, i) => (
                                  <li key={i} className={i === q.correct_index ? 'text-success' : ''}>
                                    {i === q.correct_index ? '✓ ' : '• '}
                                    {opt}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => startEditingQuestion(q)}
                                className="text-xs px-2 py-1 rounded-md border border-border text-muted hover:text-gold transition"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => deleteQuizQuestion(q.id)}
                                className="text-xs px-2 py-1 rounded-md border border-border text-muted hover:text-[#E4756A] transition"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        )
                      )}

                      <div className="space-y-2.5 pt-1">
                        <input
                          value={quizDraft.question}
                          onChange={(e) => setQuizDraft({ ...quizDraft, question: e.target.value })}
                          placeholder="سؤال جديد"
                          className="w-full bg-white/[0.02] border border-border rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-gold"
                        />
                        {quizDraft.options.map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={quizDraft.correctIndex === i}
                              onChange={() => setQuizDraft({ ...quizDraft, correctIndex: i })}
                            />
                            <input
                              value={opt}
                              onChange={(e) => updateDraftOption(quizDraft, setQuizDraft, i, e.target.value)}
                              placeholder={`خيار ${i + 1}`}
                              className="flex-1 bg-white/[0.02] border border-border rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-gold"
                            />
                            <button onClick={() => removeOptionField(quizDraft, setQuizDraft, i)} className="text-muted2 text-xs px-1.5">
                              ✕
                            </button>
                          </div>
                        ))}
                        <div className="flex justify-between items-center">
                          <button onClick={() => addOptionField(quizDraft, setQuizDraft)} className="text-xs text-gold">
                            + إضافة خيار
                          </button>
                          <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => addQuizQuestion(l.id)}>
                            + إضافة السؤال
                          </button>
                        </div>
                        <p className="text-muted2 text-[11.5px]">حدد الدائرة بجانب الإجابة الصحيحة</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

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
