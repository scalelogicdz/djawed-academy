import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_TEXT = 500;

function clean(value: unknown, max = MAX_TEXT) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = new Set([
    'https://course.djawedkhalfaoui.com',
    'https://academy.djawedkhalfaoui.com',
  ]);

  if (origin && !allowedOrigins.has(origin) && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const payload = {
    name: clean(body.name, 120),
    whatsapp: clean(body.whatsapp, 40),
    source: clean(body.source, 40),
    campaign: clean(body.campaign, 180),
    adset: clean(body.adset, 180),
    ad: clean(body.ad, 180),
    stage: clean(body.stage, 300),
    level: clean(body.level, 300),
    obstacle: clean(body.obstacle, 500),
    desiredOutcome: clean(body.desiredOutcome, 500),
    contactTime: clean(body.contactTime, 80),
    fbclid: clean(body.fbclid, 500),
    ttclid: clean(body.ttclid, 500),
    landingUrl: clean(body.landingUrl, 1000),
  };

  if (payload.name.length < 2 || payload.whatsapp.length < 6) {
    return NextResponse.json({ error: 'invalid_lead' }, { status: 400 });
  }

  const webhookUrl = process.env.GOOGLE_LEADS_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: 'crm_not_configured' }, { status: 500 });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      redirect: 'follow',
    });

    const text = await response.text();
    let result: any = null;
    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text.slice(0, 500) };
    }

    if (!response.ok || result?.success === false) {
      console.error('CRM webhook failed', response.status, result);
      return NextResponse.json({ error: 'crm_write_failed' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, leadId: result?.leadId || null });
  } catch (error) {
    console.error('CRM webhook error', error);
    return NextResponse.json({ error: 'crm_unreachable' }, { status: 502 });
  }
}
