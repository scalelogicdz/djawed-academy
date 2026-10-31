import { randomInt, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { lessonEmailConfig, escapeEmailHtml } from '@/lib/lessonEmails';
import { readJsonObject, isUuid } from '@/lib/security';
import { browserLabel, browserToken, DEVICE_COOKIE, DEVICE_COOKIE_OPTIONS, registerBrowser, sameOrigin, tokenHash, verificationHash, verifiedIdentity } from '@/lib/accountAccess';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function context() {
  const identity = await verifiedIdentity(await createClient());
  if (!identity) return null;
  const jar = await cookies();
  const token = browserToken(jar.get(DEVICE_COOKIE)?.value);
  jar.set(DEVICE_COOKIE, token, DEVICE_COOKIE_OPTIONS);
  return { ...identity, token, hash: tokenHash(token) };
}
export async function GET(request: Request) {
  try {
    const ctx = await context();
    if (!ctx) return json({ error: 'سجّل الدخول أولًا' }, 401);
    const access = await registerBrowser(ctx.user.id, ctx.sessionId, ctx.token, request.headers.get('user-agent') || '');
    const db = createAdminClient();
    const [browsers, state] = await Promise.all([
      db.from('account_browsers').select('id,label,created_at,last_seen_at,token_hash').eq('user_id',ctx.user.id).is('revoked_at',null).order('created_at'),
      db.from('account_device_state').select('last_replaced_at').eq('user_id',ctx.user.id).maybeSingle(),
    ]);
    if (browsers.error || state.error) throw new Error('unavailable');
    const nextAt = state.data?.last_replaced_at ? new Date(Date.parse(state.data.last_replaced_at) + 7 * 86400_000).toISOString() : null;
    return json({ allowed: access.allowed, disabled: !!access.disabled, nextAt,
      browsers: (browsers.data || []).map(({token_hash,...b}) => ({...b,current:token_hash===ctx.hash})) });
  } catch { return json({ error: 'تعذّر تحميل الأجهزة. حاول مجددًا بعد قليل.' },503); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({error:'طلب غير صالح'},403);
  try {
    const ctx = await context();
    if (!ctx) return json({error:'سجّل الدخول أولًا'},401);
    const body = await readJsonObject(request,2048);
    if (!body) return json({error:'بيانات غير صالحة'},400);
    const db=createAdminClient();
    if (body.action==='request' && isUuid(body.targetId)) {
      const config=lessonEmailConfig();
      if (!config || !ctx.user.email) return json({error:'خدمة التحقق بالبريد غير متاحة حاليًا. تواصل مع الإدارة.'},503);
      const id=randomUUID(), code=String(randomInt(100000,1000000));
      const {data,error}=await db.rpc('begin_account_device_replacement',{
        p_user:ctx.user.id,p_session:ctx.sessionId,p_hash:ctx.hash,p_label:browserLabel(request.headers.get('user-agent')||''),
        p_target:body.targetId,p_id:id,p_code_hash:verificationHash(id,code),
      });
      if(error) throw new Error('unavailable');
      if(!data?.ok) return failure(data?.error);
      try {
        const response=await fetch('https://api.resend.com/emails',{
          method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`device-replacement/${id}`},
          body:JSON.stringify({from:config.from,to:[ctx.user.email],subject:'رمز التحقق لاستبدال متصفح — Djawed Logic',
            text:`رمز التحقق: ${code}\nصالح لمدة 10 دقائق لاستبدال متصفح مسجّل على حسابك. لا تشارك هذا الرمز مع أي شخص. إذا لم تطلب الاستبدال، تجاهل الرسالة.\n${config.url}`,
            html:`<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#10253e"><h2>تأكيد استبدال المتصفح</h2><p>رمز التحقق الخاص بك:</p><p dir="ltr" style="font-size:28px;font-weight:bold;letter-spacing:5px">${code}</p><p>صالح لمدة 10 دقائق. لا تشارك الرمز مع أي شخص. إذا لم تطلب الاستبدال، تجاهل الرسالة.</p><img src="${escapeEmailHtml(config.url)}/djawed-logic-logo.png" alt="Djawed Logic" width="72"></div>`}),
          signal:AbortSignal.timeout(10000),
        });
        if(!response.ok) throw new Error('mail');
        const saved=await db.from('account_device_challenges').update({sent_at:new Date().toISOString()}).eq('id',id).is('consumed_at',null);
        if(saved.error) throw new Error('save');
      } catch {
        await db.from('account_device_challenges').update({consumed_at:new Date().toISOString()}).eq('id',id);
        return json({error:'تعذّر إرسال الرمز. حاول مجددًا بعد دقيقة.'},503);
      }
      return json({ok:true,challengeId:id});
    }
    if(body.action==='confirm' && isUuid(body.challengeId) && typeof body.code==='string' && /^\d{6}$/.test(body.code)) {
      const {data,error}=await db.rpc('confirm_account_device_replacement',{
        p_user:ctx.user.id,p_session:ctx.sessionId,p_hash:ctx.hash,p_id:body.challengeId,p_code_hash:verificationHash(body.challengeId,body.code),
      });
      if(error) throw new Error('unavailable');
      return data?.ok ? json({ok:true}) : failure(data?.error);
    }
    return json({error:'أدخل رمز التحقق المكوّن من 6 أرقام.'},400);
  } catch { return json({error:'الخدمة غير متاحة حاليًا. حاول بعد قليل.'},503); }
}
function failure(reason?: string) {
  if(reason==='cooldown') return json({error:'يمكن استبدال متصفح واحد كل 7 أيام. انتظر حتى انتهاء المدة.'},429);
  if(reason==='rate') return json({error:'انتظر دقيقة بين الرسائل. يمكنك طلب 3 رسائل خلال ساعة.'},429);
  return json({error:'تعذّر التحقق. تأكد من الرمز، أو اطلب رمزًا جديدًا إذا انتهت صلاحيته.'},400);
}
