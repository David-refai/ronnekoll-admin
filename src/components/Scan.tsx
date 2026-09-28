'use client';

import * as React from 'react';
import { Button, Dialog, IconButton, SearchBar, type SearchBarProps } from '@/ds';
import { Portal } from '@/components/Portal';

/** Camera barcode scanner (Code128, QR, EAN…) — for phones/tablets or laptops without a USB scanner. */
export function CameraScanner({ onResult, onClose }: { onResult(text: string): void; onClose(): void }) {
  const video = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const cb = React.useRef(onResult);
  cb.current = onResult;

  React.useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    // Start on the next tick: React dev mode mounts effects twice, and a first
    // reader that is stopped late would also stop the second one's video.
    const timer = window.setTimeout(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kameran är inte tillgänglig i den här webbläsaren (kräver https eller localhost).');
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        for (let i = 0; i < 20 && !video.current; i++) await new Promise((r) => setTimeout(r, 25));
        if (!video.current || cancelled) return;
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          video.current!,
          (result) => {
            if (result && !cancelled) {
              cancelled = true;
              try { navigator.vibrate?.(60); } catch { /* ignore */ }
              controls.stop();
              cb.current(result.getText().trim());
            }
          },
        );
        stop = () => controls.stop();
        if (cancelled) controls.stop();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(/Permission|NotAllowed/i.test(msg) ? 'Du nekade kameran. Tillåt kamera för sidan i webbläsarens inställningar.' : /NotReadable|in use/i.test(msg) ? 'Kameran används av ett annat program. Stäng det och försök igen.' : msg);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stop?.();
    };
  }, []);

  return (
    <Portal>
      <Dialog open onClose={onClose} icon="photo_camera" title="Skanna med kameran" actions={<Button variant="text" onClick={onClose}>Stäng</Button>}>
        {error ? (
          <span style={{ color: 'var(--status-red)', fontWeight: 600 }}>{error}</span>
        ) : (
          <>
            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '4 / 3' }}>
              <video ref={video} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', left: '10%', right: '10%', top: '38%', height: '24%', border: '3px solid var(--inverse-primary)', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,.35)' }} />
            </div>
            <span className="small muted">Håll streckkoden eller QR-koden inom ramen.</span>
          </>
        )}
      </Dialog>
    </Portal>
  );
}

/** SearchBar that accepts USB-scanner input (typing + Enter) and has a camera button. */
export function ScanInput(props: SearchBarProps & { onScan(text: string): void }) {
  const { onScan, ...rest } = props;
  const [cam, setCam] = React.useState(false);
  return (
    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <SearchBar {...rest} onSubmit={onScan} />
      </div>
      <IconButton icon="photo_camera" variant="tonal" label="Skanna med kameran" onClick={() => setCam(true)} disabled={rest.disabled} />
      {cam && <CameraScanner onClose={() => setCam(false)} onResult={(t) => { setCam(false); onScan(t); }} />}
    </div>
  );
}
