'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Icon, IconButton, StatusBadge } from '@/ds';
import { CameraScanner } from '@/components/Scan';
import { buildDevices, buildStudents, serialKey } from '@/lib/derive';
import { useStore } from '@/lib/store';

/** Top-bar search: results while you type (enheter + elever), Enter/scan opens the match, camera button. */
export function GlobalSearch({ onSubmit }: { onSubmit(q: string): void }) {
  const store = useStore();
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [cam, setCam] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const wrap = React.useRef<HTMLDivElement>(null);

  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const students = React.useMemo(() => buildStudents(store.data, devices), [store.data, devices]);

  const n = q.trim().toLowerCase();
  const k = serialKey(q);
  const hits = React.useMemo(() => {
    if (n.length < 2) return [];
    const dev = devices
      .filter((d) => [d.assetId, d.serial, d.modell, d.holder?.namn, d.klass].join(' ').toLowerCase().includes(n) || (k && serialKey(d.serial).includes(k)))
      .slice(0, 6)
      .map((d) => ({
        key: 'd' + d.id, icon: 'laptop_chromebook', title: `${d.assetId || '—'} · ${d.serial}`, sub: [d.modell, d.holder ? `${d.holder.namn} ${d.holder.klass}` : d.plats].filter(Boolean).join(' · '),
        badge: d.status as string, go: () => router.push(`/enheter?open=${encodeURIComponent(d.serial)}`),
      }));
    const stu = students
      .filter((s) => [s.namn, s.elevId, s.epost, s.klass].join(' ').toLowerCase().includes(n))
      .slice(0, 6)
      .map((s) => ({
        key: 's' + s.id, icon: 'school', title: s.namn, sub: [s.klass, s.device ? s.device.assetId || s.device.serial : 'utan enhet'].join(' · '),
        badge: '', go: () => router.push(`/elever?open=${encodeURIComponent(s.elevId || s.namn)}`),
      }));
    return [...dev, ...stu];
  }, [n, k, devices, students, router]);

  React.useEffect(() => setActive(0), [n]);
  React.useEffect(() => {
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const done = () => { setQ(''); setOpen(false); };
  const submit = (text = q) => {
    if (open && hits[active] && text === q && !/^[A-Z0-9,#\s-]{8,}$/i.test(text.trim())) hits[active].go();
    else onSubmit(text);
    done();
  };

  return (
    <div ref={wrap} style={{ position: 'relative', display: 'flex', gap: 8, alignItems: 'center', width: '100%' }} data-scan>
      <form className="rk-search" role="search" style={{ flex: 1, minWidth: 0 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Icon name="search" size={22} className="rk-search__lead" />
        <input className="rk-search__input" placeholder="Sök eller skanna: serienummer, AssetID, elev, klass…" aria-label="Sök eller skanna" autoComplete="off"
          value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Escape') setOpen(false);
          }} />
        <kbd className="rk-kbd">Ctrl K</kbd>
      </form>
      <IconButton icon="photo_camera" label="Skanna med kameran" onClick={() => setCam(true)} />
      {open && n.length >= 2 && (
        <div className="rk-card" role="listbox" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60, padding: 6, maxHeight: '60vh', overflow: 'auto', boxShadow: 'var(--shadow-3, 0 8px 24px rgba(0,0,0,.18))' }}>
          {hits.length ? hits.map((h, i) => (
            <button key={h.key} type="button" role="option" aria-selected={i === active} className="row picker-row"
              style={{ gap: 12, textAlign: 'left', background: i === active ? 'var(--surface-container)' : undefined }}
              onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => { h.go(); done(); }}>
              <Icon name={h.icon} size={20} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, display: 'block' }} className={h.icon === 'school' ? undefined : 'mono'}>{h.title}</span>
                <span className="small muted">{h.sub}</span>
              </span>
              {h.badge && <StatusBadge status={h.badge as never} />}
            </button>
          )) : <div className="small muted" style={{ padding: 12 }}>Inget hittades för ”{q.trim()}”.</div>}
        </div>
      )}
      {cam && <CameraScanner onClose={() => setCam(false)} onResult={(t) => { setCam(false); onSubmit(t); }} />}
    </div>
  );
}
