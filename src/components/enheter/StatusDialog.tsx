'use client';

import * as React from 'react';
import { Button, Dialog, StatusBadge, TextField } from '@/ds';
import { changeDeviceStatus, type Decision } from '@/lib/actions';
import { serialKey, type DeviceView } from '@/lib/derive';
import { DEVICE_STATUSES, DISCONNECTING, type DeviceStatus } from '@/lib/lists';
import { useStore } from '@/lib/store';

/**
 * Change status for one device. If the device is assigned and the new status
 * disconnects it (Trasig / Under reparation / Kasserad), asks: Byt enhet / Återlämna.
 */
export function StatusDialog({
  device,
  devices,
  initial,
  onClose,
}: {
  device: DeviceView;
  devices: DeviceView[];
  initial?: DeviceStatus;
  onClose(): void;
}) {
  const store = useStore();
  const [next, setNext] = React.useState<DeviceStatus>(initial ?? device.status);
  const [decision, setDecision] = React.useState<Decision>('byt');
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const h = device.holder;
  const needsDecision = !!h && DISCONNECTING.includes(next);
  const canSwap = h?.kind === 'tilldelning';
  const effectiveDecision: Decision = canSwap ? decision : 'aterlamna';

  const available = React.useMemo(
    () => devices.filter((d) => d.status === 'Tillgänglig' && !d.holder && d.id !== device.id),
    [devices, device.id],
  );
  const q = serialKey(query);
  const replacement = q ? available.find((d) => serialKey(d.serial) === q || serialKey(d.assetId) === q) : undefined;
  const suggestions = available
    .filter((d) => !q || serialKey(d.serial).includes(q) || serialKey(d.assetId).includes(q) || d.modell.toUpperCase().includes(q))
    .slice(0, 5);

  const submit = async () => {
    setError(null);
    if (needsDecision && effectiveDecision === 'byt' && !replacement) {
      setError('Skanna eller välj en tillgänglig enhet att byta till.');
      return;
    }
    setBusy(true);
    try {
      const prev = device.status;
      await changeDeviceStatus(store, device, next, needsDecision ? { decision: effectiveDecision, replacement } : {});
      store.toast({
        icon: 'check_circle',
        message: needsDecision && effectiveDecision === 'byt' ? `${h?.namn} fick ${replacement?.serial}` : `${device.assetId || device.serial}: ${prev} → ${next}`,
        ...(needsDecision ? {} : { onAction: () => changeDeviceStatus(store, { ...device, status: next }, prev) }),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      tone={needsDecision ? 'warning' : 'default'}
      icon="swap_horiz"
      title={needsDecision ? `${device.assetId || device.serial} är ${h?.kind === 'utlaning' ? 'utlånad till' : 'tilldelad'} ${h?.namn} (${h?.klass})` : `Ändra status för ${device.assetId || device.serial}`}
      actions={
        <>
          <Button variant="text" onClick={onClose}>Avbryt</Button>
          <Button icon={needsDecision ? (effectiveDecision === 'byt' ? 'swap_horiz' : 'assignment_return') : 'check'} disabled={busy || next === device.status || store.readOnly} onClick={submit}>
            {needsDecision ? (effectiveDecision === 'byt' ? 'Byt enhet och spara' : 'Återlämna och spara') : 'Spara'}
          </Button>
        </>
      }
    >
      <div>
        <label className="field-label" htmlFor="rk-status">Ny status</label>
        <select id="rk-status" className="select" value={next} onChange={(e) => setNext(e.target.value as DeviceStatus)}>
          {DEVICE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}{s === device.status ? ' (nuvarande)' : ''}</option>
          ))}
        </select>
      </div>

      {needsDecision && (
        <>
          <span>
            Du ändrar status från <b>{device.status}</b> till <b>{next}</b>. En {next.toLowerCase()} enhet kan inte vara {h?.kind === 'utlaning' ? 'utlånad' : 'tilldelad'} — vad ska hända?
          </span>
          {canSwap && (
            <Dialog.Option icon="swap_horiz" title="Byt enhet" description={`${h?.namn} får en tillgänglig enhet i samma tilldelning`} selected={effectiveDecision === 'byt'} onClick={() => setDecision('byt')} />
          )}
          {canSwap && effectiveDecision === 'byt' && (
            <div className="stack" style={{ gap: 8, paddingLeft: 54 }}>
              <TextField label="Ny enhet — skanna eller skriv" mono leadingIcon="barcode_scanner" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} />
              {replacement ? (
                <span className="row small" style={{ gap: 8 }}>
                  <StatusBadge status="Tillgänglig" /> {replacement.modell} · {replacement.assetId || '—'} · {replacement.plats}
                </span>
              ) : (
                <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                  {suggestions.map((s) => (
                    <Button key={s.id} variant="outlined" size="sm" onClick={() => setQuery(s.serial)}>
                      {s.assetId || s.serial}
                    </Button>
                  ))}
                  {suggestions.length === 0 && <span className="small muted">Inga tillgängliga enheter matchar.</span>}
                </div>
              )}
            </div>
          )}
          <Dialog.Option icon="assignment_return" title="Återlämna" description={`Avsluta ${h?.kind === 'utlaning' ? 'lånet' : 'tilldelningen'} — ${h?.namn} står utan enhet`} selected={effectiveDecision === 'aterlamna'} onClick={() => setDecision('aterlamna')} />
          <span className="row small muted" style={{ gap: 6 }}>Loggas som nya händelser. Ingen historik skrivs över.</span>
        </>
      )}
      {error && <span className="small" style={{ color: 'var(--status-red)', fontWeight: 600 }}>{error}</span>}
    </Dialog>
  );
}
