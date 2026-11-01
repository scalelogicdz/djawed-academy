const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(path,deps={},globals={}){
 const exports={};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,require:n=>deps[n]??require(n),process,Buffer,URL,AbortSignal,console,...globals});return exports;
}
const helper=()=>load('lib/accountAccess.ts',{'@/lib/supabase/admin':{createAdminClient:()=>({})}});
test('browser identity is random, stable when valid, and only hashed values are stored',()=>{
 const h=helper();const a=h.browserToken();const b=h.browserToken();assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,b);assert.equal(h.browserToken(a),a);
 assert.notEqual(h.browserToken('forged'), 'forged');assert.match(h.tokenHash(a),/^[a-f0-9]{64}$/);assert.notEqual(h.tokenHash(a),a);
 assert.equal(h.DEVICE_COOKIE_OPTIONS.httpOnly,true);assert.equal(h.DEVICE_COOKIE_OPTIONS.sameSite,'lax');
});
test('Auth session claims are used only after validating the user and matching the subject',async()=>{
 const h=helper();let sessionReads=0;
 const session=claims=>({access_token:`x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.x`});
 const sid='11111111-1111-4111-8111-111111111111';
 function client(user,claims){return {auth:{getUser:async()=>({data:{user}}),getSession:async()=>{sessionReads++;return {data:{session:session(claims)}};}}};}
 assert.equal(await h.verifiedIdentity(client(null,{})),null);assert.equal(sessionReads,0);
 assert.equal(await h.verifiedIdentity(client({id:'one'},{sub:'other',session_id:sid})),null);
 assert.equal((await h.verifiedIdentity(client({id:'one'},{sub:'one',session_id:sid}))).sessionId,sid);
});
test('mutating endpoints require a same-origin browser request',()=>{
 const h=helper();const req=origin=>new Request('https://academy.example.com/api/viewing',{headers:origin?{origin}:{}});
 assert.equal(h.sameOrigin(req('https://academy.example.com')),true);assert.equal(h.sameOrigin(req('https://attacker.example')),false);assert.equal(h.sameOrigin(req()),false);
});

function playerHarness(fetcher,acceptTakeover=false){
 let cursor=0,scheduled=false,dead=false,result;const slots=[],pending=[],timers=new Map(),events=new Map();let nextTimer=0;
 const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>v===b[i]);
 function queue(){if(!scheduled&&!dead){scheduled=true;queueMicrotask(()=>{scheduled=false;if(!dead)render();});}}
 const react={
  useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:initial};return [slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;queue();}];},
  useRef(value){const i=cursor++;if(!slots[i])slots[i]={ref:{current:value}};return slots[i].ref;},
  useCallback(fn,deps){const i=cursor++;if(!slots[i]||!equal(slots[i].deps,deps))slots[i]={deps,value:fn};return slots[i].value;},
  useEffect(fn,deps){const i=cursor++;if(!slots[i]||!equal(slots[i].deps,deps)){const old=slots[i];slots[i]={deps};pending.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}},
 };
 const document={visibilityState:'visible',addEventListener:(n,f)=>events.set(n,f),removeEventListener:(n,f)=>{if(events.get(n)===f)events.delete(n);}};
 const window={confirm:()=>acceptTakeover,setInterval:(fn,ms)=>{timers.set(++nextTimer,{fn,ms});return nextTimer;},clearInterval:id=>timers.delete(id),addEventListener:document.addEventListener,removeEventListener:document.removeEventListener};
 const calls=[];const hook=load('components/useViewingSession.ts',{react},{document,window,fetch:async(url,options)=>{const payload=JSON.parse(options.body);calls.push(payload);return fetcher(payload);}}).default;
 function render(){cursor=0;result=hook('11111111-1111-4111-8111-111111111111');while(pending.length)pending.shift()();}render();
 return {get result(){return result;},calls,async tick(){for(const t of [...timers.values()])if(t.ms===5000)await t.fn();await flush();},async hide(){document.visibilityState='hidden';events.get('visibilitychange')?.();await flush();},destroy(){dead=true;for(const s of slots)s.cleanup?.();}};
}
const response=(ok,data)=>({ok,json:async()=>data});
async function flush(){for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));}
test('a superseded viewing session removes its player and never automatically reacquires',async()=>{
 const h=playerHarness(p=>p.action==='start'?response(true,{leaseId:'lease-1',url:'https://player.example/1'}):p.action==='heartbeat'?response(false,{error:'Session moved'}):response(true,{}));
 await h.result.start();await flush();assert.equal(h.result.url,'https://player.example/1');
 await h.tick();assert.equal(h.result.url,null);assert.equal(h.result.error,'Session moved');
 await h.tick();assert.equal(h.calls.filter(c=>c.action==='start').length,1);h.destroy();
});
test('connection failure stops viewing instead of allowing an unchecked player to continue',async()=>{
 const h=playerHarness(p=>{if(p.action==='start')return response(true,{leaseId:'lease-1',url:'https://player.example/1'});if(p.action==='heartbeat')throw new Error('offline');return response(true,{});});
 await h.result.start();await flush();await h.tick();assert.equal(h.result.url,null);assert.ok(h.result.error);h.destroy();
});
test('unmount releases only its lease, including a late start response',async()=>{
 let resolveStart;const h=playerHarness(p=>p.action==='start'?new Promise(r=>resolveStart=r):response(true,{}));
 const start=h.result.start();h.destroy();resolveStart(response(true,{leaseId:'late-lease',url:'https://player.example'}));await start;await flush();
 assert.ok(h.calls.some(c=>c.action==='stop'&&c.leaseId==='late-lease'));
});
test('hidden pages stop viewing so browser timer throttling cannot keep an old player running',async()=>{
 const h=playerHarness(p=>response(true,p.action==='start'?{leaseId:'lease-1',url:'https://player.example/1'}:{}));
 await h.result.start();await flush();await h.hide();assert.equal(h.result.url,null);assert.ok(h.calls.some(c=>c.action==='stop'));h.destroy();
});
test('a delayed start cannot mount a player after the page has gone into the background',async()=>{
 let resolveStart;const h=playerHarness(p=>p.action==='start'?new Promise(r=>resolveStart=r):response(true,{}));
 const started=h.result.start();await h.hide();resolveStart(response(true,{leaseId:'late-hidden',url:'https://player.example'}));await started;await flush();
 assert.equal(h.result.url,null);assert.ok(h.calls.some(c=>c.action==='stop'&&c.leaseId==='late-hidden'));h.destroy();
});
test('taking over an active viewer requires the student to confirm',async()=>{
 for(const accept of [false,true]){
  const h=playerHarness(p=>p.action==='start'&&!p.takeover?response(false,{code:'active'}):response(true,{leaseId:'new',url:'https://player.example'}),accept);
  await h.result.start();await flush();
  assert.equal(h.calls.filter(c=>c.action==='start').length,accept?2:1);
  assert.equal(h.result.url,accept?'https://player.example':null);h.destroy();
 }
});
