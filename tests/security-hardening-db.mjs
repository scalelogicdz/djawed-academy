import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
function migration(suffix,fallback){
 if(process.env.SECURITY_SQL_FIXTURES)return readFileSync('../'+fallback,'utf8');
 const file=readdirSync('supabase/migrations').find(p=>p.endsWith(suffix));
 return readFileSync(file?'supabase/migrations/'+file:'supabase/private-profile-policy.sql','utf8');
}
const db=new PGlite();after(()=>db.close());
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
create table auth.mfa_factors(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,status text);
create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
create function auth.role() returns text language sql stable as $$select current_user::text$$;`);
await db.exec(readFileSync('supabase/schema.sql','utf8'));
await db.exec(`alter table public.profiles add column avatar_url text,add column bio text,add column instagram_url text,add column facebook_url text,add column tiktok_url text,add column linkedin_url text,add column last_seen_at timestamptz;
create table public.site_content(key text primary key,content jsonb);
create function public.notify_admins_on_new_question() returns trigger language plpgsql security definer as $$begin return new;end$$;
create function public.notify_asker_on_new_reply() returns trigger language plpgsql security definer as $$begin return new;end$$;
create policy "authenticated users can read profiles" on public.profiles for select to authenticated using(true);
grant usage on schema public,auth to authenticated,service_role;
grant select,insert,update,delete on all tables in schema public to authenticated,service_role;`);
const strip=s=>s.replace(/-- SCHEDULER BEGIN[\s\S]*?-- SCHEDULER END/,'');
await db.exec(strip(readFileSync('supabase/trial-access.sql','utf8')));
const prepare=strip(migration('_security_capabilities.sql','security-prepare-test.sql'));
const close=migration('_private_profile_policy.sql','security-close-test.sql');
await db.exec(prepare);await db.exec(close);
const student=randomUUID(),other=randomUUID(),admin=randomUUID();
for(const [id,name,isAdmin] of [[student,'One',false],[other,'Two',false],[admin,'Owner',true]]){
 await db.query('insert into auth.users values($1)',[id]);
 await db.query('insert into public.profiles(id,full_name,display_name,is_admin,bio) values($1,$2,$2,$3,$4)',[id,name,isAdmin,'Public bio']);
}
async function asUser(id,aal,fn){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,role:'authenticated',aal})]);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}}
test('paid students see only their own private profile; public projection omits private fields',async()=>{
 await asUser(student,'aal1',async()=>{
  assert.deepEqual((await db.query('select id from public.profiles')).rows.map(r=>r.id),[student]);
  const rows=(await db.query('select * from public.community_member_profiles($1)',[[student,other,admin]])).rows;
  assert.equal(rows.length,3);assert.ok(rows.every(r=>!('full_name'in r)&&!('last_seen_at'in r)&&!('access_mode'in r)));
 });
});
test('admin retains private access before enrollment; verified factor requires aal2 in RLS',async()=>{
 await asUser(admin,'aal1',async()=>assert.equal((await db.query('select id from public.profiles')).rows.length,3));
 await db.query("insert into auth.mfa_factors values($1,$2,'verified')",[randomUUID(),admin]);
 await asUser(admin,'aal1',async()=>{
  const state=(await db.query('select public.admin_mfa_status() s')).rows[0].s;
  assert.equal(state.required,true);assert.equal(state.satisfied,false);
  assert.equal((await db.query('select public.is_admin() a')).rows[0].a,false);
  assert.equal((await db.query('select id from public.profiles')).rows.length,1);
  assert.equal((await db.query('select public.trial_full_features() a')).rows[0].a,false);
  await assert.rejects(db.query('select * from public.community_member_profiles($1)',[[other]]),/Full access required/);
 });
 await asUser(admin,'aal2',async()=>{
  assert.equal((await db.query('select public.is_admin() a')).rows[0].a,true);
  assert.equal((await db.query('select id from public.profiles')).rows.length,3);
 });
});
const key=createHash('sha256').update('isolated-security-test').digest('hex');
test('atomic persistent limits allow exactly the configured count, survive callers, then reset after expiry',async()=>{
 const take=()=>db.query('select public.take_security_rate_limit($1,$2,3,60) s',['security-test',key]).then(r=>r.rows[0].s);
 await db.exec('set role service_role');
 try{
  const results=await Promise.all(Array.from({length:8},take));
  assert.equal(results.filter(r=>r.allowed).length,3);assert.ok(results.every(r=>r.retry_after>=1&&r.retry_after<=60));
 }finally{await db.exec('reset role');}
 await db.query("update public.security_rate_limits set expires_at=now()-interval '1 second' where bucket='security-test'");
 assert.equal((await take()).allowed,true);
});
test('students cannot read counters, invoke limits, bypass MFA helpers or claim admin in metadata',async()=>{
 await asUser(student,'aal2',async()=>{
  assert.equal((await db.query('select public.is_admin() a')).rows[0].a,false);
  await assert.rejects(db.query('select * from public.security_rate_limits'),/permission denied/);
  await assert.rejects(db.query('select public.take_security_rate_limit($1,$2,3,60)',['security-test',key]),/permission denied/);
 });
});
test('security migrations can be rerun without reopening profiles or resetting counters',async()=>{
 await db.exec(prepare);await db.exec(close);
 await asUser(student,'aal1',async()=>assert.equal((await db.query('select id from public.profiles')).rows.length,1));
 assert.equal((await db.query("select count(*)::int n from public.security_rate_limits")).rows[0].n,1);
});
