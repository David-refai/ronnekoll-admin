'use client';

import * as React from 'react';

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** Registers the service worker so RönneKoll can be installed on phones and computers. */
export function Pwa() {
  React.useEffect(() => {
    if (!('serviceWorker' in navigator) || location.hostname === 'localhost' && process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch(() => {});
  }, []);
  return null;
}

type BIPEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Installera appen" — Android/Chrome/Edge show the native prompt; iPhone gets instructions. */
export function useInstall() {
  const [evt, setEvt] = React.useState<BIPEvent | null>(null);
  const [installed, setInstalled] = React.useState(false);
  React.useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const on = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    const done = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', on);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', done); };
  }, []);
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const install = async () => {
    if (!evt) return false;
    await evt.prompt();
    await evt.userChoice;
    setEvt(null);
    return true;
  };
  return { canPrompt: !!evt, installed, ios, install };
}
