const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, deps) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => deps[name] ?? require(name), URL, console });
  return exports;
}
test('community owner notices use the shared recipient, separate stable keys, and homepage-only messages', async () => {
  const deliveries = [];
  const api = load('lib/ownerCommunityEmails.ts', {
    '@/lib/supportEmails': { sendOwnerEmail: async (key, message) => deliveries.push({ key, message: message('https://academy.example.com/community?private=yes') }) },
    '@/lib/lessonEmails': { escapeEmailHtml: value => value },
    '@/lib/emailLogoV1': { EMAIL_LOGO_V1: 'logo' },
  });
  for (const type of ['question', 'reply']) {
    await api.notifyOwnerCommunityActivity(type, 'id-1');
    const { key, message } = deliveries.at(-1);
    assert.equal(key, `owner-community-email/v1/${type}/id-1`);
    assert.equal(message.text.split('\n\n')[1], 'https://academy.example.com');
    assert.match(message.html, /cid:djawed-logic-logo-v1/);
    assert.doesNotMatch(message.html, /private=yes|community\?/);
    assert.equal((message.html.match(/href=/g) || []).length, 1);
  }
  assert.notEqual(deliveries[0].message.subject, deliveries[1].message.subject);
});
function setup({ admin = false, user = true, saveError = false, deliveryError = false, rateAllowed = true } = {}) {
  const tasks = [], owner = [], student = [];
  const db = { auth: { getUser: async () => ({ data: { user: user ? { id: 'student' } : null } }) },
    from(table) {
      let inserting = false;
      return { select() { return this; }, eq() { return this; },
        insert() { inserting = true; return this; }, update() { return this; },
        single: async () => table === 'profiles' ? { data: { is_admin: admin } }
          : { data: saveError && inserting ? null : { id: 'saved-id', student_id: 'student' }, error: saveError && inserting ? {} : null },
        maybeSingle: async () => ({ data: { id: 'parent' } }),
      };
    } };
  const api = load('app/api/community/posts/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) }, after: fn => tasks.push(fn) },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/supabase/admin': { createAdminClient: () => db },
    '@/lib/security': { checkRateLimit: () => ({ allowed: rateAllowed, retryAfterSeconds: 60 }), cleanText: value => typeof value === 'string' && value.trim() || null,
      isUuid: value => typeof value === 'string' && value.length > 0, readJsonObject: request => request.json() },
    '@/lib/communityEmails': { dispatchCommunityEmails: async () => student.push('sent') },
    '@/lib/ownerCommunityEmails': { notifyOwnerCommunityActivity: async (type, id) => { owner.push({ type, id }); if (deliveryError) throw new Error('provider unavailable'); } },
  });
  return { api, tasks, owner, student };
}
const req = type => ({ json: async () => ({ type, body: 'Message', questionId: 'parent' }) });
test('saved student posts and replies each schedule one email to the owner', async () => {
  for (const type of ['question', 'reply']) {
    const f = setup(); const response = await f.api.POST(req(type));
    assert.equal(response.status, 200); assert.equal(f.tasks.length, 1);
    await f.tasks[0]();
    assert.equal(f.owner.length, 1); assert.equal(f.owner[0].type, type); assert.equal(f.owner[0].id, 'saved-id');
    assert.equal(f.student.length, 0);
  }
});
test('admin posts and replies preserve student notifications without self-alerts', async () => {
  for (const type of ['question', 'reply']) {
    const f = setup({ admin: true }); await f.api.POST(req(type));
    assert.equal(f.tasks.length, 1); await f.tasks[0]();
    assert.equal(f.owner.length, 0); assert.equal(f.student.length, 1);
  }
});
test('failed, unauthenticated and rate-limited writes never email the owner', async () => {
  for (const config of [{ saveError: true }, { user: false }, { rateAllowed: false }]) {
    for (const type of ['question', 'reply']) {
      const f = setup(config); const response = await f.api.POST(req(type));
      assert.notEqual(response.status, 200); assert.equal(f.tasks.length, 0); assert.equal(f.owner.length, 0);
    }
  }
});
test('delivery failure does not change successful posting and edits do not create alerts', async () => {
  const f = setup({ deliveryError: true }); const response = await f.api.POST(req('question'));
  assert.equal(response.status, 200); await f.tasks[0]();
  const edit = setup(); await edit.api.PATCH({ json: async () => ({ id: 'saved-id', body: 'Edited' }) });
  assert.equal(edit.tasks.length, 0);
});
