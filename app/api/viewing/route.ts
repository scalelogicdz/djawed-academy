import { createHash, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEVICE_COOKIE, sameOrigin, tokenHash, verifiedIdentity, VIEWING_STOP_MESSAGE } from '@/lib/accountAccess';
import { isUuid, readJsonObject } from '@/lib/security';
import { hiddenModuleIds } from '@/lib/moduleVisibility';
import { computeLockedLessonIds } from '@/lib/lessonLocking';

export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
  if(!sameOrigin(request))return json({error:'طلب غير صالح'},403);
  try {
    const client=await createClient();const identity=await verifiedIdentity(client);
    if(!identity)return json({error:'سجّل الدخول أولًا'},401);
    const token=(await cookies()).get(DEVICE_COOKIE)?.value;
    if(!token||!/^[a-f0-9]{64}$/.test(token))return json({error:'المتصفح غير مسجّل'},403);
    const body=await readJsonObject(request,2048);
    if(!body||!isUuid(body.lessonId)||!['start','heartbeat','stop'].includes(String(body.action)))return json({error:'طلب غير صالح'},400);
    const action=body.action as string;
    if(action!=='start'&&!isUuid(body.leaseId))return json({error:'جلسة غير صالحة'},400);
    let url:string|undefined;
    if(action==='start'){
      // Use the authenticated client: enrollment RLS still applies before issuing a player.
      const {data:lesson,error}=await client.from('lessons').select('id,module_id,video_id,video_provider').eq('id',body.lessonId).single();
      if(error||!lesson?.video_id||!/^[a-zA-Z0-9_-]{1,128}$/.test(lesson.video_id))return json({error:'الدرس غير متاح'},403);
      const hidden=await hiddenModuleIds(client);
      const {data:module}=await client.from('modules').select('course_id').eq('id',lesson.module_id).single();
      if(!module||hidden.has(lesson.module_id))return json({error:'الدرس غير متاح'},403);
      const {data:modules,error:moduleError}=await client.from('modules').select('id').eq('course_id',module.course_id);
      const ids=(modules||[]).filter(m=>!hidden.has(m.id)).map(m=>m.id);
      const [lessons,progress]=await Promise.all([
        client.from('lessons').select('id,module_id,position').in('module_id',ids).order('position'),
        client.from('lesson_progress').select('lesson_id').eq('student_id',identity.user.id),
      ]);
      if(moduleError||lessons.error||progress.error)throw new Error('authorization');
      if(computeLockedLessonIds(lessons.data||[],new Set((progress.data||[]).map(p=>p.lesson_id))).has(lesson.id))return json({error:'أكمل الدرس السابق أولًا'},403);
      if(lesson.video_provider==='vimeo')url=`https://player.vimeo.com/video/${lesson.video_id}?autoplay=0`;
      else {
        url=`https://iframe.mediadelivery.net/embed/744754/${lesson.video_id}?autoplay=false`;
        const key=process.env.BUNNY_STREAM_EMBED_TOKEN_KEY;
        if(key){const expires=Math.floor(Date.now()/1000)+120;const signature=createHash('sha256').update(`${key}${lesson.video_id}${expires}`).digest('hex');url+=`&token=${signature}&expires=${expires}`;}
      }
    }
    const leaseId=action==='start'?randomUUID():body.leaseId;
    const {data,error}=await createAdminClient().rpc('account_viewing_lease',{
      p_user:identity.user.id,p_session:identity.sessionId,p_hash:tokenHash(token),p_lease:leaseId,p_lesson:body.lessonId,p_action:action,
    });
    if(error||!data)throw new Error('lease');
    if(!data.allowed)return json({error:data.reason==='device'?'تم استبدال هذا المتصفح. افتح صفحة الأجهزة.':VIEWING_STOP_MESSAGE,code:data.reason},409);
    return json({ok:true,leaseId,...(url?{url}:{})});
  } catch { return json({error:'تعذّر التحقق من جلسة المشاهدة. حاول مجددًا.'},503); }
}
