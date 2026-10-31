const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {NextRequest,NextResponse}=require('next/server');
function load(path,deps,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>deps[n]??require(n),Request,URL,Buffer,AbortSignal,console,process,...globals});return exports;}
const userId='11111111-1111-4111-8111-111111111111',sessionId='22222222-2222-4222-8222-222222222222',targetId='33333333-3333-4333-8333-333333333333';
function proxyFixture({identity={user:{id:userId},sessionId},allowed=true,fail=false}={}){
 let checks=0;const proxy=load('proxy.ts',{
  '@supabase/ssr':{createServerClient:()=>({})},
  '@/lib/accountAccess':{browserToken:()=> 'a'.repeat(64),DEVICE_COOKIE:'djawed-browser-v1',DEVICE_COOKIE_OPTIONS:{httpOnly:true,path:'/'},verifiedIdentity:async()=>identity,registerBrowser:async()=>{checks++;if(fail)throw new Error();return {allowed};}},
 }).proxy;
 return {proxy,get checks(){return checks;}};
}
test('proxy redirects third browsers and blocks their API requests; recovery is still available',async()=>{
 const f=proxyFixture({allowed:false});const headers={cookie:'djawed-browser-v1='+'a'.repeat(64)};
 const page=await f.proxy(new NextRequest('https://academy.example.com/dashboard',{headers}));assert.equal(page.status,307);assert.equal(new URL(page.headers.get('location')).pathname,'/devices');
 const api=await f.proxy(new NextRequest('https://academy.example.com/api/profile',{headers}));assert.equal(api.status,403);assert.equal((await api.json()).code,'DEVICE_LIMIT');
 const recovery=await f.proxy(new NextRequest('https://academy.example.com/devices',{headers}));assert.equal(recovery.status,200);assert.equal(f.checks,2);
});
test('missing browser cookie is established before registration, and API failures fail closed',async()=>{
 const f=proxyFixture();const r=await f.proxy(new NextRequest('https://academy.example.com/dashboard'));assert.equal(r.status,307);assert.equal(f.checks,0);assert.ok(r.headers.get('set-cookie').includes('HttpOnly'));
 const api=await f.proxy(new NextRequest('https://academy.example.com/api/profile'));assert.equal(api.status,403);assert.equal(f.checks,0);
 const recovery=await f.proxy(new NextRequest('https://academy.example.com/devices'));assert.equal(recovery.status,307);assert.equal(f.checks,0);
 const broken=proxyFixture({fail:true});assert.equal((await broken.proxy(new NextRequest('https://academy.example.com/dashboard',{headers:{cookie:'djawed-browser-v1='+'a'.repeat(64)}}))).status,503);
});
test('anonymous users cannot reach private APIs or recovery; lead submission remains public',async()=>{
 const f=proxyFixture({identity:null});assert.equal((await f.proxy(new NextRequest('https://academy.example.com/api/profile'))).status,401);
 assert.equal((await f.proxy(new NextRequest('https://academy.example.com/devices'))).status,307);
 assert.equal((await f.proxy(new NextRequest('https://academy.example.com/api/leads'))).status,200);
});

function deviceRoute({rpcResult={ok:true},mailOk=true,identity=true}={}){
 const calls=[],mail=[],updates=[];let token='a'.repeat(64);
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:rpcResult};},from:()=>({update(data){updates.push(data);return this;},eq(){return this;},is(){return Promise.resolve({});}})};
 const route=load('app/api/account-devices/route.ts',{
  'next/headers':{cookies:async()=>({get:()=>({value:token}),set:(name,value)=>token=value})},
  '@/lib/supabase/server':{createClient:async()=>({})},'@/lib/supabase/admin':{createAdminClient:()=>db},
  '@/lib/accountAccess':{verifiedIdentity:async()=>identity?{user:{id:userId,email:'actual-owner@example.com'},sessionId}:null,
   browserToken:v=>v,DEVICE_COOKIE:'device',DEVICE_COOKIE_OPTIONS:{},tokenHash:()=> 'hash',browserLabel:()=> 'Chrome',verificationHash:(id,code)=>'hashed-'+code,
   sameOrigin:r=>r.headers.get('origin')==='https://academy.example.com'},
  '@/lib/security':{readJsonObject:r=>r.json(),isUuid:v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v)},
  '@/lib/lessonEmails':{lessonEmailConfig:()=>({key:'private',from:'Platform <notify@example.com>',url:'https://academy.example.com'}),escapeEmailHtml:s=>s},
 },{fetch:async(url,options)=>{mail.push(JSON.parse(options.body));return {ok:mailOk};}});
 const request=body=>route.POST(new Request('https://academy.example.com/api/account-devices',{method:'POST',headers:{origin:'https://academy.example.com','content-type':'application/json'},body:JSON.stringify(body)}));
 return {route,request,calls,mail,updates};
}
test('replacement email is sent only to the authenticated account, never a supplied recipient, and returns no code',async()=>{
 const f=deviceRoute();const r=await f.request({action:'request',targetId,email:'friend@example.com'});assert.equal(r.status,200);
 const data=await r.json();assert.ok(data.challengeId);assert.equal(data.code,undefined);assert.deepEqual(f.mail[0].to,['actual-owner@example.com']);
 assert.match(f.calls[0].args.p_code_hash,/^hashed-\d{6}$/);assert.ok(f.updates.some(u=>u.sent_at));
});
test('cooldown/rate rejection never sends email; failed sending cancels the challenge',async()=>{
 for(const error of ['cooldown','rate']){const f=deviceRoute({rpcResult:{error}});assert.equal((await f.request({action:'request',targetId})).status,429);assert.equal(f.mail.length,0);}
 const f=deviceRoute({mailOk:false});assert.equal((await f.request({action:'request',targetId})).status,503);assert.ok(f.updates.some(u=>u.consumed_at));
});
test('verification requires authentication and same-origin; client cannot choose the user or browser binding',async()=>{
 const f=deviceRoute({identity:false});assert.equal((await f.request({action:'request',targetId})).status,401);assert.equal(f.calls.length,0);
 const g=deviceRoute();assert.equal((await g.route.POST(new Request('https://academy.example.com/api/account-devices',{method:'POST',headers:{origin:'https://other.example.com'}}))).status,403);
 await g.request({action:'confirm',challengeId:targetId,code:'123456',userId:'attacker',hash:'forged'});
 assert.equal(g.calls[0].args.p_user,userId);assert.equal(g.calls[0].args.p_session,sessionId);assert.equal(g.calls[0].args.p_hash,'hash');
});
