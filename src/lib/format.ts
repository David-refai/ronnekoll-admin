const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** "i dag 09:12", "i går 15:40", then "14 aug 2026". */
export function relDate(value: unknown, withTime = true): string {
  if (!value) return '—';
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return String(value);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.floor((startToday - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  const hasTime = String(value).length > 10;
  if (diffDays === 0) return hasTime && withTime ? `i dag ${hhmm(d)}` : 'i dag';
  if (diffDays === 1) return hasTime && withTime ? `i går ${hhmm(d)}` : 'i går';
  if (diffDays > 1 && diffDays < 7) return `för ${diffDays} dagar sedan`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function shortDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return String(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function stamp(prefix: string, d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function daysSince(value: unknown) {
  const t = new Date(String(value)).getTime();
  return isNaN(t) ? 0 : Math.floor((Date.now() - t) / 86400000);
}
