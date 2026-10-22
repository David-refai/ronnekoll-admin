'use client';

import * as React from 'react';

/**
 * USB barcode scanners type like a US keyboard. If Windows is set to another layout (Arabic, Swedish…)
 * the same keys come out as other characters, e.g. "5CD19BSBS" → "5ؤي19لاسلاس".
 * We read the physical key (KeyboardEvent.code) instead and put back what the scanner meant:
 *  - in scan fields (inside [data-scan]) whenever a non-Latin character comes out,
 *  - anywhere else only during a scanner burst (keys < 35 ms apart — faster than anyone types).
 */
const SHIFTED: Record<string, [string, string]> = {
  Minus: ['-', '_'], Equal: ['=', '+'], Slash: ['/', '?'], Period: ['.', '>'], Comma: [',', '<'], Semicolon: [';', ':'],
  Quote: ["'", '"'], BracketLeft: ['[', '{'], BracketRight: [']', '}'], Backslash: ['\\', '|'], Backquote: ['`', '~'], Space: [' ', ' '],
  NumpadSubtract: ['-', '-'], NumpadAdd: ['+', '+'], NumpadDivide: ['/', '/'], NumpadMultiply: ['*', '*'], NumpadDecimal: ['.', '.'],
};
const DIGIT_SHIFT = ')!@#$%^&*(';

export function usChar(e: KeyboardEvent): string | null {
  const c = e.code;
  const shift = e.shiftKey;
  if (/^Key[A-Z]$/.test(c)) {
    const caps = e.getModifierState?.('CapsLock') ?? false;
    const ch = c.slice(3);
    return shift !== caps ? ch : ch.toLowerCase();
  }
  if (/^Digit\d$/.test(c)) return shift ? DIGIT_SHIFT[Number(c[5])] : c[5];
  if (/^Numpad\d$/.test(c)) return c[6];
  const s = SHIFTED[c];
  return s ? (shift ? s[1] : s[0]) : null;
}

const isField = (t: EventTarget | null): t is HTMLInputElement | HTMLTextAreaElement =>
  (t instanceof HTMLInputElement && ['text', 'search', ''].includes(t.type)) || t instanceof HTMLTextAreaElement;

/** Wrong for a scanner: a non-Latin character, or a different letter/digit than the key printed on a US keyboard. */
const NON_LATIN = /[^\x00-\u024f]/;
const wrong = (typed: string, meant: string) => typed !== meant && (/[^\x20-\x7e]/.test(typed) || /[A-Za-z0-9]/.test(meant));

function replace(el: HTMLInputElement | HTMLTextAreaElement, text: string, start: number, end: number) {
  el.setRangeText(text, start, end, 'end');
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function ScannerFix() {
  React.useEffect(() => {
    let last = 0;
    let prev: { el: HTMLInputElement | HTMLTextAreaElement; pos: number; typed: string; meant: string } | null = null;

    const onKey = (e: KeyboardEvent) => {
      const now = e.timeStamp || performance.now();
      const gap = now - last;
      last = now;
      if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing || e.key.length !== 1) return;
      const el = e.target;
      if (!isField(el)) return;
      const meant = usChar(e);
      if (!meant) return;
      const scanField = !!(el as HTMLElement).closest('[data-scan]');
      const burst = gap < 35;

      // The first key of a burst was already typed before we knew — fix it now.
      if (burst && prev && prev.el === el && wrong(prev.typed, prev.meant)) {
        const { pos, typed } = prev;
        if (el.value.slice(pos, pos + typed.length) === typed) replace(el, prev.meant, pos, pos + typed.length);
      }

      // In scan fields slow typing is still a person: only non-Latin characters (Arabic layout) are swapped,
      // so Swedish names with å/ä/ö can still be searched.
      if ((burst && wrong(e.key, meant)) || (scanField && NON_LATIN.test(e.key) && e.key !== meant)) {
        e.preventDefault();
        replace(el, meant, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length);
        prev = null;
        return;
      }
      prev = { el, pos: el.selectionStart ?? el.value.length, typed: e.key, meant };
    };
    // Capture phase on window: runs before the page's own handlers.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  return null;
}
