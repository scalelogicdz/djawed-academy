'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ background: '#0E121B', color: '#F6F5F1', fontFamily: 'sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '24px',
          }}
        >
          <span style={{ fontSize: 40, marginBottom: 16 }}>⚠️</span>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>حدث خطأ غير متوقع</h1>
          <p style={{ color: '#99A2B5', fontSize: 14, marginBottom: 24 }}>
            نعتذر عن الإزعاج، حاول إعادة تحميل الصفحة
          </p>
          <button
            onClick={reset}
            style={{
              background: 'linear-gradient(135deg, #D4B15E, #C9A84C)',
              color: '#100C02',
              border: 'none',
              borderRadius: 10,
              padding: '13px 28px',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
