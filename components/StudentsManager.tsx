'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';

type Student = { id: string; full_name: string; display_name: string; email: string; created_at: string };
type Course = { id: string; title: string };
type Enrollment = { student_id: string; course_id: string };

export default function StudentsManager({
  initialStudents,
  courses,
  initialEnrollments,
}: {
  initialStudents: Student[];
  courses: Course[];
  initialEnrollments: Enrollment[];
}) {
  const router = useRouter();
  const [students, setStudents] = useState(initialStudents);
  const [enrollments, setEnrollments] = useState(initialEnrollments);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [savingStudentEdit, setSavingStudentEdit] = useState(false);
  const [studentEditError, setStudentEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    displayName: '',
    email: '',
    password: '',
  });

  const [form, setForm] = useState({
    fullName: '',
    displayName: '',
    email: '',
    password: '',
    courseIds: [] as string[],
  });

  function isEnrolled(studentId: string, courseId: string) {
    return enrollments.some((e) => e.student_id === studentId && e.course_id === courseId);
  }

  async function toggleEnrollment(studentId: string, courseId: string) {
    const enrolled = isEnrolled(studentId, courseId);
    if (enrolled) {
      setEnrollments(enrollments.filter((e) => !(e.student_id === studentId && e.course_id === courseId)));
      await fetch('/api/admin/enrollments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, courseId }),
      });
    } else {
      setEnrollments([...enrollments, { student_id: studentId, course_id: courseId }]);
      await fetch('/api/admin/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, courseId }),
      });
    }
  }

  function startEditingStudent(student: Student) {
    setEditingStudentId(student.id);
    setStudentEditError(null);
    setEditForm({
      fullName: student.full_name ?? '',
      displayName: student.display_name ?? '',
      email: student.email ?? '',
      password: '',
    });
  }

  function cancelEditingStudent() {
    setEditingStudentId(null);
    setStudentEditError(null);
    setEditForm({ fullName: '', displayName: '', email: '', password: '' });
  }

  async function saveStudentEdit(studentId: string) {
    if (savingStudentEdit) return;
    if (!editForm.fullName.trim() || !editForm.email.trim()) {
      setStudentEditError('الاسم والبريد الإلكتروني مطلوبان');
      return;
    }

    setSavingStudentEdit(true);
    setStudentEditError(null);

    const res = await fetch('/api/admin/students', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        fullName: editForm.fullName,
        displayName: editForm.displayName,
        email: editForm.email,
        password: editForm.password || undefined,
      }),
    });

    const data = await res.json();
    setSavingStudentEdit(false);

    if (!res.ok) {
      setStudentEditError(data.error ?? 'تعذر حفظ تعديلات الطالب');
      return;
    }

    setStudents((current) =>
      current.map((student) => (student.id === studentId ? { ...student, ...data.student } : student))
    );
    cancelEditingStudent();
    router.refresh();
  }

  async function removeStudent(student: Student) {
    if (deletingStudentId) return;
    if (!window.confirm(`هل أنت متأكد من حذف الطالب "${student.full_name}"؟`)) return;

    setDeleteError(null);
    setDeletingStudentId(student.id);

    const res = await fetch('/api/admin/students', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: student.id }),
    });
    const data = await res.json();
    setDeletingStudentId(null);

    if (!res.ok) {
      setDeleteError(data.error ?? 'تعذر حذف الطالب');
      return;
    }

    setStudents((current) => current.filter((s) => s.id !== student.id));
    setEnrollments((current) => current.filter((e) => e.student_id !== student.id));
    router.refresh();
  }

  async function submitNewStudent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? 'حدث خطأ');
      return;
    }

    setShowForm(false);
    setForm({ fullName: '', displayName: '', email: '', password: '', courseIds: [] });
    router.refresh();
    setStudents([
      { id: data.studentId, full_name: form.fullName, display_name: form.displayName || form.fullName, email: form.email, created_at: new Date().toISOString() },
      ...students,
    ]);
    setEnrollments([
      ...enrollments,
      ...form.courseIds.map((courseId) => ({ student_id: data.studentId, course_id: courseId })),
    ]);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-muted text-sm">{students.length} طالب</p>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'إلغاء' : '+ إضافة طالب'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitNewStudent} className="card p-7 mb-8 text-right">
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted mb-2">الاسم الكامل</label>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-3 text-[15px] focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-2">الاسم المعروض (اختياري)</label>
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="سيظهر هذا في صفحة المجتمع"
                className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-3 text-[15px] focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-2">البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-3 text-[15px] focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-2">كلمة المرور المبدئية</label>
              <input
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-3 text-[15px] focus:outline-none focus:border-gold"
              />
            </div>
          </div>

          <label className="block text-xs text-muted mb-2">منح الوصول للدورات</label>
          <div className="flex flex-wrap gap-2 mb-5">
            {courses.map((c) => {
              const checked = form.courseIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`px-4 py-2 rounded-lg border text-sm cursor-pointer transition ${
                    checked ? 'border-gold bg-[rgba(212,177,94,0.08)] text-gold' : 'border-border text-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={checked}
                    onChange={() =>
                      setForm({
                        ...form,
                        courseIds: checked ? form.courseIds.filter((id) => id !== c.id) : [...form.courseIds, c.id],
                      })
                    }
                  />
                  {c.title}
                </label>
              );
            })}
          </div>

          {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'جارٍ الحفظ...' : 'حفظ وإنشاء الحساب'}
          </button>
        </form>
      )}

      {deleteError && <p className="text-sm text-red-400 mb-4">{deleteError}</p>}
      {studentEditError && <p className="text-sm text-red-400 mb-4">{studentEditError}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-xs">
              <th className="text-right p-4 font-medium">الاسم</th>
              {courses.map((c) => (
                <th key={c.id} className="text-center p-4 font-medium">
                  {c.title}
                </th>
              ))}
              <th className="text-center p-4 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <Fragment key={s.id}>
              <tr className="border-b border-border last:border-0">
                <td className="p-4">
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-muted2 text-xs">{s.display_name}</div>
                  <div className="text-muted2 text-[11px] mt-1" dir="ltr">{s.email || '—'}</div>
                </td>
                {courses.map((c) => (
                  <td key={c.id} className="text-center p-4">
                    <button
                      onClick={() => toggleEnrollment(s.id, c.id)}
                      className={`w-6 h-6 rounded-md border transition ${
                        isEnrolled(s.id, c.id) ? 'bg-gold border-gold text-[#0A0F1A]' : 'border-border'
                      }`}
                    >
                      {isEnrolled(s.id, c.id) ? '✓' : ''}
                    </button>
                  </td>
                ))}
                <td className="text-center p-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEditingStudent(s)}
                      className="rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/[0.08] transition"
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStudent(s)}
                      disabled={deletingStudentId === s.id}
                      className="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                    >
                      {deletingStudentId === s.id ? 'جارٍ الحذف...' : 'حذف الطالب'}
                    </button>
                  </div>
                </td>
              </tr>
              {editingStudentId === s.id && (
                <tr className="border-b border-border bg-white/[0.015]">
                  <td colSpan={courses.length + 2} className="p-4 sm:p-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-muted mb-2">الاسم الكامل</label>
                        <input
                          value={editForm.fullName}
                          onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                          className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-3 text-[14px] focus:outline-none focus:border-gold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-2">الاسم المعروض</label>
                        <input
                          value={editForm.displayName}
                          onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                          className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-3 text-[14px] focus:outline-none focus:border-gold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-2">البريد الإلكتروني للدخول</label>
                        <input
                          type="email"
                          dir="ltr"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-3 text-[14px] focus:outline-none focus:border-gold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-2">كلمة مرور جديدة (اختياري)</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={editForm.password}
                          onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                          placeholder="اتركها فارغة إذا لا تريد تغييرها"
                          className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-3 text-[14px] focus:outline-none focus:border-gold"
                        />
                        <p className="text-[11px] text-muted2 mt-1.5">لا يمكن عرض كلمة المرور الحالية، لكن يمكنك تعيين كلمة مرور جديدة للطالب.</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 mt-4">
                      <button
                        type="button"
                        onClick={cancelEditingStudent}
                        disabled={savingStudentEdit}
                        className="btn-ghost !py-2 !px-4 text-xs"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={() => saveStudentEdit(s.id)}
                        disabled={savingStudentEdit}
                        className="btn-primary !py-2 !px-4 text-xs"
                      >
                        {savingStudentEdit ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
