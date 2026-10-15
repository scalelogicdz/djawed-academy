const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, requireMock = require) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require: requireMock, Set, Map, Date, console });
  return exports;
}
const { buildStudentProgress } = load('lib/studentProgress.ts');
const now = Date.parse('2026-10-15T12:00:00Z');
const recent = '2026-10-14T12:00:00Z';
const old = '2026-10-01T12:00:00Z';
function fixture(overrides = {}) {
  return {
    now, students: [{ id: 's', created_at: old }],
    courses: [{ id: 'c', title: 'Course' }],
    enrollments: [{ student_id: 's', course_id: 'c', created_at: old }],
    modules: [{ id: 'm', course_id: 'c', title: 'Module', position: 0 }],
    lessons: [{ id: 'l1', module_id: 'm', title: 'First', position: 0 }, { id: 'l2', module_id: 'm', title: 'Second', position: 1 }],
    completions: [], activityByStudent: { s: [recent] }, hiddenModuleIds: new Set(), ...overrides,
  };
}
test('only current enrolled visible lessons count; duplicates cannot inflate completion', () => {
  const input = fixture();
  input.modules.push({ id: 'hidden', course_id: 'c', title: 'Hidden', position: -1 }, { id: 'other', course_id: 'x', title: 'Other', position: 0 });
  input.lessons.push({ id: 'h', module_id: 'hidden', title: 'Hidden', position: 0 }, { id: 'x', module_id: 'other', title: 'Other', position: 0 });
  input.hiddenModuleIds.add('hidden');
  input.completions = ['l1', 'l1', 'h', 'x', 'deleted'].map(lesson_id => ({ student_id: 's', lesson_id, completed_at: recent }));
  const s = buildStudentProgress(input).s;
  assert.equal(s.total, 2); assert.equal(s.completed, 1); assert.equal(s.percent, 50);
  assert.equal(s.nextLesson.title, 'Second'); assert.equal(s.lastCompletedLesson.title, 'First');
});
test('no access and no published lessons never look completed or at risk', () => {
  for (const input of [fixture({ enrollments: [] }), fixture({ hiddenModuleIds: new Set(['m']) })]) {
    const s = buildStudentProgress(input).s;
    assert.equal(s.total, 0); assert.equal(s.percent, 0); assert.equal(s.needsFollowUp, false);
    assert.equal(s.nextLesson, null); assert.notEqual(s.status, 'complete');
  }
});
test('no completion is not evidence that a recent enrollee needs follow-up', () => {
  const s = buildStudentProgress(fixture({ enrollments: [{ student_id: 's', course_id: 'c', created_at: recent }] })).s;
  assert.equal(s.status, 'not_started'); assert.equal(s.needsFollowUp, false);
});
test('seven-day inactivity boundary and stale learning produce explicit reasons', () => {
  const atBoundary = new Date(now - 7 * 86400000).toISOString();
  const inactive = buildStudentProgress(fixture({ activityByStudent: { s: [atBoundary] } })).s;
  assert.equal(inactive.status, 'inactive'); assert.equal(inactive.needsFollowUp, true);
  const stalled = buildStudentProgress(fixture({
    completions: [{ student_id: 's', lesson_id: 'l1', completed_at: old }],
  })).s;
  assert.equal(stalled.status, 'stalled'); assert.equal(stalled.needsFollowUp, true);
  const recent = buildStudentProgress(fixture({ activityByStudent: { s: [new Date(now - 7 * 86400000 + 1).toISOString()] },
    enrollments: [{ student_id: 's', course_id: 'c', created_at: atBoundary }] })).s;
  // Learning has not started for a week even if the student recently signed in.
  assert.equal(recent.status, 'not_started'); assert.equal(recent.needsFollowUp, true);
});
test('completed students are not flagged for inactivity; invalid timestamps are ignored', () => {
  const s = buildStudentProgress(fixture({
    completions: ['l1', 'l2'].map(lesson_id => ({ student_id: 's', lesson_id, completed_at: old })),
    activityByStudent: { s: ['invalid', '2099-01-01', null] },
  })).s;
  assert.equal(s.status, 'complete'); assert.equal(s.percent, 100);
  assert.equal(s.needsFollowUp, false); assert.equal(s.nextLesson, null);
  assert.equal(s.lastActivityAt, new Date(old).toISOString());
});
test('lesson position and module position determine the next lesson, not input order', () => {
  const input = fixture({ lessons: [
    { id: 'l2', module_id: 'm', title: 'Second', position: 2 },
    { id: 'l1', module_id: 'm', title: 'First', position: 1 },
  ] });
  const s = buildStudentProgress(input).s;
  assert.equal(s.nextLesson.title, 'First');
  assert.equal(input.lessons[0].id, 'l2');
});
test('almost complete never rounds to 100 percent', () => {
  const lessons = Array.from({ length: 201 }, (_, i) => ({ id: String(i), module_id: 'm', title: String(i), position: i }));
  const completions = lessons.slice(0, 200).map(lesson => ({ student_id: 's', lesson_id: lesson.id, completed_at: recent }));
  const s = buildStudentProgress(fixture({ lessons, completions })).s;
  assert.equal(s.percent, 99); assert.equal(s.status, 'in_progress');
});
test('new enrollment protects against a stale account creation date', () => {
  const s = buildStudentProgress(fixture({
    activityByStudent: {}, enrollments: [{ student_id: 's', course_id: 'c', created_at: recent }],
  })).s;
  assert.equal(s.needsFollowUp, false);
});
function adminPage({ authenticated = true, admin = true, progressError = false, largeCourse = false } = {}) {
  let adminCalls = 0;
  const ranges = [];
  const data = {
    profiles: [{ id: 's', full_name: 'Student', display_name: 'Student', created_at: old, last_seen_at: recent }],
    courses: [{ id: 'c', title: 'Course' }],
    enrollments: [{ student_id: 's', course_id: 'c', created_at: old }],
    modules: [{ id: 'm', course_id: 'c', title: 'Module', position: 0 }],
    lessons: Array.from({ length: largeCourse ? 501 : 2 }, (_, i) => ({ id: String(i), module_id: 'm', title: 'Lesson ' + i, position: i })),
    lesson_progress: [],
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'viewer' } : null } }) },
    from(table) {
      return {
        select() { return this; }, eq() { return this; }, order() { return this; },
        single: async () => ({ data: { is_admin: admin } }),
        range: async (from, to) => {
          ranges.push({ table, from, to });
          return progressError && table === 'lesson_progress' ? { error: { message: 'unavailable' }, data: null }
            : { data: (data[table] ?? []).slice(from, to + 1), error: null };
        },
      };
    },
  };
  const StudentsManager = () => null;
  const page = load('app/admin/students/page.tsx', name => {
    if (name === 'next/navigation') return { redirect: path => { throw new Error('REDIRECT:' + path); } };
    if (name === '@/lib/supabase/server') return { createClient: async () => client };
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => {
      adminCalls++;
      return { auth: { admin: { listUsers: async () => ({ data: { users: [{ id: 's', email: 'student@example.com', last_sign_in_at: recent }] } }) } } };
    } };
    if (name === '@/lib/moduleVisibility') return { hiddenModuleIds: async () => new Set() };
    if (name === '@/lib/studentProgress') return { buildStudentProgress };
    if (name === '@/components/StudentsManager') return { default: StudentsManager };
    if (name === '@/components/AdminBackButton') return { default: () => null };
    return require(name);
  }).default;
  return { page, StudentsManager, ranges, get adminCalls() { return adminCalls; } };
}
test('unauthenticated users and non-admins cannot load the admin auth directory', async () => {
  for (const config of [{ authenticated: false }, { admin: false }]) {
    const fixture = adminPage(config);
    await assert.rejects(() => fixture.page(), /REDIRECT:/);
    assert.equal(fixture.adminCalls, 0);
  }
});
test('the server reads beyond the default result cap and builds the full denominator', async () => {
  const fixture = adminPage({ largeCourse: true });
  const element = await fixture.page();
  const manager = element.props.children.find(child => child?.type === fixture.StudentsManager);
  assert.equal(manager.props.progressByStudent.s.total, 501);
  assert.ok(fixture.ranges.some(range => range.table === 'lessons' && range.from === 500));
});
test('database failure is shown as unavailable, never fabricated zero progress', async () => {
  const fixture = adminPage({ progressError: true });
  const element = await fixture.page();
  const manager = element.props.children.find(child => child?.type === fixture.StudentsManager);
  assert.ok(manager.props.progressError);
  assert.equal(Object.keys(manager.props.progressByStudent).length, 0);
});
