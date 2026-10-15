const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, deps, globals = {}) {
 const exports = {};
 const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
 vm.runInNewContext(code, { exports, require: name => deps[name] ?? require(name), URL, AbortSignal, Request, console, setTimeout: fn => { fn(); return 1; }, ...globals });
 return exports;
}
function setup({ admins = [{id:'owner'}], override, statuses = [200], configured = true } = {}) {
 const calls = []; let lookups = 0;
 const db = { from: () => ({ select() { return this; }, eq() { return this; }, limit: async () => ({ data: admins }) }),
 auth: { admin: { getUserById: async id => { lookups++; assert.equal(id,'owner'); return { data: {user:{email:'owner@example.com'}} }; } } } };
 const api = load('lib/supportEmails.ts', {
 '@/lib/supabase/admin': { createAdminClient: () => db },
 '@/lib/lessonEmails': { lessonEmailConfig: () => configured ? {key:'test',from:'Djawed <notify@example.com>',url:'https://academy.example.com'} : null,
 escapeEmailHtml: value => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') },
 '@/lib/security': { cleanEmail: value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null },
 '@/lib/emailLogoV1': {EMAIL_LOGO_V1:'logo'},
 }, { process: {env: override === undefined ? {} : { SUPPORT_NOTIFICATION_EMAIL: override }},
 fetch: async (url, options) => { calls.push({url,...options}); const status = statuses[Math.min(calls.length-1,statuses.length-1)]; return {ok:status===200,status}; } });
 return {api,calls,get lookups(){return lookups;}};
}
const notice = { id:'request-1',name:'Student <script>',subject:'Question <img>' };
test('only the single platform admin receives the notification',async()=>{
 const f=setup(); await f.api.notifySupportRequest(notice);
 assert.deepEqual(JSON.parse(f.calls[0].body).to,['owner@example.com']);
 assert.equal(f.lookups,1);
});
test('multiple or missing admins never cause a guessed or expanded recipient set',async()=>{
 for(const admins of [[],[{id:'owner'},{id:'other'}]]) {
  const f=setup({admins}); await assert.rejects(()=>f.api.notifySupportRequest(notice),/resolve the owner/); assert.equal(f.calls.length,0);
 }
});
test('explicit recipient override is validated and avoids admin lookup',async()=>{
 const f=setup({override:'chosen@example.com'}); await f.api.notifySupportRequest(notice);
 assert.deepEqual(JSON.parse(f.calls[0].body).to,['chosen@example.com']); assert.equal(f.lookups,0);
 const bad=setup({override:'invalid'}); await assert.rejects(()=>bad.api.notifySupportRequest(notice)); assert.equal(bad.calls.length,0);
});
test('temporary provider failures retry the identical message with a stable idempotency key',async()=>{
 const f=setup({statuses:[429,503,200]}); await f.api.notifySupportRequest(notice);
 assert.equal(f.calls.length,3);
 for(const call of f.calls){ assert.equal(call.body,f.calls[0].body); assert.equal(call.headers['Idempotency-Key'],'support-email/v1/request-1'); }
});
test('permanent rejection and missing config do not repeatedly contact provider',async()=>{
 const f=setup({statuses:[422]}); await assert.rejects(()=>f.api.notifySupportRequest(notice)); assert.equal(f.calls.length,1);
 const missing=setup({configured:false}); await assert.rejects(()=>missing.api.notifySupportRequest(notice)); assert.equal(missing.calls.length,0);
});
test('notice escapes user content and contains only a platform homepage link',()=>{
 const f=setup(); const msg=f.api.supportEmailMessage(notice,'https://academy.example.com/support?private=yes');
 assert.match(msg.html,/&lt;script&gt;/); assert.doesNotMatch(msg.html,/<script>|<img>|private=yes/);
 assert.equal((msg.html.match(/href=/g)||[]).length,1); assert.match(msg.html,/href="https:\/\/academy.example.com"/);
});
function routeSetup({ user=true, saveError=false, deliveryError=false }={}) {
 const tasks=[], notices=[]; let saved=0;
 const api=load('app/api/support/route.ts',{
 'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status??200})},after:fn=>tasks.push(fn)},
 '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:user?{id:'student'}:null}})}})},
 '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>({insert:value=>{saved++; return {select:()=>({single:async()=>({data:saveError?null:{id:'request-1'},error:saveError?{}:null})})};}})})},
 '@/lib/security':{checkRateLimit:()=>({allowed:true}),readJsonObject:request=>request.json(),cleanText:value=>value,cleanEmail:value=>value},
 '@/lib/supportEmails':{notifySupportRequest:async value=>{notices.push(value);if(deliveryError)throw new Error('failed');}},
 });
 return {api,tasks,notices,get saved(){return saved;}};
}
const request=()=>new Request('https://academy.example.com/api/support',{method:'POST',body:JSON.stringify({name:'Student',email:'student@example.com',subject:'Help',message:'My question'})});
test('only persisted requests trigger notification; delivery failure keeps request accepted',async()=>{
 for(const config of [{user:false},{saveError:true},{deliveryError:true}]) {
  const f=routeSetup(config); const response=await f.api.POST(request());
  if(config.deliveryError){assert.equal(response.status,200);assert.equal(f.saved,1);await f.tasks[0]();assert.equal(f.notices.length,1);}
  else {assert.equal(f.tasks.length,0);assert.equal(f.notices.length,0);assert.notEqual(response.status,200);}
 }
});
