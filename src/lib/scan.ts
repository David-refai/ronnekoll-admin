/**
 * Cleans what a scanner typed:
 *  - AIM symbology prefix some scanners send first: "]C1" (GS1-128), "]C0", "]d2", "]Q1"… On a Swedish keyboard
 *    the "]" key is a dead key and comes out as "¨" (or vanishes), so "¨C1…" and "C1…" are handled too,
 *  - control characters (GS / FNC1 separators), quotes and other stray marks at either end.
 */
export function cleanScan(raw: unknown): string {
  let s = String(raw ?? '').replace(/[\x00-\x1f\x7f]/g, '').trim();
  if (/^[\]¨^~´`]/.test(s)) s = s.replace(/^[\]¨^~´`]+([A-Za-z][0-9A-Za-z])?/, (m, id) => (id && /^[CcdQEeIe][0-9]$/.test(id) ? '' : m.replace(/^[\]¨^~´`]+/, '')));
  s = s.replace(/^[^0-9A-Za-zÅÄÖåäö]+|[^0-9A-Za-zÅÄÖåäö#]+$/g, '');
  // "C1…" with the "]" lost: only when a long GS1 number follows, so real serials starting with C1 are kept.
  s = s.replace(/^[CcdQEe][01](?=\d{18,})/, '');
  return s.trim();
}

/** Parcel number as printed on the waybill (digits/letters only, no spaces). */
export function kolliKey(raw: unknown): string {
  return cleanScan(raw).replace(/\s+/g, '').toUpperCase();
}

/** Same parcel? "00" + SSCC and the bare 18-digit SSCC are the same number. */
export function sameKolli(a: unknown, b: unknown): boolean {
  const n = (x: unknown) => { const k = kolliKey(x); return /^00\d{18}$/.test(k) ? k.slice(2) : k; };
  const x = n(a), y = n(b);
  return !!x && x === y;
}

/** Looks like a parcel number rather than a device: long and mostly digits (PostNord/DHL SSCC, ]C1 prefix…). */
export function looksLikeKolli(raw: string): boolean {
  const t = String(raw).trim();
  if (/^[\]¨]C1/.test(t)) return true;
  const k = kolliKey(t);
  return k.length >= 12 && (k.match(/\d/g)?.length ?? 0) >= k.length - 4;
}
