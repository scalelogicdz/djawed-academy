import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { browserToken, DEVICE_COOKIE, DEVICE_COOKIE_OPTIONS, registerBrowser, verifiedIdentity } from '@/lib/accountAccess';

export async function proxy(request: NextRequest) {
  const changedCookies: { name: string; value: string; options: CookieOptions }[] = [];
  function finish(response: NextResponse) {
    for (const c of changedCookies) response.cookies.set(c.name, c.value, c.options);
    return response;
  }
  const path = request.nextUrl.pathname;
  // Public lead collection and password login do not require a registered browser.
  if (path === '/api/leads' || path === '/api/auth/login') return NextResponse.next();
  // Existing email workers authenticate their own scheduler secret in the route.
  const workerSecret = process.env.LESSON_EMAIL_WORKER_SECRET;
  if (request.method === 'POST' && workerSecret && request.headers.get('authorization') === `Bearer ${workerSecret}` &&
      ['/api/admin/lesson-emails','/api/admin/community-emails'].includes(path)) return NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(values: { name: string; value: string; options: CookieOptions }[]) {
          for (const c of values) {
            request.cookies.set(c.name, c.value);
            changedCookies.push(c);
          }
        },
      },
    }
  );

  const identity = await verifiedIdentity(supabase);
  if (!identity) {
    if (path === '/login') return finish(NextResponse.next({ request }));
    return finish(path.startsWith('/api/')
      ? NextResponse.json({error:'سجّل الدخول أولًا'}, {status:401})
      : NextResponse.redirect(new URL('/login', request.url)));
  }
  const { user, sessionId } = identity;
  // Recovery remains available to authenticated accounts on a blocked browser.
  if (path === '/api/account-devices' || path === '/devices') {
    const token = request.cookies.get(DEVICE_COOKIE)?.value;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      if (path.startsWith('/api/')) return finish(NextResponse.json({error:'أعد تحميل صفحة الأجهزة أولًا.',code:'DEVICE_REQUIRED'}, {status:403}));
      changedCookies.push({name:DEVICE_COOKIE,value:browserToken(),options:DEVICE_COOKIE_OPTIONS});
      return finish(NextResponse.redirect(request.nextUrl));
    }
    return finish(NextResponse.next({ request }));
  }
  try {
    const existingToken = request.cookies.get(DEVICE_COOKIE)?.value;
    if (!existingToken || !/^[a-f0-9]{64}$/.test(existingToken)) {
      // Establish the browser cookie before registering. Concurrent first-page
      // requests must not consume both slots using different random tokens.
      if (path.startsWith('/api/')) return finish(NextResponse.json({error:'أعد تحميل الصفحة لتسجيل المتصفح.',code:'DEVICE_REQUIRED'}, {status:403}));
      const fresh = browserToken();
      changedCookies.push({name:DEVICE_COOKIE,value:fresh,options:DEVICE_COOKIE_OPTIONS});
      return finish(NextResponse.redirect(request.nextUrl));
    }
    const token = existingToken;
    request.cookies.set(DEVICE_COOKIE, token);
    changedCookies.push({name:DEVICE_COOKIE,value:token,options:DEVICE_COOKIE_OPTIONS});
    const access = await registerBrowser(user.id, sessionId, token, request.headers.get('user-agent') || '');
    if (!access.allowed) return finish(path.startsWith('/api/')
      ? NextResponse.json({error:'هذا المتصفح غير مسجّل. افتح صفحة الأجهزة لاستبدال متصفح قديم.',code:'DEVICE_LIMIT'}, {status:403,headers:{'Cache-Control':'no-store'}})
      : NextResponse.redirect(new URL('/devices', request.url)));
  } catch {
    return finish(NextResponse.json({error:'خدمة التحقق من الأجهزة غير متاحة مؤقتًا. حاول بعد قليل.'}, {status:503,headers:{'Cache-Control':'no-store'}}));
  }
  if (path === '/login') return finish(NextResponse.redirect(new URL('/dashboard', request.url)));
  if (path.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return finish(NextResponse.redirect(new URL('/dashboard', request.url)));
    }
  }

  return finish(NextResponse.next({ request }));
}

export const config = {
  matcher: ['/dashboard/:path*', '/course-content/:path*', '/lesson/:path*', '/community/:path*', '/admin/:path*', '/profile/:path*', '/support/:path*', '/services/:path*', '/guidelines/:path*', '/api/:path*', '/devices', '/login'],
};
