type RateEntry = {
  count: number;
  resetAt: number;
};

type SecurityGlobals = typeof globalThis & {
  __djawedRateLimits?: Map<string, RateEntry>;
};

const globals = globalThis as SecurityGlobals;
const rateLimits = globals.__djawedRateLimits ?? new Map<string, RateEntry>();
globals.__djawedRateLimits = rateLimits;

export function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = rateLimits.get(key);

  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  rateLimits.set(key, current);
  return {
    allowed: true,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export async function readJsonObject(request: Request, maxBytes = 32 * 1024) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > maxBytes) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function cleanText(value: unknown, minLength: number, maxLength: number) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (clean.length < minLength || clean.length > maxLength) return null;
  return clean;
}

export function cleanOptionalText(value: unknown, maxLength: number) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  if (!clean) return null;
  if (clean.length > maxLength) return undefined;
  return clean;
}

export function cleanEmail(value: unknown) {
  if (typeof value !== 'string') return null;
  const clean = value.trim().toLowerCase();
  if (clean.length < 3 || clean.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return null;
  return clean;
}

export function cleanWebUrl(value: unknown, maxLength = 2048) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  if (!clean) return null;
  if (clean.length > maxLength) return undefined;

  try {
    const url = new URL(clean);
    return url.protocol === 'https:' ? clean : undefined;
  } catch {
    return undefined;
  }
}

export function cleanPosition(value: unknown) {
  if (value == null) return 0;
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 10000
    ? Number(value)
    : null;
}
