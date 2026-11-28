const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
function load(path,deps={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>deps[n]??require(n),process,Buffer,URL,Request,AbortSignal,console,Date,...globals});return exports;}
test('password policy accepts name-plus-123 passwords without contacting external services',async()=>{
 let calls=0;
 const api=load('lib/passwordSecurity.ts',{}, {fetch:async()=>{calls++;throw new Error('Unexpected external call');}});
 for(const password of ['ali123','sofiane123','a'.repeat(128)])assert.equal(await api.validateNewPassword(password),null);
 assert.ok(await api.validateNewPassword('abc12'));
 assert.ok(await api.validateNewPassword('a'.repeat(129)));
 assert.equal(calls,0);
});

test('rate limiter stores only stable HMAC identifiers and never falls back to process memory',async()=>{
 const args=[];const api=load('lib/persistentRateLimit.ts',{'@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,payload)=>{args.push(payload);return {data:{allowed:false,retry_after:42}};}})}},{process:{env:{SUPABASE_SERVICE_ROLE_KEY:'isolated-test-secret'}}});
 const r=await api.persistentRateLimit('login-account','person@example.com',8,600);assert.equal(r.allowed,false);assert.equal(r.retryAfterSeconds,42);
 await api.persistentRateLimit('login-account','person@example.com',8,600);
 assert.equal(args[0].p_key,args[1].p_key);assert.match(args[0].p_key,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(args).includes('person@example.com'));
 const broken=load('lib/persistentRateLimit.ts',{'@/lib/supabase/admin':{createAdminClient:()=>({rpc:async()=>({error:{}})})}},{process:{env:{SUPABASE_SERVICE_ROLE_KEY:'test-secret'}}});
 await assert.rejects(broken.persistentRateLimit('login-ip','ip',1,60),/Security checks unavailable/);
});
test('verifiedAdmin rejects an admin session missing required MFA; student aal2 never becomes admin',async()=>{
 const api=load('lib/adminSecurity.ts');
 for(const [isAdmin,satisfied,allowed] of [[true,false,false],[true,true,true],[false,true,false]]){
  const db={auth:{getUser:async()=>({data:{user:{id:'viewer'}}})},from:()=>({select(){return this},eq(){return this},single:async()=>({data:{is_admin:isAdmin}})}),rpc:async()=>({data:{is_admin:isAdmin,required:true,satisfied}})};
  assert.equal(!!(await api.verifiedAdmin(db)),allowed);
 }
});
test('admin status verification fails closed if the database check is missing',async()=>{
 const api=load('lib/adminSecurity.ts');await assert.rejects(api.adminSecurityStatus({rpc:async()=>({error:{}})}),/unavailable/);
});
test('login rejects cross-origin attempts before accessing passwords or counters',async()=>{
 const api=load('app/api/auth/login/route.ts',{
  '@/lib/accountAccess':{sameOrigin:()=>false},'@/lib/persistentRateLimit':{},'@/lib/supabase/server':{},'@/lib/supabase/admin':{},'next/headers':{},'@/lib/security':{},
 });
 assert.equal((await api.POST(new Request('https://academy.example.com/api/auth/login',{method:'POST'}))).status,403);
});
test('leads fail closed on unavailable counters; no CRM request is sent',async()=>{
 let sent=0;const api=load('app/api/leads/route.ts',{
  '@/lib/persistentRateLimit':{persistentRateLimit:async()=>{throw Error('db unavailable')}},
  '@/lib/security':{clientIp:()=> 'test-ip'},
 },{fetch:async()=>{sent++;},process:{env:{NODE_ENV:'production'}}});
 assert.equal((await api.POST(new Request('https://course.djawedkhalfaoui.com/api/leads',{method:'POST',headers:{origin:'https://course.djawedkhalfaoui.com'}}))).status,503);assert.equal(sent,0);
});
test('leads rate limit includes Retry-After; malformed bodies never reach CRM',async()=>{
 let sent=0;const api=load('app/api/leads/route.ts',{
  '@/lib/persistentRateLimit':{persistentRateLimit:async()=>({allowed:false,retryAfterSeconds:30})},'@/lib/security':{clientIp:()=> 'test-ip'},
 },{fetch:async()=>{sent++;},process:{env:{NODE_ENV:'production'}}});
 const res=await api.POST(new Request('https://course.djawedkhalfaoui.com/api/leads',{method:'POST',headers:{origin:'https://course.djawedkhalfaoui.com'}}));
 assert.equal(res.status,429);assert.equal(res.headers.get('Retry-After'),'30');assert.equal(sent,0);
});
