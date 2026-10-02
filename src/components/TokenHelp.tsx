'use client';

import * as React from 'react';
import { Button } from '@/ds';
import { useStore } from '@/lib/store';

export const GRAPH_EXPLORER = 'https://developer.microsoft.com/en-us/graph/graph-explorer';

/** Open Graph Explorer, copy its address, or paste a copied token straight from the clipboard. */
export function TokenButtons({ onSaved, compact }: { onSaved?(): void; compact?: boolean }) {
  const store = useStore();
  const pasteNow = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim().replace(/^Bearer\s+/i, '');
      if (!/^ey[\w-]+\.[\w-]+\.[\w-]+$/.test(text)) {
        store.toast({ icon: 'error', message: 'Urklippet innehåller ingen token. Kopiera "Access token" i Graph Explorer först.' });
        return;
      }
      store.setToken(text);
      store.toast({ icon: 'verified_user', message: 'Token sparad' });
      if (!store.settings.demo) window.setTimeout(() => store.reload(), 0);
      onSaved?.();
    } catch {
      store.toast({ icon: 'error', message: 'Webbläsaren tillät inte att läsa urklippet — klistra in i rutan i stället.' });
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(GRAPH_EXPLORER);
      store.toast({ icon: 'content_copy', message: 'Adressen till Graph Explorer kopierad' });
    } catch { /* ignore */ }
  };
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
      <a className={`rk-btn rk-btn--${compact ? 'outlined' : 'tonal'} rk-btn--has-icon`} href={GRAPH_EXPLORER} target="_blank" rel="noreferrer">
        <span className="rk-icon" aria-hidden style={{ fontSize: 18, width: 18, height: 18 }}>open_in_new</span><span>Öppna Graph Explorer</span>
      </a>
      {!compact && <Button variant="text" icon="content_copy" onClick={copy}>Kopiera adressen</Button>}
      <Button variant={compact ? 'danger' : 'filled'} icon="content_paste_go" onClick={pasteNow}>Klistra in token från urklipp</Button>
    </div>
  );
}
