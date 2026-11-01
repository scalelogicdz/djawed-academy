const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(path,deps,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>deps[n]??require(n),Request,URL,Buffer,AbortSignal,console,process,...globals});return exports;}
test('cumulative browser counts paginate all accounts and return numbers only',async()=>{
 const calls=[];const rows=Array.from({length:501},(_,i)=>({user_id:'user-'+i,browser_count:i+1}));
 const db={rpc(name){assert.equal(name,'browser_connection_counts');return {order(field){assert.equal(field,'user_id');return this;},range(a,b){calls.push([a,b]);return Promise.resolve({data:rows.slice(a,b+1)});}};}};
 const m=load('lib/browserConnections.ts',{'@/lib/supabase/admin':{createAdminClient:()=>db}});
 const result=await m.browserConnectionCounts();
 assert.equal(result['user-0'],1);assert.equal(result['user-500'],501);assert.equal(calls.length,2);
 assert.ok(Object.values(result).every(value=>typeof value==='number'));
});
test('failed presence reads report unavailable instead of fabricating zero devices',async()=>{
 const db={rpc:()=>({order(){return this;},range:async()=>({error:{message:'missing migration'}})})};
 const m=load('lib/browserConnections.ts',{'@/lib/supabase/admin':{createAdminClient:()=>db}});
 await assert.rejects(m.browserConnectionCounts(),/unavailable/);
});
test('only an authenticated admin can see cumulative browser counts',async()=>{
 for(const [user,admin,status] of [[null,false,401],[{id:'student'},false,403],[{id:'admin'},true,200]]){
  let reads=0;const client={auth:{getUser:async()=>({data:{user}})},from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:{is_admin:admin}})})};
  const m=load('app/api/admin/browser-connections/route.ts',{'@/lib/supabase/server':{createClient:async()=>client},'@/lib/browserConnections':{browserConnectionCounts:async()=>{reads++;return {};}}});
  const response=await m.GET();assert.equal(response.status,status);assert.equal(reads,status===200?1:0);assert.equal(response.headers.get('Cache-Control'),'no-store');
 }
});
test('successful password login records the authenticated account; failed login never adds a browser',async()=>{
 for(const valid of [false,true]){
  const calls=[];const client={auth:{signInWithPassword:async()=>({data:{user:valid?{id:'actual-student'}:null},error:valid?null:{message:'invalid'}})}};
  const m=load('app/api/auth/login/route.ts',{
   '@/lib/supabase/server':{createClient:async()=>client},
   '@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,args)=>{calls.push(args);return {};}})},
   'next/headers':{cookies:async()=>({get:()=>({value:'opaque'}),set(){}})},
   '@/lib/accountAccess':{browserToken:v=>v,tokenHash:()=> 'hash',browserLabel:()=> 'Chrome',DEVICE_COOKIE:'browser',DEVICE_COOKIE_OPTIONS:{}},
   '@/lib/security':{readJsonObject:r=>r.json(),cleanEmail:v=>v,clientIp:()=> 'test',checkRateLimit:()=>({allowed:true})},
  });
  const r=await m.POST(new Request('https://academy.example.com/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'student@example.com',password:'secret',userId:'forged'})}));
  assert.equal(r.status,valid?200:401);assert.equal(calls.length,valid?1:0);if(valid)assert.equal(calls[0].p_user,'actual-student');
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
