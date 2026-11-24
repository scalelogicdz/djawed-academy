import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();after(()=>db.close());
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_user::text$$;`);
await db.exec(readFileSync('supabase/schema.sql','utf8'));
await db.exec(`create table public.site_content(key text primary key,content jsonb);
create table public.notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid references public.profiles(id) on delete cascade,body text);
create table public.community_alerts(id uuid primary key default gen_random_uuid(),recipient_id uuid references public.profiles(id) on delete cascade);
create table public.quiz_questions(id uuid primary key,body text);
alter table public.quiz_questions enable row level security;
create policy quiz_legacy on public.quiz_questions for all to authenticated using(true) with check(true);
create function public.community_notification_inbox() returns table(id uuid,type text,question_id uuid,reply_id uuid,is_read boolean,created_at timestamptz,actor_id uuid,actor_display_name text,source text) language sql security definer as $$select null::uuid,'secret',null::uuid,null::uuid,false,now(),null::uuid,'Private','legacy'$$;
create function public.mark_community_notifications_read(uuid default null,text default null) returns void language plpgsql security definer as $$begin return;end$$;
grant usage on schema public,auth to authenticated,service_role;
grant select,insert,update,delete on all tables in schema public to authenticated,service_role;`);
const migration=readFileSync('supabase/trial-access.sql','utf8').replace(/-- SCHEDULER BEGIN[\s\S]*?-- SCHEDULER END/,'');
await db.exec(migration);
const course=randomUUID(),m1=randomUUID(),m2=randomUUID(),l1=randomUUID(),l2=randomUUID(),l3=randomUUID();
await db.query("insert into public.courses(id,title) values($1,'Test')",[course]);
await db.query("insert into public.modules(id,course_id,title,position) values($1,$3,'First',1),($2,$3,'Second',2)",[m1,m2,course]);
await db.query("insert into public.lessons(id,module_id,title,video_id,resource_url,position) values($1,$4,'One','secret1','https://private/one',1),($2,$4,'Two','secret2',null,2),($3,$5,'Three','secret3',null,1)",[l1,l2,l3,m1,m2]);
const full=randomUUID();await db.query('insert into auth.users values($1)',[full]);
await db.query("insert into public.profiles(id,full_name,display_name) values($1,'Existing','Existing')",[full]);
await db.query('insert into public.enrollments(student_id,course_id) values($1,$2)',[full,course]);
async function trial(){const id=randomUUID();await db.query('insert into auth.users values($1)',[id]);await db.query("select public.create_trial_student($1,'Trial','Trial',$2)",[id,course]);return id;}
async function asUser(id,fn){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id})]);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}}
async function expire(id){await db.query("update public.profiles set trial_started_at=now()-interval '8 days',trial_expires_at=now()-interval '1 day' where id=$1",[id]);}

test('first module snapshot; exact seven day expiry; reruns preserve full/trial status',async()=>{
 const id=await trial();let p=(await db.query('select * from public.profiles where id=$1',[id])).rows[0];
 assert.equal(p.trial_module_id,m1);assert.equal(new Date(p.trial_expires_at)-new Date(p.trial_started_at),7*86400000);
 await db.exec(migration);p=(await db.query('select * from public.profiles where id=$1',[id])).rows[0];assert.equal(p.access_mode,'trial');
 assert.equal((await db.query('select ever_full_access from public.profiles where id=$1',[full])).rows[0].ever_full_access,true);
});
test('RLS blocks raw videos/resources, other modules, quizzes, community and progress spoofing',async()=>{
 const id=await trial();await db.query("insert into public.questions(student_id,body) values($1,'Private')",[full]);
 await db.query("insert into public.quiz_questions values($1,'Private quiz')",[randomUUID()]);
 await asUser(id,async()=>{
  assert.equal((await db.query('select * from public.lessons')).rows.length,0);
  assert.deepEqual((await db.query('select id from public.modules')).rows.map(r=>r.id),[m1]);
  assert.equal((await db.query('select * from public.questions')).rows.length,0);
  assert.equal((await db.query('select * from public.quiz_questions')).rows.length,0);
  await assert.rejects(db.query("insert into public.questions(student_id,body) values($1,'Bypass')",[id]),/row-level security/);
  await assert.rejects(db.query('insert into public.lesson_progress(student_id,lesson_id) values($1,$2)',[id,l3]),/row-level security/);
  await db.query('insert into public.lesson_progress(student_id,lesson_id) values($1,$2)',[id,l1]);
  assert.equal((await db.query('select * from public.lesson_progress')).rows.length,1);
  await db.query("update public.profiles set access_mode='full' where id=$1",[id]);
  assert.equal((await db.query('select access_mode from public.profiles where id=$1',[id])).rows[0].access_mode,'trial');
 });
});
test('security-definer RPCs cannot bypass trial or expose private notification helper',async()=>{
 const id=await trial();await asUser(id,async()=>{
  await assert.rejects(db.query('select * from public.community_notification_inbox()'),/Full access required/);
  await assert.rejects(db.query('select * from public.full_community_notification_inbox()'),/permission denied/);
  await assert.rejects(db.query('select public.mark_community_notifications_read()'),/Full access required/);
  await assert.rejects(db.query('select public.upgrade_trial_student($1,$2)',[id,course]),/permission denied/);
  await assert.rejects(db.query('select public.delete_expired_trial_accounts()'),/permission denied/);
 });
});
test('expiry blocks access before cleanup and cannot be extended by the student',async()=>{
 const id=await trial();await expire(id);
 await asUser(id,async()=>{
  assert.equal((await db.query('select public.trial_account_active() allowed')).rows[0].allowed,false);
  assert.equal((await db.query('select * from public.modules')).rows.length,0);
  assert.equal((await db.query('select * from public.enrollments')).rows.length,0);
  assert.equal((await db.query('select public.trial_lesson_allowed($1) allowed',[l1])).rows[0].allowed,false);
 });
});
test('upgrade cancels deletion permanently; no downgrade of existing paid accounts',async()=>{
 const id=await trial();await expire(id);await db.query('select public.upgrade_trial_student($1,$2)',[id,course]);
 const p=(await db.query('select * from public.profiles where id=$1',[id])).rows[0];
 assert.equal(p.access_mode,'full');assert.equal(p.ever_full_access,true);assert.equal(p.trial_expires_at,null);
 await db.query('select public.delete_expired_trial_accounts()');
 assert.equal((await db.query('select * from auth.users where id=$1',[id])).rows.length,1);
 await assert.rejects(db.query("update public.profiles set access_mode='trial',ever_full_access=false where id=$1",[full]),/cannot be converted/);
 await asUser(id,async()=>assert.equal((await db.query('select id from public.lessons')).rows.length,3));
});
test('only expired never-full non-admin trials are deleted; active and existing accounts survive',async()=>{
 const expired=await trial(),active=await trial();await expire(expired);await db.query('select public.delete_expired_trial_accounts()');
 assert.equal((await db.query('select * from auth.users where id=$1',[expired])).rows.length,0);
 for(const id of [full,active])assert.equal((await db.query('select * from auth.users where id=$1',[id])).rows.length,1);
 assert.equal((await db.query('select * from public.profiles where id=$1',[expired])).rows.length,0);
 await assert.rejects(db.query('select public.upgrade_trial_student($1,$2)',[expired,course]),/no longer exists/);
});
