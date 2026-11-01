const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(path,deps,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>deps[n]??require(n),Request,URL,Buffer,AbortSignal,console,process,...globals});return exports;}
test('browser counts paginate all active rows and do not expose cookie hashes',async()=>{
 const calls=[];const rows=Array.from({length:501},(_,i)=>({id:'b'+i,user_id:i<500?'one':'two',label:'Chrome',last_seen_at:'2026-11-01T10:00:00Z',last_seen_path:'/dashboard'}));
 const db={from(name){assert.equal(name,'browser_connections');let from,to;return {select(fields){assert.ok(!fields.includes('hash'));return this;},gte(field,value){calls.push({field,value});return this;},order(){return this;},range(a,b){from=a;to=b;return Promise.resolve({data:rows.slice(from,to+1)});}};}};
 const m=load('lib/browserConnections.ts',{'@/lib/supabase/admin':{createAdminClient:()=>db}});
 const now=Date.parse('2026-11-01T10:00:30Z');const result=await m.activeBrowserConnections(now);
 assert.equal(result.one.length,500);assert.equal(result.two.length,1);assert.equal(calls.length,2);assert.equal(calls[0].value,'2026-11-01T09:59:00.000Z');
 assert.equal(result.one[0].browser_hash,undefined);
});
test('failed presence reads report unavailable instead of fabricating zero devices',async()=>{
 const db={from:()=>({select(){return this;},gte(){return this;},order(){return this;},range:async()=>({error:{message:'missing migration'}})})};
 const m=load('lib/browserConnections.ts',{'@/lib/supabase/admin':{createAdminClient:()=>db}});
 await assert.rejects(m.activeBrowserConnections(),/unavailable/);
});
test('only an authenticated admin can see account browser details',async()=>{
 for(const [user,admin,status] of [[null,false,401],[{id:'student'},false,403],[{id:'admin'},true,200]]){
  let reads=0;const client={auth:{getUser:async()=>({data:{user}})},from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:{is_admin:admin}})})};
  const m=load('app/api/admin/browser-connections/route.ts',{'@/lib/supabase/server':{createClient:async()=>client},'@/lib/browserConnections':{activeBrowserConnections:async()=>{reads++;return {};}}});
  const response=await m.GET();assert.equal(response.status,status);assert.equal(reads,status===200?1:0);assert.equal(response.headers.get('Cache-Control'),'no-store');
 }
});
test('heartbeat derives the account and browser on the server, and strips URL query details',async()=>{
 const recorded=[];let cookie;
 const client={auth:{getUser:async()=>({data:{user:{id:'real-student'}}})},from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:{is_admin:false}})})};
 const db={from:()=>({update(){return this;},eq:async()=>({})}),rpc:async(name,args)=>{recorded.push({name,args});return {};}};
 const m=load('app/api/presence/heartbeat/route.ts',{
  '@/lib/supabase/server':{createClient:async()=>client},'@/lib/supabase/admin':{createAdminClient:()=>db},
  'next/headers':{cookies:async()=>({get:()=>({value:'opaque-browser'}),set:(name,value)=>cookie=value})},
  '@/lib/accountAccess':{sameOrigin:()=>true,browserToken:v=>v,tokenHash:()=> 'hash',browserLabel:()=> 'Chrome · Windows',DEVICE_COOKIE:'browser',DEVICE_COOKIE_OPTIONS:{}},
 });
 const response=await m.POST(new Request('https://academy.example.com/api/presence/heartbeat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path:'/dashboard?email=private@example.com',userId:'forged'})}));
 assert.equal(response.status,200);assert.equal(recorded[0].args.p_user,'real-student');assert.equal(recorded[0].args.p_path,'/dashboard');assert.equal(cookie,'opaque-browser');
});
