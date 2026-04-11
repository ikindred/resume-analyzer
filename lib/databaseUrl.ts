/**
 * pg v8 + pg-connection-string: sslmode=require|prefer|verify-ca are currently treated
 * like verify-full; v9 will change. Make intent explicit to avoid startup warnings.
 */
export function normalizeDatabaseUrl(url: string): string {
  let out = url.trim();
  out = out.replace(/\bsslmode=require\b/gi, "sslmode=verify-full");
  out = out.replace(/\bsslmode=prefer\b/gi, "sslmode=verify-full");
  out = out.replace(/\bsslmode=verify-ca\b/gi, "sslmode=verify-full");
  return out;
}
