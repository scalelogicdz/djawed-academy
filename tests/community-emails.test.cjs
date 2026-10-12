const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('lib/communityEmails.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function setup({providerOk=true,saveFails=false,configured=true}={}) {
 const calls=[],updates=[]; let claimed=false;
 const job={id:'job-1',recipient:'student@example.com',payload:{type:'admin_reply',from:'Djawed <notifications@example.com>',url:'https://academy.example.com'}};
 const db={rpc:async()=>({data:claimed?[]:(claimed=true,[job]),error:null}),from:()=>({update:value=>({eq:async()=>{updates.push(value);return {error:saveFails&&value.status==='sent'?{}:null}}})})};
 const api={}; vm.runInNewContext(source,{exports:api,require:n=>n.endsWith('emailLogoV1')?{EMAIL_LOGO_V1:'logo-base64'}:n.endsWith('lessonEmails')?{lessonEmailConfig:()=>configured?{key:'test',from:job.payload.from,url:job.payload.url}:null,escapeEmailHtml:s=>s}: {createAdminClient:()=>db},URL,AbortSignal,Date,console,setTimeout:fn=>{fn();return 1},fetch:async(url,opts)=>{calls.push({url,...opts});return {ok:providerOk}}});
 return {api,calls,updates};
}
test('both templates contain only notice, embedded logo and homepage, no post text or deep links',()=>{
 const {api}=setup(); for(const type of ['admin_post','admin_reply']) {
  const msg=api.communityEmailMessage(type,'https://academy.example.com/community?q=private#reply');
  assert.equal(msg.text.split('\n\n')[1],'https://academy.example.com');
  assert.match(msg.html,/cid:djawed-logic-logo-v1/);
  assert.equal((msg.html.match(/href=/g)||[]).length,1);
  assert.doesNotMatch(msg.html,/community\?|#reply|private|<button/);
  assert.ok(msg.html.indexOf('<img')>msg.html.indexOf('</p>'));
  assert.equal(msg.attachments[0].content_id,'djawed-logic-logo-v1');
 }
});
test('sends one private recipient with stable provider idempotency key',async()=>{
 const {api,calls,updates}=setup(); await api.dispatchCommunityEmails();
 assert.equal(calls.length,1);assert.deepEqual(JSON.parse(calls[0].body).to,['student@example.com']);
 assert.equal(calls[0].headers['Idempotency-Key'],'community-email/v1/job-1');assert.equal(updates[0].status,'sent');
});
test('provider failure remains queued for retry',async()=>{
 const {api,calls,updates}=setup({providerOk:false});await api.dispatchCommunityEmails();
 assert.equal(calls.length,1);assert.equal(updates[0].status,'failed');assert.ok(updates[0].next_attempt_at);
});
test('ambiguous acceptance uses the same payload and key on retry',async()=>{
 const a=setup({saveFails:true}),b=setup();await a.api.dispatchCommunityEmails();await b.api.dispatchCommunityEmails();
 assert.equal(a.updates.at(-1).status,'failed');assert.equal(a.calls[0].body,b.calls[0].body);assert.equal(a.calls[0].headers['Idempotency-Key'],b.calls[0].headers['Idempotency-Key']);
});
test('missing configuration does not contact provider',async()=>{const {api,calls}=setup({configured:false});await api.dispatchCommunityEmails();assert.equal(calls.length,0)});
