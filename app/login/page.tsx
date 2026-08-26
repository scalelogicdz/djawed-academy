'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <section className="max-w-[420px] mx-auto mt-16 px-4 text-center">
      <div className="w-14 h-14 border border-goldDim rounded-2xl flex items-center justify-center mx-auto mb-6 font-cairo font-extrabold text-gold text-xl bg-gradient-to-b from-[rgba(212,177,94,0.1)] to-transparent">
        DK
      </div>
      <h1 className="font-cairo font-extrabold text-2xl mb-2">Djawed Khalfaoui Academy</h1>
      <p className="text-muted text-sm mb-9">أكاديميتك الخاصة لإتقان إعلانات ميتا</p>

      <form onSubmit={handleLogin} className="card p-8 text-right">
        <div className="mb-4">
          <label className="block text-xs text-muted mb-2">البريد الإلكتروني</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-3.5 text-text text-[15px] focus:outline-none focus:border-gold"
          />
        </div>
        <div className="mb-4">
          <label className="block text-xs text-muted mb-2">كلمة المرور</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-white/[0.02] border border-border rounded-lg px-4 py-3.5 text-text text-[15px] focus:outline-none focus:border-gold"
          />
        </div>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
          {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
        </button>
      </form>

      <p className="text-xs text-muted2 mt-6">
        الحسابات تُنشأ يدويًا بعد تأكيد الدفع. إذا لم تستلم بيانات الدخول تواصل معنا.
      </p>
    </section>
  );
}
