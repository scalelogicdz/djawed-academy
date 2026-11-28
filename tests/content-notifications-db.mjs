import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();after(()=>db.close());
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key,email text,deleted_at timestamptz);
create table public.profiles(id uuid primary key,is_admin boolean default false,access_mode text default 'full');
create table public.modules(id uuid primary key default gen_random_uuid(),course_id uuid,title text,description text,thumbnail_url text,position integer);
create table public.lessons(id uuid primary key default gen_random_uuid(),module_id uuid references public.modules(id) on delete cascade,title text,description text,video_id text,video_provider text,resource_url text,position integer);
create table public.enrollments(student_id uuid,course_id uuid);
create table public.site_content(key text primary key,content jsonb);`);
await db.exec(readFileSync('supabase/lesson-emails.sql','utf8'));
await db.exec(readFileSync('supabase/content-notifications.sql','utf8'));
const course=randomUUID(),otherCourse=randomUUID();
for(const [access,admin,enrolled,deleted] of [['full',false,true,false],['trial',false,true,false],['full',true,true,false],['full',false,false,false],['full',false,true,true]]){
 const id=randomUUID();await db.query('insert into auth.users values($1,$2,$3)',[id,id+'@example.test',deleted?new Date().toISOString():null]);
 await db.query('insert into public.profiles values($1,$2,$3)',[id,admin,access]);
 await db.query('insert into public.enrollments values($1,$2)',[id,enrolled?course:otherCourse]);
}
let module;
test('module creation atomically queues only full students enrolled in that course',async()=>{
 const result=await db.query('select public.create_module_with_emails($1::jsonb,$2,$3) saved',[JSON.stringify({course_id:course,title:'وحدة الاستهداف',position:0}),'sender@example.test','https://academy.example.test']);
 module=result.rows[0].saved;
 const jobs=await db.query('select * from public.lesson_email_jobs');assert.equal(jobs.rows.length,1);
 const job=jobs.rows[0];assert.equal(job.module_id,module.id);assert.equal(job.lesson_id,null);
 assert.equal(job.payload.kind,'module');assert.equal(job.payload.template_version,2);
 assert.equal(job.payload.title,'وحدة الاستهداف');
});
test('lesson payload snapshots the lesson and parent module names',async()=>{
 await db.query('select public.create_lesson_with_emails($1::jsonb,$2,$3)',[JSON.stringify({module_id:module.id,title:'الجمهور المخصص',position:0,video_provider:'bunny'}),'sender@example.test','https://academy.example.test']);
 const {rows}=await db.query('select payload from public.lesson_email_jobs where lesson_id is not null');
 assert.equal(rows.length,1);assert.equal(rows[0].payload.module_title,'وحدة الاستهداف');assert.equal(rows[0].payload.title,'الجمهور المخصص');
 await db.query('update public.modules set title=$1 where id=$2',['Changed title',module.id]);
 assert.equal((await db.query('select payload from public.lesson_email_jobs where lesson_id is not null')).rows[0].payload.module_title,'وحدة الاستهداف');
});
test('hidden modules cannot publish a notifying lesson; unsuccessful publication saves nothing',async()=>{
 await db.query('insert into public.site_content values($1,$2)', ['module-visibility:'+module.id,JSON.stringify({hidden:true})]);
 const before=(await db.query('select count(*)::int n from public.lessons')).rows[0].n;
 await assert.rejects(db.query('select public.create_lesson_with_emails($1::jsonb,$2,$3)',[JSON.stringify({module_id:module.id,title:'Hidden',position:1}),'sender@example.test','https://academy.example.test']),/hidden/);
 assert.equal((await db.query('select count(*)::int n from public.lessons')).rows[0].n,before);
});
test('students cannot execute publishing RPCs or read recipient queue; module deletion cascades jobs',async()=>{
 await db.exec('set role authenticated');
 await assert.rejects(db.query('select public.create_module_with_emails($1::jsonb,$2,$3)',['{}','sender@example.test','https://academy.example.test']),/permission denied/);
 await assert.rejects(db.query('select * from public.lesson_email_jobs'),/permission denied/);
 await db.exec('reset role');
 await db.query('delete from public.modules where id=$1',[module.id]);
 assert.equal((await db.query('select count(*)::int n from public.lesson_email_jobs')).rows[0].n,0);
});
