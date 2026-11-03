'use client';

import * as React from 'react';
import { Button, Dialog, IconButton, SearchBar, type SearchBarProps } from '@/ds';
import { Portal } from '@/components/Portal';
import { BASE_PATH } from '@/components/Pwa';

/** Pulls the serial out of label text read by OCR ("SN# CND6110J8J", "S/N: 5CD…"). */
export function serialFromText(text: string): string | null {
  const t = text.toUpperCase().replace(/[|]/g, 'I');
  const m = t.match(/S\s*[\/]?\s*N\s*[#:.]?\s*([A-Z0-9]{8,14})/) ?? t.match(/SERIAL(?:\s*NO\.?)?\s*[#:]?\s*([A-Z0-9]{8,14})/);
  return m ? m[1] : null;
}

/** Turns OCR text into the same one-line form a barcode gives: "S/N: … P/N: … Model: …". */
function labelFromText(text: string): string | null {
  const sn = serialFromText(text);
  if (!sn) return null;
  const t = text.toUpperCase();
  const pn = t.match(/(?:PROD\s*[IL1]D|P\s*\/?\s*N|PRODUCT(?:\s*NO\.?)?)\s*[#:]?\s*([A-Z0-9]{5,10}#[A-Z0-9]{3})/)?.[1];
  const model = text.split(/\r?\n/).map((l) => l.trim()).find((l) => /^(HP|Lenovo|Dell|Acer|ASUS|Apple|Microsoft|Samsung)\b/i.test(l) && !/S\s*\/?N|PROD/i.test(l));
  return [`S/N: ${sn}`, pn ? `P/N: ${pn}` : '', model ? `Model: ${model.replace(/\s+/g, ' ')}` : ''].filter(Boolean).join(' ');
}

type Ocr = 'serial' | 'label';

/**
 * Camera scanner for phones and laptops. Reads line barcodes, QR and Data Matrix —
 * also the light-on-dark codes laser-etched into HP Chromebooks (tried inverted too).
 * When no code is found, "Läs texten" reads the printed SN# with OCR.
 */
export function CameraScanner({ onResult, onClose, ocr = 'serial' }: { onResult(text: string): void; onClose(): void; ocr?: Ocr | false }) {
  const video = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState<string | null>(null);
  const cb = React.useRef(onResult);
  cb.current = onResult;
  const done = React.useRef(false);

  const finish = (text: string) => {
    if (done.current) return;
    done.current = true;
    try { navigator.vibrate?.(60); } catch { /* ignore */ }
    cb.current(text.trim());
  };

  /** The middle of the frame, where the guide box is, at full camera resolution. */
  const grab = (scale = 1) => {
    const v = video.current;
    if (!v || !v.videoWidth) return null;
    const w = Math.round(v.videoWidth * 0.8), h = Math.round(v.videoHeight * 0.7);
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(v, (v.videoWidth - w) / 2, (v.videoHeight - h) / 2, w, h, 0, 0, c.width, c.height);
    return c;
  };

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    let loop = 0;
    const timer = window.setTimeout(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kameran är inte tillgänglig i den här webbläsaren (kräver https eller localhost).');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const track = stream.getVideoTracks()[0];
        // Continuous autofocus where the camera supports it (small etched codes need it).
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }); } catch { /* ignore */ }
        for (let i = 0; i < 20 && !video.current; i++) await new Promise((r) => setTimeout(r, 25));
        const v = video.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play().catch(() => undefined);

        // 1) The browser's own detector (Chrome on Android, ChromeOS, Mac) — fast and good at Data Matrix.
        type Detector = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };
        const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
        let native: Detector | null = null;
        if (BD) {
          try {
            const want = ['data_matrix', 'qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'itf', 'upc_a', 'pdf417', 'aztec'];
            const have = await BD.getSupportedFormats();
            const formats = want.filter((f) => have.includes(f));
            if (formats.length) native = new BD({ formats });
          } catch { /* fall back to ZXing */ }
        }

        // 2) zxing-cpp (WebAssembly): reads the light-on-dark Data Matrix etched into HP Chromebooks.
        const zw = await import('zxing-wasm/reader');
        zw.prepareZXingModule({ overrides: { locateFile: (path: string) => `${BASE_PATH}/${path}` } });
        const opts = {
          tryHarder: true, tryInvert: true, tryRotate: true, tryDownscale: true, maxNumberOfSymbols: 1,
          formats: ['DataMatrix', 'QRCode', 'Code128', 'Code39', 'EAN-13', 'EAN-8', 'ITF', 'PDF417'] as never,
        };
        const zx = async (c: HTMLCanvasElement) => {
          try {
            const img = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
            const r = await zw.readBarcodes(img, opts);
            return r.find((x) => x.isValid)?.text ?? null;
          } catch {
            return null;
          }
        };

        let n = 0;
        const tick = async () => {
          if (cancelled || done.current) return;
          n++;
          const c = grab(n % 3 === 0 ? 1 : 0.6);
          if (c) {
            let text: string | null = null;
            if (native) {
              try { text = (await native.detect(c))[0]?.rawValue ?? null; } catch { native = null; }
            }
            if (!text) text = await zx(c);
            if (text && !cancelled) return finish(text);
          }
          loop = window.setTimeout(tick, 80);
        };
        tick();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(/Permission|NotAllowed/i.test(msg) ? 'Du nekade kameran. Tillåt kamera för sidan i webbläsarens inställningar.' : /NotReadable|in use/i.test(msg) ? 'Kameran används av ett annat program. Stäng det och försök igen.' : msg);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(loop);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const readText = async () => {
    const c = grab(1);
    if (!c) return;
    setReading('Läser texten… (första gången laddas OCR, några sekunder)');
    try {
      const T = await import('tesseract.js');
      const worker = await T.createWorker('eng');
      // Etched labels are light on dark: help OCR with a grey, contrast-stretched copy.
      const ctx = c.getContext('2d')!;
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      const darkBg = sum / (d.length / 4) < 128;
      for (let i = 0; i < d.length; i += 4) {
        let g = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
        if (darkBg) g = 255 - g;
        d[i] = d[i + 1] = d[i + 2] = g;
      }
      ctx.putImageData(img, 0, 0);
      const { data } = await worker.recognize(c);
      await worker.terminate();
      const out = ocr === 'label' ? labelFromText(data.text) : serialFromText(data.text);
      if (out) finish(out);
      else setReading('Hittade inget serienummer i texten. Håll etiketten rakt, nära och i bra ljus, och försök igen.');
    } catch (e) {
      setReading(`OCR fungerade inte: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <Portal>
      <Dialog open onClose={onClose} icon="photo_camera" title="Skanna med kameran"
        actions={<>
          {ocr && !error && <Button variant="tonal" icon="document_scanner" onClick={readText}>Läs texten (SN#)</Button>}
          <Button variant="text" onClick={onClose}>Stäng</Button>
        </>}>
        {error ? (
          <span style={{ color: 'var(--status-red)', fontWeight: 600 }}>{error}</span>
        ) : (
          <>
            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '4 / 3' }}>
              <video ref={video} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', left: '10%', right: '10%', top: '15%', bottom: '15%', border: '3px solid var(--inverse-primary)', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,.35)' }} />
            </div>
            <span className="small muted">{reading ?? 'Håll koden inom ramen, 10–15 cm bort. Den inetsade rutan på Chromebooks går också — eller tryck Läs texten för att läsa SN# direkt.'}</span>
          </>
        )}
      </Dialog>
    </Portal>
  );
}

/** SearchBar that accepts USB-scanner input (typing + Enter) and has a camera button. */
export function ScanInput(props: SearchBarProps & { onScan(text: string): void; ocr?: Ocr | false }) {
  const { onScan, ocr, ...rest } = props;
  const [cam, setCam] = React.useState(false);
  return (
    <div className="row" style={{ gap: 8, alignItems: 'center' }} data-scan>
      <div style={{ flex: 1, minWidth: 0 }}>
        <SearchBar {...rest} onSubmit={onScan} />
      </div>
      <IconButton icon="photo_camera" variant="tonal" label="Skanna med kameran" onClick={() => setCam(true)} disabled={rest.disabled} />
      {cam && <CameraScanner ocr={ocr} onClose={() => setCam(false)} onResult={(t) => { setCam(false); onScan(t); }} />}
    </div>
  );
}
