'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Student = { id: string; full_name: string; display_name: string; created_at: string };
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
      { id: data.studentId, full_name: form.fullName, display_name: form.displayName || form.fullName, created_at: new Date().toISOString() },
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
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="p-4">
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-muted2 text-xs">{s.display_name}</div>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
