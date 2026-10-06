const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('lib/lessonEmails.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function setup({ enrolled = true, providerOk = true, recordFails = false, configured = true } = {}) {
  const updates = [], calls = [];
  const job = { id:'delivery-1',lesson_id:'lesson-1',student_id:'student-1',recipient:'student@example.com',payload:{from:'Djawed Logic <lessons@example.com>',title:'<img src=x> & درس',url:'https://academy.example.com/lesson/lesson-1'} };
  let claimed = false;
  const db = {
    rpc: async () => ({data: claimed ? [] : (claimed=true,[job]),error:null}),
    from(table) {
      const q = {select(){return q},eq(){return q},limit:async()=>({error:null}),
        single:async()=>({data:table==='lessons'?{module_id:'module-1'}:{course_id:'course-1'}}),
        maybeSingle:async()=>({data:enrolled?{id:'enrollment-1'}:null,error:null}),
        update(value){return {eq:async()=>{updates.push(value);return {error:recordFails&&value.status==='sent'?{}:null}}}}};
      return q;
    }
  };
  const exports = {};
  vm.runInNewContext(source,{exports,require:()=>({createAdminClient:()=>db}),process:{env:configured?{RESEND_API_KEY:'test-key',RESEND_FROM:job.payload.from,PLATFORM_URL:'https://academy.example.com'}:{}},URL,AbortSignal,Date,console,
    setTimeout:fn=>{fn();return 1},fetch:async(url,opts)=>{calls.push({url,...opts});return {ok:providerOk}}});
  return {api:exports,updates,calls,job};
}
test('new lesson email is private, escaped, and uses stable retry key',async()=>{
 const {api,updates,calls}=setup(); await api.dispatchLessonEmails();
 assert.equal(calls.length,1);const body=JSON.parse(calls[0].body);
 assert.deepEqual(body.to,['student@example.com']);assert.equal(body.cc,undefined);
 assert.match(body.html,/&lt;img src=x&gt;/);assert.doesNotMatch(body.html,/<img/);
 assert.equal(calls[0].headers['Idempotency-Key'],'lesson-email/delivery-1');
 assert.equal(updates[0].status,'sent');
});
test('removed enrollment holds notification without sending',async()=>{
 const {api,updates,calls}=setup({enrolled:false});await api.dispatchLessonEmails();assert.equal(calls.length,0);assert.equal(updates[0].status,'held');
});
test('provider failure leaves recoverable delivery, never marks sent',async()=>{
 const {api,updates}=setup({providerOk:false});await api.dispatchLessonEmails();assert.equal(updates.length,1);assert.equal(updates[0].status,'failed');
});
test('acceptance followed by database failure keeps same key for retry',async()=>{
 const first=setup({recordFails:true});await first.api.dispatchLessonEmails();
 const retry=setup();await retry.api.dispatchLessonEmails();
 assert.equal(first.updates.at(-1).status,'failed');
 assert.equal(first.calls[0].body,retry.calls[0].body);
 assert.equal(first.calls[0].headers['Idempotency-Key'],retry.calls[0].headers['Idempotency-Key']);
});
test('missing email configuration never sends',async()=>{
 const {api,calls}=setup({configured:false});assert.equal(await api.lessonEmailsReady(),false);await api.dispatchLessonEmails();assert.equal(calls.length,0);
});
