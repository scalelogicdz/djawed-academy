import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();after(()=>db.close());
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;`);
await db.exec(readFileSync('supabase/schema.sql','utf8'));
await db.exec('grant usage on schema public,auth to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated;');
const migration=readFileSync('supabase/account-access.sql','utf8');await db.exec(migration);
async function fixture(){
 const u=randomUUID(),s1=randomUUID(),s2=randomUUID(),s3=randomUUID(),course=randomUUID(),module=randomUUID(),lesson=randomUUID();
 await db.query('insert into auth.users values($1)',[u]);
 for(const s of [s1,s2,s3])await db.query('insert into auth.sessions values($1,$2)',[s,u]);
 await db.query("insert into public.profiles(id,full_name,display_name) values($1,'Student','Student')",[u]);
 await db.query("insert into public.courses(id,title) values($1,'Course')",[course]);
 await db.query("insert into public.modules(id,course_id,title) values($1,$2,'Module')",[module,course]);
 await db.query("insert into public.lessons(id,module_id,title) values($1,$2,'Lesson')",[lesson,module]);
 await db.query('insert into public.enrollments(student_id,course_id) values($1,$2)',[u,course]);
 const view=(s,l,a='start',takeover=false,lessonId=lesson)=>db.query('select public.manage_lesson_viewing($1,$2,$3,$4,$5,$6) result',[u,s,l,lessonId,a,takeover]).then(r=>r.rows[0].result);
 return {u,s1,s2,s3,lesson,view};
}
const hash=s=>createHash('sha256').update(s).digest('hex');
test('migration stays disabled initially; re-running preserves the selected setting',async()=>{
 assert.equal((await db.query('select enabled from public.viewing_access_settings')).rows[0].enabled,false);
 await db.exec('update public.viewing_access_settings set enabled=true');await db.exec(migration);
 assert.equal((await db.query('select enabled from public.viewing_access_settings')).rows[0].enabled,true);
});
test('multiple tabs deduplicate by browser, while three distinct browsers are observed without a limit',async()=>{
 const f=await fixture();
 for(const b of ['same','same','second','third'])await db.query('select public.record_browser_connection($1,$2,$3,$4)',[f.u,hash(b),'Chrome · Windows','/dashboard']);
 assert.equal((await db.query('select count(*)::int n from public.browser_connections where user_id=$1',[f.u])).rows[0].n,3);
 assert.equal((await f.view(f.s3,randomUUID())).allowed,true);
});
test('only one player wins; a new session asks for confirmation before taking over',async()=>{
 const f=await fixture(),a=randomUUID(),b=randomUUID();
 assert.equal((await f.view(f.s1,a)).allowed,true);
 assert.equal((await f.view(f.s2,b)).reason,'active');
 assert.equal((await f.view(f.s1,a,'heartbeat')).allowed,true);
 assert.equal((await f.view(f.s2,b,'start',true)).allowed,true);
 assert.equal((await f.view(f.s1,a,'heartbeat')).reason,'superseded');
 assert.equal((await f.view(f.s1,a,'stop')).allowed,false);
 assert.equal((await f.view(f.s2,b,'heartbeat')).allowed,true);
});
test('expired leases do not renew silently, and the next player can start without a cooldown',async()=>{
 const f=await fixture(),a=randomUUID(),b=randomUUID();await f.view(f.s1,a);
 await db.query("update public.lesson_viewing_leases set expires_at=now()-interval '1 second' where user_id=$1",[f.u]);
 assert.equal((await f.view(f.s1,a,'heartbeat')).reason,'expired');
 assert.equal((await f.view(f.s2,b)).allowed,true);
 assert.equal((await f.view(f.s2,b,'stop')).allowed,true);
 assert.equal((await f.view(f.s3,randomUUID())).allowed,true);
});
test('invalid Auth sessions and non-enrolled lessons cannot claim a player',async()=>{
 const f=await fixture(),other=await fixture();
 assert.equal((await f.view(other.s1,randomUUID())).reason,'session');
 assert.equal((await f.view(f.s1,randomUUID(),'start',true,other.lesson)).reason,'lesson');
});
test('students cannot inspect other browser connections or write presence/leases directly',async()=>{
 await db.exec('set role authenticated');
 try{
  await assert.rejects(db.query('select * from public.browser_connections'),/permission denied/);
  await assert.rejects(db.query('select * from public.browser_connection_counts()'),/permission denied/);
  await assert.rejects(db.query('select public.record_browser_connection($1,$2,$3,$4)',[randomUUID(),hash('a'),'Chrome','/dashboard']),/permission denied/);
  await assert.rejects(db.query('select public.manage_lesson_viewing($1,$2,$3,$4,$5,$6)',[randomUUID(),randomUUID(),randomUUID(),randomUUID(),'start',true]),/permission denied/);
 }finally{await db.exec('reset role');}
});
test('upgrade removes the rejected browser-blocking policy and disables old settings',async()=>{
 await db.exec('create table public.account_access_settings(singleton boolean primary key,enabled boolean);insert into public.account_access_settings values(true,true);create policy "registered browser required" on public.lessons as restrictive for all to authenticated using(false);');
 await db.exec(migration);
 assert.equal((await db.query("select count(*)::int n from pg_policies where policyname='registered browser required'")).rows[0].n,0);
 assert.equal((await db.query('select enabled from public.account_access_settings')).rows[0].enabled,false);
});
test('all-time counts retain old browsers and never increase for repeat visits from the same browser',async()=>{
 const f=await fixture();await db.query('select public.record_browser_connection($1,$2,$3,$4)',[f.u,hash('old'),'Safari','/dashboard']);
 await db.query("update public.browser_connections set last_seen_at=now()-interval '400 days' where user_id=$1",[f.u]);
 assert.equal(Number((await db.query('select browser_count from public.browser_connection_counts() where user_id=$1',[f.u])).rows[0].browser_count),1);
 await db.query('select public.record_browser_connection($1,$2,$3,$4)',[f.u,hash('new'),'Chrome','/lesson/example']);
 assert.equal(Number((await db.query('select browser_count from public.browser_connection_counts() where user_id=$1',[f.u])).rows[0].browser_count),2);
 await db.query('select public.record_browser_connection($1,$2,$3,$4)',[f.u,hash('new'),'Chrome','/login']);
 await db.query('select public.record_browser_connection($1,$2,$3,$4)',[f.u,hash('old'),'Safari','/dashboard']);
 assert.equal(Number((await db.query('select browser_count from public.browser_connection_counts() where user_id=$1',[f.u])).rows[0].browser_count),2);
});
