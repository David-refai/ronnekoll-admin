/**
 * Cleans what a scanner typed:
 *  - AIM symbology prefix some scanners send first: "]C1" (GS1-128), "]C0", "]d2", "]Q1", "]E0"…
 *  - control characters (GS / FNC1 separators), and quotes some layouts add,
 *  - a lone "C1"/"C0" left when the "]" was eaten by the keyboard layout.
 */
export function cleanScan(raw: unknown): string {
  let s = String(raw ?? '').replace(/[\x00-\x1f\x7f]/g, '').trim();
  s = s.replace(/^["'`´]+|["'`´]+$/g, '').trim();
  s = s.replace(/^\][A-Za-z][0-9A-Za-z]/, '');
  // "]C1" with the "]" lost: only when what follows is a GS1 number (e.g. 00 + SSCC), so real serials starting with C1 are kept.
  s = s.replace(/^[CcdQEe][01](?=\d{18,})/, '');
  return s.trim();
}

/** Parcel number: GS1 "00" + 18-digit SSCC becomes the plain SSCC that PostNord and DHL show. */
export function kolliKey(raw: unknown): string {
  const s = cleanScan(raw).replace(/\s+/g, '').toUpperCase();
  const m = s.match(/^00(\d{18})$/);
  return m ? m[1] : s;
}
