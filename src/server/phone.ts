/** Phone-number helpers (E.164). */

const E164 = /^\+[1-9]\d{7,14}$/;

/** Normalise user input like "(415) 555-0123" or "0044 20…" to E.164, or null. */
export function normalizePhone(raw: string): string | null {
  let s = raw.trim().replace(/[\s().\-–]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  return E164.test(s) ? s : null;
}

export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return !!na && na === nb;
}

/** "+14155550123" -> "+1 415 555 0123"-ish grouping for display. */
export function prettyPhone(p: string | null | undefined): string {
  if (!p) return "Unknown number";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
  if (m) return `+1 (${m[1]}) ${m[2]}-${m[3]}`;
  return p.replace(/^(\+\d{1,3})(\d{3})(\d{3})(\d+)$/, "$1 $2 $3 $4");
}

/** Digits only, for leak detection of phone-like values in speech. */
export const digitsOnly = (s: string) => s.replace(/\D/g, "");
