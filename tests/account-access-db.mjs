import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
after(()=>db.close());
const sql=s=>db.exec(s);
await sql(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;`);
await sql(readFileSync('supabase/schema.sql','utf8'));
await sql('grant usage on schema public,auth to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated;');
const migration=readFileSync('supabase/account-access.sql','utf8');
await sql(migration);
await sql('update public.account_access_settings set enabled=true;');
const hash=s=>createHash('sha256').update(s).digest('hex');
async function call(name,args){const casts={register_account_browser:['uuid','uuid','text','text'],begin_account_device_replacement:['uuid','uuid','text','text','uuid','uuid','text'],confirm_account_device_replacement:['uuid','uuid','text','uuid','text'],account_viewing_lease:['uuid','uuid','text','uuid','uuid','text']};const cs=casts[name];return(await db.query(`select public.${name}(${cs.map((c,i)=>`$${i+1}::${c}`).join(',')}) result`,args)).rows[0].result;}
async function fixture(){
 const u=randomUUID(),s1=randomUUID(),s2=randomUUID(),s3=randomUUID(),course=randomUUID(),module=randomUUID(),lesson=randomUUID();
 await db.query('insert into auth.users values($1)',[u]);
 for(const s of [s1,s2,s3])await db.query('insert into auth.sessions values($1,$2)',[s,u]);
 await db.query("insert into public.profiles(id,full_name,display_name) values($1,'Student','Student')",[u]);
 await db.query("insert into public.courses(id,title) values($1,'Course')",[course]);
 await db.query("insert into public.modules(id,course_id,title) values($1,$2,'Module')",[module,course]);
 await db.query("insert into public.lessons(id,module_id,title) values($1,$2,'Lesson')",[lesson,module]);
 await db.query('insert into public.enrollments(student_id,course_id) values($1,$2)',[u,course]);
 const h1=hash(randomUUID()),h2=hash(randomUUID()),h3=hash(randomUUID());
 const reg=(s,h)=>call('register_account_browser',[u,s,h,'Chrome · Windows']);
 return {u,s1,s2,s3,h1,h2,h3,lesson,reg};
}
async function request(f,target,{code='correct',id=randomUUID()}={}){
 const result=await call('begin_account_device_replacement',[f.u,f.s3,f.h3,'Safari · iOS',target,id,hash(code)]);
 if(result.ok)await db.query('update public.account_device_challenges set sent_at=now() where id=$1',[id]);
 return {id,result};
}
const confirm=(f,id,code='correct',h=f.h3,s=f.s3)=>call('confirm_account_device_replacement',[f.u,s,h,id,hash(code)]);
test('migration is rerunnable and does not enable enforcement on its own',async()=>{
 await sql('update public.account_access_settings set enabled=false;');await sql(migration);
 assert.equal((await db.query('select enabled from public.account_access_settings')).rows[0].enabled,false);
 await sql('update public.account_access_settings set enabled=true;');
});
test('two browsers admitted, third blocked; new login on an existing browser reuses its slot',async()=>{
 const f=await fixture();const r=await Promise.all([f.reg(f.s1,f.h1),f.reg(f.s2,f.h2),f.reg(f.s3,f.h3)]);
 assert.equal(r.filter(v=>v.allowed).length,2);assert.equal(r[2].reason,'limit');
 assert.equal((await f.reg(f.s3,f.h1)).allowed,true);
 assert.equal((await db.query('select count(*)::int n from public.account_browsers where user_id=$1 and revoked_at is null',[f.u])).rows[0].n,2);
});
test('invalid or mismatched Auth sessions cannot register browsers',async()=>{
 const f=await fixture(),other=await fixture();assert.equal((await f.reg(other.s1,f.h1)).allowed,false);
 assert.equal((await f.reg(randomUUID(),f.h1)).allowed,false);
});
test('replacement requires email delivery, matching browser/session, unexpired code and at most five guesses',async()=>{
 const f=await fixture();const a=await f.reg(f.s1,f.h1);await f.reg(f.s2,f.h2);
 const {id,result}=await request(f,a.browserId);assert.equal(result.ok,true);
 await db.query('update public.account_device_challenges set sent_at=null where id=$1',[id]);
 assert.equal((await confirm(f,id)).error,'invalid');
 await db.query('update public.account_device_challenges set sent_at=now() where id=$1',[id]);
 assert.equal((await confirm(f,id,'correct',f.h2)).error,'invalid');
 assert.equal((await confirm(f,id,'correct',f.h3,f.s2)).error,'invalid');
 for(let i=0;i<5;i++)assert.equal((await confirm(f,id,'wrong')).error,'invalid');
 assert.equal((await confirm(f,id)).error,'invalid');
 assert.equal((await f.reg(f.s1,f.h1)).allowed,true);
});
test('expired challenges cannot replace a browser',async()=>{
 const f=await fixture();const a=await f.reg(f.s1,f.h1);await f.reg(f.s2,f.h2);const {id}=await request(f,a.browserId);
 await db.query("update public.account_device_challenges set expires_at=now()-interval '1 second' where id=$1",[id]);
 assert.equal((await confirm(f,id)).error,'invalid');
});
test('verified replacement revokes old access, is single use, and imposes seven-day account cooldown',async()=>{
 const f=await fixture();const a=await f.reg(f.s1,f.h1);await f.reg(f.s2,f.h2);const {id}=await request(f,a.browserId);
 assert.equal((await confirm(f,id)).ok,true);assert.equal((await confirm(f,id)).error,'invalid');
 assert.equal((await f.reg(f.s1,f.h1)).reason,'revoked');assert.equal((await f.reg(f.s3,f.h3)).allowed,true);
 const oldSid=randomUUID();await db.query('insert into auth.sessions values($1,$2)',[oldSid,f.u]);
 const r=await call('begin_account_device_replacement',[f.u,oldSid,f.h1,'Chrome', (await db.query('select id from public.account_browsers where user_id=$1 and token_hash=$2',[f.u,f.h2])).rows[0].id,randomUUID(),hash('new')]);
 assert.equal(r.error,'cooldown');
 assert.equal((await db.query('select count(*)::int n from public.account_browsers where user_id=$1 and revoked_at is null',[f.u])).rows[0].n,2);
});
test('replacement email requests are limited across server instances',async()=>{
 const f=await fixture();const a=await f.reg(f.s1,f.h1);await f.reg(f.s2,f.h2);
 assert.equal((await request(f,a.browserId)).result.ok,true);
 assert.equal((await request(f,a.browserId)).result.error,'rate');
 for(let i=0;i<2;i++){
  await db.query("update public.account_device_challenges set created_at=created_at-interval '61 seconds' where user_id=$1",[f.u]);
  assert.equal((await request(f,a.browserId)).result.ok,true);
 }
 await db.query("update public.account_device_challenges set created_at=created_at-interval '61 seconds' where user_id=$1",[f.u]);
 assert.equal((await request(f,a.browserId)).result.error,'rate');
});
test('new viewing lease replaces old; old heartbeat or release cannot reclaim or delete the new lease',async()=>{
 const f=await fixture();await f.reg(f.s1,f.h1);await f.reg(f.s2,f.h2);const l1=randomUUID(),l2=randomUUID();
 const lease=(s,h,l,a)=>call('account_viewing_lease',[f.u,s,h,l,f.lesson,a]);
 assert.equal((await lease(f.s1,f.h1,l1,'start')).allowed,true);
 assert.equal((await lease(f.s2,f.h2,l2,'start')).allowed,true);
 assert.equal((await lease(f.s1,f.h1,l1,'heartbeat')).reason,'superseded');
 assert.equal((await lease(f.s1,f.h1,l1,'stop')).allowed,false);
 assert.equal((await lease(f.s2,f.h2,l2,'heartbeat')).allowed,true);
 await db.query("update public.account_viewing_sessions set expires_at=now()-interval '1 second' where user_id=$1",[f.u]);
 assert.equal((await lease(f.s2,f.h2,l2,'heartbeat')).reason,'expired');
 assert.equal((await lease(f.s2,f.h2,l2,'start')).allowed,true);
 assert.equal((await lease(f.s2,f.h2,l2,'stop')).allowed,true);
});
test('viewing checks enrollment and registered browser; replacement kills its old viewing lease',async()=>{
 const f=await fixture(),other=await fixture();const a=await f.reg(f.s1,f.h1);await f.reg(f.s2,f.h2);
 const lease=randomUUID();
 assert.equal((await call('account_viewing_lease',[f.u,f.s3,f.h3,lease,f.lesson,'start'])).reason,'device');
 assert.equal((await call('account_viewing_lease',[f.u,f.s1,f.h1,lease,other.lesson,'start'])).reason,'lesson');
 await call('account_viewing_lease',[f.u,f.s1,f.h1,lease,f.lesson,'start']);
 const {id}=await request(f,a.browserId);await confirm(f,id);
 assert.equal((await call('account_viewing_lease',[f.u,f.s1,f.h1,lease,f.lesson,'heartbeat'])).reason,'device');
});
test('RLS denies direct content access from unregistered/replaced Auth sessions; private tables and mutating RPCs are inaccessible',async()=>{
 const f=await fixture();const a=await f.reg(f.s1,f.h1);await f.reg(f.s2,f.h2);
 async function asBrowser(s,operation){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:f.u,session_id:s})]);await sql('set role authenticated;');try{return await operation();}finally{await sql('reset role;');}}
 assert.equal((await asBrowser(f.s1,()=>db.query('select id from public.lessons where id=$1',[f.lesson]))).rows.length,1);
 assert.equal((await asBrowser(f.s3,()=>db.query('select id from public.lessons where id=$1',[f.lesson]))).rows.length,0);
 await assert.rejects(asBrowser(f.s3,()=>db.query('select * from public.account_browsers')),/permission denied/);
 await assert.rejects(asBrowser(f.s3,()=>f.reg(f.s3,f.h3)),/permission denied/);
 const {id}=await request(f,a.browserId);await confirm(f,id);
 assert.equal((await asBrowser(f.s1,()=>db.query('select id from public.lessons where id=$1',[f.lesson]))).rows.length,0);
 assert.equal((await asBrowser(f.s3,()=>db.query('select id from public.lessons where id=$1',[f.lesson]))).rows.length,1);
});
