'use client';

import * as React from 'react';
import { Avatar, Badge, Icon, SearchBar, StatusBadge } from '@/ds';
import { searchStudents, serialKey, type DeviceView, type StudentView } from '@/lib/derive';

/** Search + pick a student. */
export function StudentPicker({
  students,
  value,
  onChange,
  autoFocus,
}: {
  students: StudentView[];
  value: StudentView | null;
  onChange(s: StudentView | null): void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = React.useState('');
  const hits = searchStudents(students, q).slice(0, 8);
  if (value) {
    return (
      <div className="rk-card row" style={{ padding: 16, boxShadow: 'none', background: 'var(--primary-container)', color: 'var(--on-primary-container)' }}>
        <Avatar name={value.namn} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{value.namn}</div>
          <div className="small">{value.klass} · {value.epost || value.elevId}{value.skap ? ` · skåp ${value.skap}` : ''}</div>
        </div>
        <button type="button" className="rk-btn rk-btn--text rk-btn--sm" onClick={() => onChange(null)}><span>Byt elev</span></button>
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <SearchBar placeholder="Sök elev: namn, klass, e-post eller ElevID" shortcut={false} value={q} autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)} onSubmit={() => hits.length === 1 && onChange(hits[0])} />
      {q && (
        <div className="rk-card" style={{ padding: 6 }}>
          {hits.map((s) => (
            <button key={s.id} type="button" className="picker-row" onClick={() => onChange(s)}>
              <Avatar name={s.namn} />
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <b>{s.namn}</b> <span className="muted small">· {s.klass}</span>
                <span className="small muted" style={{ display: 'block' }}>{s.epost || s.elevId}</span>
              </span>
              {s.device ? <Badge tone="blue" icon="laptop_chromebook">{s.device.assetId || s.device.serial}</Badge> : <Badge tone="gray">Ingen enhet</Badge>}
            </button>
          ))}
          {!hits.length && <div className="small muted" style={{ padding: 12 }}>Ingen elev matchar “{q}”.</div>}
        </div>
      )}
    </div>
  );
}

/** Scan or type a device serial/AssetID; optional filter for which devices are allowed. */
export function DevicePicker({
  devices,
  value,
  onChange,
  allow,
  reason,
  autoFocus,
  suggestions = true,
}: {
  devices: DeviceView[];
  value: DeviceView | null;
  onChange(d: DeviceView | null): void;
  allow?(d: DeviceView): boolean;
  reason?(d: DeviceView): string;
  autoFocus?: boolean;
  suggestions?: boolean;
}) {
  const [q, setQ] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const ok = allow ?? (() => true);
  const find = (raw: string) => {
    const k = serialKey(raw);
    return devices.find((d) => serialKey(d.serial) === k || (d.assetId && serialKey(d.assetId) === k));
  };
  const submit = (raw: string) => {
    const d = find(raw);
    if (!d) return setError(`Hittar ingen enhet med ${raw.trim()}.`);
    if (!ok(d)) return setError(reason?.(d) ?? `${d.assetId || d.serial} kan inte väljas (${d.status}).`);
    setError(null);
    setQ('');
    onChange(d);
  };
  if (value) {
    return (
      <div className="rk-card row" style={{ padding: 16, boxShadow: 'none', background: 'var(--surface-container-low)' }}>
        <span className="rk-kpi__icon rk-tone--primary"><Icon name="laptop_chromebook" size={22} fill /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{value.modell || 'Enhet'}</div>
          <div className="small mono">{value.serial}{value.assetId ? ` · ${value.assetId}` : ''}</div>
        </div>
        <StatusBadge status={value.status} />
        <button type="button" className="rk-btn rk-btn--text rk-btn--sm" onClick={() => onChange(null)}><span>Byt</span></button>
      </div>
    );
  }
  const k = serialKey(q);
  const list = suggestions ? devices.filter(ok).filter((d) => !k || serialKey(d.serial).includes(k) || serialKey(d.assetId).includes(k) || d.modell.toUpperCase().includes(k)).slice(0, 6) : [];
  return (
    <div className="stack" style={{ gap: 8 }}>
      <SearchBar size="lg" scanning placeholder="Skanna enhet" shortcut={false} value={q} autoFocus={autoFocus}
        onChange={(e) => { setQ(e.target.value); setError(null); }} onSubmit={submit} />
      {error && <span className="small" style={{ color: 'var(--status-red)', fontWeight: 600 }}>{error}</span>}
      {list.length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {list.map((d) => (
            <button key={d.id} type="button" className="rk-btn rk-btn--outlined rk-btn--sm" onClick={() => submit(d.serial)}>
              <span className="mono">{d.assetId || d.serial}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
