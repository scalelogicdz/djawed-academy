const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(path,requireMock=()=>({})){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:requireMock,Set,Date,console});return exports;}
const visibility=load('lib/moduleVisibility.ts');
test('only explicitly hidden modules are excluded; restoring preserves visibility',async()=>{
 const db={from(table){assert.equal(table,'site_content');return {select(){return this},async like(field,pattern){assert.equal(pattern,'module-visibility:%');return {data:[{key:'module-visibility:a',content:{hidden:true}},{key:'module-visibility:b',content:{hidden:false}},{key:'module-visibility:c',content:{}}]}}}}};
 assert.deepEqual([...await visibility.hiddenModuleIds(db)],['a']);
});
test('database failures do not silently show hidden modules',async()=>{
 const db={from(){return {select(){return this},like:async()=>({error:{code:'XX000'}})}}};
 await assert.rejects(()=>visibility.hiddenModuleIds(db));
});
function route({admin=true,missing=false,writeError=false}={}){
 const writes=[];const db={from(table){return {select(){return this},eq(){return this},single:async()=>table==='profiles'?{data:{is_admin:admin}}:{data:missing?null:{id:'module'}},upsert:async(value)=>{writes.push(value);return {error:writeError?{}:null}}}}};
 const api=load('app/api/admin/content/route.ts',name=>name==='next/server'?{NextResponse:{json:(body,opts)=>({body,status:opts?.status??200})},after:()=>{}}:name==='@/lib/security'?{checkRateLimit:()=>({allowed:true}),readJsonObject:async request=>request,isUuid:value=>typeof value==='string'&&value==='valid-id'}:name==='@/lib/supabase/server'?{createClient:async()=>({...db,auth:{getUser:async()=>({data:{user:{id:'admin'}}})}})}:name==='@/lib/supabase/admin'?{createAdminClient:()=>db}:name==='@/lib/moduleVisibility'?visibility:{});
 return {api,writes};
}
test('admin can hide and restore a module without altering lessons',async()=>{
 const {api,writes}=route();
 for(const hidden of [true,false]){const response=await api.PATCH({id:'valid-id',type:'moduleVisibility',hidden});assert.equal(response.status,200);assert.equal(response.body.hidden,hidden);assert.equal(writes.at(-1).key,'module-visibility:valid-id');assert.equal(writes.at(-1).content.hidden,hidden);}
});
test('student cannot change module visibility',async()=>{const {api,writes}=route({admin:false});assert.equal((await api.PATCH({id:'valid-id',type:'moduleVisibility',hidden:true})).status,403);assert.equal(writes.length,0)});
test('invalid visibility state and missing module never write settings',async()=>{
 const normal=route();assert.equal((await normal.api.PATCH({id:'valid-id',type:'moduleVisibility',hidden:'true'})).status,400);assert.equal(normal.writes.length,0);
 const missing=route({missing:true});assert.equal((await missing.api.PATCH({id:'valid-id',type:'moduleVisibility',hidden:true})).status,404);assert.equal(missing.writes.length,0);
});
test('failed persistence does not report successful hiding',async()=>{const {api}=route({writeError:true});assert.equal((await api.PATCH({id:'valid-id',type:'moduleVisibility',hidden:true})).status,500)});
