const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(path,deps={}){
 const exports={};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,require:n=>deps[n]??require(n),process,Buffer,URL,Date,console});return exports;
}
const accessApi=load('lib/trialAccess.ts');
test('trial dates fail closed; full/admin access is never expired by a stale trial date',()=>{
 const p={access_mode:'trial',trial_module_id:'first',trial_expires_at:'2026-12-01T00:00:00Z'};
 assert.equal(accessApi.resolvePlatformAccess(p,Date.parse('2026-11-30T23:59:59Z')).mode,'trial');
 assert.equal(accessApi.resolvePlatformAccess(p,Date.parse('2026-12-01T00:00:00Z')).mode,'expired');
 assert.equal(accessApi.resolvePlatformAccess({...p,trial_expires_at:'invalid'}).mode,'expired');
 assert.equal(accessApi.resolvePlatformAccess({...p,trial_module_id:null}).mode,'expired');
 assert.equal(accessApi.resolvePlatformAccess({...p,access_mode:'full'}).mode,'full');
 assert.equal(accessApi.resolvePlatformAccess({...p,is_admin:true}).mode,'full');
});
function viewing({mode='trial',module='first',profileFailure=false,origin=true}={}){
 let leases=0,serviceReads=0;
 const query={select(){return this},eq(){return this},single:async()=>({data:{module_id:module},error:null})};
 const route=load('app/api/viewing/route.ts',{
  'next/server':{NextResponse:{json:(body,opts)=>({body,status:opts.status})}},
  '@/lib/supabase/server':{createClient:async()=>({})},
  '@/lib/supabase/admin':{createAdminClient:()=>({from(){serviceReads++;return query},rpc:async()=>{leases++;return {data:{allowed:true}}}})},
  '@/lib/accountAccess':{sameOrigin:()=>origin,verifiedIdentity:async()=>({user:{id:'student'},sessionId:'session'}),VIEWING_STOP_MESSAGE:'stopped'},
  '@/lib/security':{isUuid:()=>true,readJsonObject:async request=>request.body},
  '@/lib/moduleVisibility':{hiddenModuleIds:async()=>new Set()},
  '@/lib/lessonLocking':{computeLockedLessonIds:()=>new Set()},
  '@/lib/trialAccess':{getPlatformAccess:async()=>{if(profileFailure)throw Error('db down');return {mode,moduleId:'first'}},trialCanViewModule:accessApi.trialCanViewModule},
 });
 return {route,get leases(){return leases},get serviceReads(){return serviceReads}};
}
const req=action=>({body:{lessonId:'lesson',leaseId:'lease',action}});
test('direct start and heartbeat requests for a later module never reach the viewing lease',async()=>{
 for(const action of ['start','heartbeat']){
  const f=viewing({module:'later'}),res=await f.route.POST(req(action));
  assert.equal(res.status,403);assert.equal(res.body.code,'full_access_required');assert.equal(f.leases,0);
 }
});
test('expiry and failed access verification stop heartbeat rather than extending playback',async()=>{
 const expired=viewing({mode:'expired'});assert.equal((await expired.route.POST(req('heartbeat'))).status,403);assert.equal(expired.leases,0);
 const unavailable=viewing({profileFailure:true});assert.equal((await unavailable.route.POST(req('heartbeat'))).status,503);assert.equal(unavailable.leases,0);
});
test('an active trial renews only the first module; cross-origin requests never read video metadata',async()=>{
 const valid=viewing();assert.equal((await valid.route.POST(req('heartbeat'))).status,200);assert.equal(valid.leases,1);
 const cross=viewing({origin:false});assert.equal((await cross.route.POST(req('heartbeat'))).status,403);assert.equal(cross.serviceReads,0);
});
test('trial cannot submit support requests through the service-role endpoint',async()=>{
 let inserts=0;
 const route=load('app/api/support/route.ts',{
  'next/server':{NextResponse:{json:(body,opts)=>({body,status:opts?.status??200})},after:()=>assert.fail('No email for trial')},
  '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'trial'}}})}})},
  '@/lib/supabase/admin':{createAdminClient:()=>{inserts++;throw Error('No privileged write expected')}},
  '@/lib/trialAccess':{getPlatformAccess:async()=>({mode:'trial'})},
  '@/lib/security':{},'@/lib/supportEmails':{},
 });
 assert.equal((await route.POST({})).status,403);assert.equal(inserts,0);
});
